"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  getCurrentSession,
  isSupabaseConfigured,
  onAuthStateChange,
  signInWithGoogle,
  signOut,
} from "../../lib/supabase";
import { initialTasks, timerDurations } from "../data";
import type { TimerMode } from "../types";
import { FocusTimer } from "./FocusTimer";
import { Sidebar } from "./Sidebar";
import { TaskList } from "./TaskList";

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "인증 중 알 수 없는 오류가 발생했습니다.";
}

function getUserDisplayName(user: User) {
  const metadataName = user.user_metadata.full_name ?? user.user_metadata.name;
  return typeof metadataName === "string" && metadataName.trim()
    ? metadataName
    : (user.email ?? "로그인 사용자");
}

export function TodoTimerApp() {
  const supabaseConfigured = isSupabaseConfigured();
  const [tasks, setTasks] = useState(initialTasks);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(2);
  const [newTask, setNewTask] = useState("");
  const [mode, setMode] = useState<TimerMode>("focus");
  const [remainingSeconds, setRemainingSeconds] = useState(timerDurations.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const remainingSnapshot = useRef(remainingSeconds);

  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const completedCount = tasks.filter((task) => task.completed).length;
  const authDisplayName = authUser ? getUserDisplayName(authUser) : "게스트 모드";
  const authInitial = authUser
    ? authDisplayName.trim().charAt(0).toUpperCase() || "U"
    : "G";
  const authDescription = !supabaseConfigured
    ? "Supabase 환경변수 필요"
    : !authReady
      ? "로그인 확인 중…"
      : authPending
        ? "처리 중…"
        : authUser
          ? `${authUser.email ?? "Google 계정"} · 로그아웃`
          : "Google로 로그인하고 동기화";

  useEffect(() => {
    if (!supabaseConfigured) return;

    let mounted = true;

    const subscription = onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthUser(session?.user ?? null);
      setAuthReady(true);
      setAuthPending(false);
    });

    getCurrentSession()
      .then((session) => {
        if (mounted) setAuthUser(session?.user ?? null);
      })
      .catch((error: unknown) => {
        if (mounted) setAuthError(getAuthErrorMessage(error));
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabaseConfigured]);

  useEffect(() => {
    if (!isRunning) remainingSnapshot.current = remainingSeconds;
  }, [isRunning, remainingSeconds]);

  useEffect(() => {
    if (!isRunning) return;

    const endsAt = Date.now() + remainingSnapshot.current * 1000;
    const intervalId = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemainingSeconds(next);

      if (next === 0) {
        setIsRunning(false);
        if (mode === "focus" && activeTaskId !== null) {
          setTasks((current) =>
            current.map((task) =>
              task.id === activeTaskId
                ? { ...task, pomodoros: task.pomodoros + 1 }
                : task,
            ),
          );
        }
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [activeTaskId, isRunning, mode]);

  const progressPercent = useMemo(
    () => Math.round((completedCount / Math.max(tasks.length, 1)) * 100),
    [completedCount, tasks.length],
  );

  function handleModeChange(nextMode: TimerMode) {
    setMode(nextMode);
    setRemainingSeconds(timerDurations[nextMode]);
    setIsRunning(false);
  }

  function handleToggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    );
  }

  function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTask.trim();
    if (!title) return;

    setTasks((current) => [
      ...current,
      {
        id: Date.now(),
        title,
        label: "개인",
        estimate: 1,
        completed: false,
        pomodoros: 0,
      },
    ]);
    setNewTask("");
  }

  async function handleAuthAction() {
    if (!supabaseConfigured || !authReady || authPending) return;

    setAuthError(null);
    setAuthPending(true);

    try {
      if (authUser) {
        await signOut();
      } else {
        await signInWithGoogle();
      }
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      setAuthPending(false);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar
        authDescription={authDescription}
        authDisabled={!supabaseConfigured || !authReady || authPending}
        authInitial={authInitial}
        authLabel={authDisplayName}
        completedCount={completedCount}
        onAuthAction={handleAuthAction}
        totalCount={tasks.length}
      />

      <div className="workspace">
        <header className="mobile-header">
          <div className="brand mobile-brand">
            <span className="brand-mark" aria-hidden="true">●</span>
            <span>하루</span>
          </div>
          <div className="mobile-header-actions">
            <button
              className="mobile-auth-button"
              type="button"
              onClick={handleAuthAction}
              disabled={!supabaseConfigured || !authReady || authPending}
            >
              {authPending ? "처리 중…" : authUser ? "로그아웃" : "Google 로그인"}
            </button>
            <button className="mobile-menu" type="button" aria-label="메뉴 열기">☰</button>
          </div>
        </header>

        <div className="top-actions">
          <div className="daily-progress" aria-label={`오늘 할 일 ${progressPercent}% 완료`}>
            <span>오늘의 진행률</span>
            <div className="progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
            <strong>{progressPercent}%</strong>
          </div>
          <button className="install-button" type="button" onClick={() => setShowInstallHelp(true)}>
            <span aria-hidden="true">⇩</span> 앱으로 설치
          </button>
          <button className="notification-button" type="button" aria-label="알림">♢</button>
        </div>

        {showInstallHelp && (
          <div className="install-preview" role="status">
            <div>
              <strong>홈 화면에 하루 추가</strong>
              <span>실제 PWA 연결 시 이 버튼으로 바로 설치할 수 있어요.</span>
            </div>
            <button type="button" onClick={() => setShowInstallHelp(false)} aria-label="닫기">×</button>
          </div>
        )}

        {authError && (
          <div className="install-preview auth-error-preview" role="alert">
            <div>
              <strong>로그인하지 못했습니다</strong>
              <span>{authError}</span>
            </div>
            <button type="button" onClick={() => setAuthError(null)} aria-label="닫기">×</button>
          </div>
        )}

        <div className="product-grid">
          <TaskList
            tasks={tasks}
            activeTaskId={activeTaskId}
            newTask={newTask}
            onNewTaskChange={setNewTask}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onSelectTask={(id) => {
              setActiveTaskId(id);
              setMode("focus");
              setRemainingSeconds(timerDurations.focus);
              setIsRunning(false);
            }}
          />

          <FocusTimer
            activeTask={activeTask}
            mode={mode}
            remainingSeconds={remainingSeconds}
            totalSeconds={timerDurations[mode]}
            isRunning={isRunning}
            onModeChange={handleModeChange}
            onToggleRunning={() => setIsRunning((current) => !current)}
            onReset={() => {
              setIsRunning(false);
              setRemainingSeconds(timerDurations[mode]);
            }}
          />
        </div>
      </div>
    </main>
  );
}
