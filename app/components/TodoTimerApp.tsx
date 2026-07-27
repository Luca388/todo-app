"use client";

import type { User } from "@supabase/supabase-js";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  cancelPomodoro,
  completePomodoro,
  createTodo,
  deleteTodo,
  getActivePomodoro,
  getCurrentSession,
  isSupabaseConfigured,
  listRecentPomodoros,
  listTodos,
  onAuthStateChange,
  pausePomodoro,
  resumePomodoro,
  setTodoCompleted,
  signInWithGoogle,
  signOut,
  startPomodoro,
  updateTodo,
  type PomodoroMode,
  type PomodoroSessionRow,
  type TodoLabel,
  type TodoRow,
} from "../../lib/supabase";
import { initialTasks, timerDurations } from "../data";
import type { Task, TaskLabel, TimerMode } from "../types";
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

const taskLabels: Record<TodoLabel, TaskLabel> = {
  work: "업무",
  personal: "개인",
  health: "건강",
};

const pomodoroModes: Record<TimerMode, PomodoroMode> = {
  focus: "focus",
  short: "short_break",
  long: "long_break",
};

const timerModes: Record<PomodoroMode, TimerMode> = {
  focus: "focus",
  short_break: "short",
  long_break: "long",
};

function todoRowToTask(todo: TodoRow): Task {
  return {
    id: todo.id,
    title: todo.title,
    label: taskLabels[todo.label],
    estimate: todo.estimated_pomodoros,
    completed: todo.completed,
    pomodoros: 0,
  };
}

function getPomodoroElapsed(
  session: PomodoroSessionRow,
  now = Date.now(),
) {
  const savedElapsed = Math.max(0, session.elapsed_seconds);
  if (session.status !== "running") return savedElapsed;

  const resumedAt = session.last_resumed_at ?? session.started_at;
  const currentRunElapsed = Math.max(
    0,
    Math.floor((now - new Date(resumedAt).getTime()) / 1000),
  );
  return Math.min(
    session.planned_seconds,
    savedElapsed + currentRunElapsed,
  );
}

function getPomodoroRemaining(session: PomodoroSessionRow) {
  return Math.max(
    0,
    session.planned_seconds - getPomodoroElapsed(session),
  );
}

type RemoteTodosState = {
  ownerId: string;
  tasks: Task[];
  error: string | null;
};

export function TodoTimerApp() {
  const supabaseConfigured = isSupabaseConfigured();
  const [guestTasks, setGuestTasks] = useState(initialTasks);
  const [remoteTodos, setRemoteTodos] = useState<RemoteTodosState | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>("2");
  const [newTask, setNewTask] = useState("");
  const [mode, setMode] = useState<TimerMode>("focus");
  const [remainingSeconds, setRemainingSeconds] = useState(timerDurations.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [todoActionError, setTodoActionError] = useState<string | null>(null);
  const [todoReloadToken, setTodoReloadToken] = useState(0);
  const [todoSaving, setTodoSaving] = useState(false);
  const [pendingTodoIds, setPendingTodoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [activePomodoro, setActivePomodoro] =
    useState<PomodoroSessionRow | null>(null);
  const [pomodoroLoadedForUser, setPomodoroLoadedForUser] =
    useState<string | null>(null);
  const [pomodoroPending, setPomodoroPending] = useState(false);
  const [pomodoroError, setPomodoroError] = useState<string | null>(null);
  const [pomodoroReloadToken, setPomodoroReloadToken] = useState(0);
  const [guestSessionActive, setGuestSessionActive] = useState(false);
  const [pomodoroCounts, setPomodoroCounts] = useState<Record<string, number>>(
    {},
  );
  const [remoteFocusSummary, setRemoteFocusSummary] = useState({
    seconds: 0,
    sessions: 0,
  });
  const remainingSnapshot = useRef(remainingSeconds);
  const pomodoroChannel = useRef<BroadcastChannel | null>(null);

  const authUserId = authUser?.id;
  const currentRemoteTodos =
    authUserId && remoteTodos?.ownerId === authUserId ? remoteTodos : null;
  const storedTasks = authUserId
    ? (currentRemoteTodos?.tasks ?? [])
    : guestTasks;
  const tasks = authUserId
    ? storedTasks.map((task) => ({
        ...task,
        pomodoros: pomodoroCounts[task.id] ?? 0,
      }))
    : storedTasks;
  const todosLoading = Boolean(authUserId && !currentRemoteTodos);
  const todosError = authUserId
    ? (currentRemoteTodos?.error ?? todoActionError)
    : null;
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const currentPomodoro =
    authUserId && activePomodoro?.user_id === authUserId
      ? activePomodoro
      : null;
  const pomodoroLoading = Boolean(
    authUserId && pomodoroLoadedForUser !== authUserId,
  );
  const hasActiveTimerSession = Boolean(
    currentPomodoro || (!authUserId && guestSessionActive),
  );
  const guestCompletedSessions = guestTasks.reduce(
    (total, task) => total + task.pomodoros,
    0,
  );
  const todayFocusSeconds = authUserId
    ? remoteFocusSummary.seconds
    : guestCompletedSessions * timerDurations.focus;
  const todayCompletedSessions = authUserId
    ? remoteFocusSummary.sessions
    : guestCompletedSessions;
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

  const updateVisibleTasks = useCallback(
    (updater: (current: Task[]) => Task[]) => {
      if (!authUserId) {
        setGuestTasks(updater);
        return;
      }

      setRemoteTodos((current) =>
        current?.ownerId === authUserId
          ? { ...current, tasks: updater(current.tasks) }
          : current,
      );
    },
    [authUserId],
  );

  const broadcastPomodoroChange = useCallback(() => {
    pomodoroChannel.current?.postMessage("pomodoro-changed");
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel("haru-pomodoro");
    pomodoroChannel.current = channel;
    channel.onmessage = () => {
      setPomodoroLoadedForUser(null);
      setPomodoroReloadToken((current) => current + 1);
    };

    return () => {
      channel.close();
      pomodoroChannel.current = null;
    };
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;

    let mounted = true;

    function applyUser(user: User | null) {
      setAuthUser(user);
      if (!user) {
        setActiveTaskId("2");
        setTodoActionError(null);
        setPendingTodoIds(new Set());
        setActivePomodoro(null);
        setPomodoroLoadedForUser(null);
        setPomodoroError(null);
        setPomodoroPending(false);
        setIsRunning(false);
      }
    }

    const subscription = onAuthStateChange((_event, session) => {
      if (!mounted) return;
      applyUser(session?.user ?? null);
      setAuthReady(true);
      setAuthPending(false);
    });

    getCurrentSession()
      .then((session) => {
        if (mounted) applyUser(session?.user ?? null);
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
    if (!authUserId) return;

    let mounted = true;

    listTodos()
      .then((todos) => {
        if (!mounted) return;

        const nextTasks = todos.map(todoRowToTask);
        setRemoteTodos({
          ownerId: authUserId,
          tasks: nextTasks,
          error: null,
        });
        setTodoActionError(null);
        setActiveTaskId((current) =>
          nextTasks.some((task) => task.id === current && !task.completed)
            ? current
            : (nextTasks.find((task) => !task.completed)?.id ?? null),
        );
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setRemoteTodos({
          ownerId: authUserId,
          tasks: [],
          error: getAuthErrorMessage(error),
        });
      });

    return () => {
      mounted = false;
    };
  }, [authUserId, todoReloadToken]);

  useEffect(() => {
    if (!authUserId) return;

    let mounted = true;

    Promise.allSettled([
      getActivePomodoro(),
      listRecentPomodoros(100),
    ]).then(([activeResult, recentResult]) => {
      if (!mounted) return;

      setPomodoroLoadedForUser(authUserId);
      setPomodoroError(null);

      if (recentResult.status === "fulfilled") {
        const completedFocusSessions = recentResult.value.filter(
          (session) =>
            session.status === "completed" && session.mode === "focus",
        );
        const counts: Record<string, number> = {};

        for (const session of completedFocusSessions) {
          if (!session.todo_id) continue;
          counts[session.todo_id] = (counts[session.todo_id] ?? 0) + 1;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySessions = completedFocusSessions.filter((session) => {
          const endedAt = session.ended_at ?? session.started_at;
          return new Date(endedAt).getTime() >= today.getTime();
        });

        setPomodoroCounts(counts);
        setRemoteFocusSummary({
          seconds: todaySessions.reduce(
            (total, session) => total + session.elapsed_seconds,
            0,
          ),
          sessions: todaySessions.length,
        });
      } else {
        setPomodoroError(getAuthErrorMessage(recentResult.reason));
      }

      if (activeResult.status === "fulfilled") {
        const active = activeResult.value;
        setActivePomodoro(active);

        if (active) {
          const nextMode = timerModes[active.mode];
          const remaining = getPomodoroRemaining(active);

          setMode(nextMode);
          setRemainingSeconds(remaining);
          remainingSnapshot.current = remaining;
          setActiveTaskId((current) =>
            active.mode === "focus" ? active.todo_id : current,
          );
          setIsRunning(active.status === "running");
        } else {
          setIsRunning(false);
        }
      } else {
        setActivePomodoro(null);
        setIsRunning(false);
        setPomodoroError(getAuthErrorMessage(activeResult.reason));
      }
    });

    return () => {
      mounted = false;
    };
  }, [authUserId, pomodoroReloadToken]);

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
        window.clearInterval(intervalId);
        setIsRunning(false);

        if (authUserId && currentPomodoro) {
          setPomodoroPending(true);
          setPomodoroError(null);

          void completePomodoro(
            currentPomodoro.id,
            currentPomodoro.planned_seconds,
          )
            .then((completed) => {
              setActivePomodoro(null);
              broadcastPomodoroChange();

              if (completed.mode === "focus") {
                const todoId = completed.todo_id;
                if (todoId) {
                  setPomodoroCounts((current) => ({
                    ...current,
                    [todoId]: (current[todoId] ?? 0) + 1,
                  }));
                }

                setRemoteFocusSummary((current) => ({
                  seconds: current.seconds + completed.elapsed_seconds,
                  sessions: current.sessions + 1,
                }));
              }
            })
            .catch((error: unknown) => {
              setPomodoroError(getAuthErrorMessage(error));
            })
            .finally(() => {
              setPomodoroPending(false);
            });
        } else {
          setGuestSessionActive(false);
        }

        if (!authUserId && mode === "focus" && activeTaskId !== null) {
          updateVisibleTasks((current) =>
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
  }, [
    activeTaskId,
    authUserId,
    broadcastPomodoroChange,
    currentPomodoro,
    isRunning,
    mode,
    updateVisibleTasks,
  ]);

  const progressPercent = useMemo(
    () => Math.round((completedCount / Math.max(tasks.length, 1)) * 100),
    [completedCount, tasks.length],
  );

  function handleModeChange(nextMode: TimerMode) {
    if (hasActiveTimerSession || pomodoroPending) return;
    setMode(nextMode);
    setRemainingSeconds(timerDurations[nextMode]);
    setIsRunning(false);
  }

  async function handleToggleTask(id: string) {
    const task = tasks.find((candidate) => candidate.id === id);
    if (!task || pendingTodoIds.has(id)) return;
    if (
      hasActiveTimerSession &&
      mode === "focus" &&
      activeTaskId === id
    ) {
      setTodoActionError("실행 중인 포모도로를 먼저 완료하거나 취소해 주세요.");
      return;
    }

    const completed = !task.completed;
    updateVisibleTasks((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, completed } : candidate,
      ),
    );

    if (completed && activeTaskId === id) {
      setActiveTaskId(null);
      setIsRunning(false);
    }

    if (!authUserId) return;

    setTodoActionError(null);
    setPendingTodoIds((current) => new Set(current).add(id));

    try {
      const updated = await setTodoCompleted(id, completed);
      updateVisibleTasks((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? { ...candidate, completed: updated.completed }
            : candidate,
        ),
      );
    } catch (error) {
      updateVisibleTasks((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? { ...candidate, completed: task.completed }
            : candidate,
        ),
      );
      setTodoActionError(getAuthErrorMessage(error));
    } finally {
      setPendingTodoIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTask.trim();
    if (!title || todoSaving || todosLoading) return;

    if (!authUserId) {
      setGuestTasks((current) => [
        ...current,
        {
          id: Date.now().toString(),
          title,
          label: "개인",
          estimate: 1,
          completed: false,
          pomodoros: 0,
        },
      ]);
      setNewTask("");
      return;
    }

    setTodoSaving(true);
    setTodoActionError(null);

    try {
      const created = await createTodo({
        title,
        position: tasks.length,
      });
      const createdTask = todoRowToTask(created);
      updateVisibleTasks((current) => [...current, createdTask]);
      setActiveTaskId((current) => current ?? createdTask.id);
      setNewTask("");
    } catch (error) {
      setTodoActionError(getAuthErrorMessage(error));
    } finally {
      setTodoSaving(false);
    }
  }

  async function handleRenameTask(id: string, title: string) {
    const nextTitle = title.trim();
    const task = tasks.find((candidate) => candidate.id === id);
    if (!nextTitle || !task || pendingTodoIds.has(id)) return false;
    if (task.title === nextTitle) return true;

    if (!authUserId) {
      setGuestTasks((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? { ...candidate, title: nextTitle }
            : candidate,
        ),
      );
      return true;
    }

    setTodoActionError(null);
    setPendingTodoIds((current) => new Set(current).add(id));

    try {
      const updated = await updateTodo(id, { title: nextTitle });
      updateVisibleTasks((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? { ...candidate, title: updated.title }
            : candidate,
        ),
      );
      return true;
    } catch (error) {
      setTodoActionError(getAuthErrorMessage(error));
      return false;
    } finally {
      setPendingTodoIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleDeleteTask(id: string) {
    const task = tasks.find((candidate) => candidate.id === id);
    if (!task || pendingTodoIds.has(id)) return false;
    if (
      hasActiveTimerSession &&
      mode === "focus" &&
      activeTaskId === id
    ) {
      setTodoActionError("실행 중인 포모도로를 먼저 완료하거나 취소해 주세요.");
      return false;
    }

    if (!authUserId) {
      setGuestTasks((current) =>
        current.filter((candidate) => candidate.id !== id),
      );
    } else {
      setTodoActionError(null);
      setPendingTodoIds((current) => new Set(current).add(id));

      try {
        await deleteTodo(id);
        updateVisibleTasks((current) =>
          current.filter((candidate) => candidate.id !== id),
        );
      } catch (error) {
        setTodoActionError(getAuthErrorMessage(error));
        return false;
      } finally {
        setPendingTodoIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    }

    if (activeTaskId === id) {
      setActiveTaskId(
        tasks.find((candidate) => candidate.id !== id && !candidate.completed)
          ?.id ?? null,
      );
      setIsRunning(false);
      setRemainingSeconds(timerDurations[mode]);
    }

    return true;
  }

  function handleRetryTodos() {
    setRemoteTodos(null);
    setTodoActionError(null);
    setTodoReloadToken((current) => current + 1);
  }

  async function handleToggleTimer() {
    if (pomodoroPending || pomodoroLoading) return;

    if (isRunning) {
      setIsRunning(false);

      if (!authUserId || !currentPomodoro) return;

      const elapsedSeconds = Math.max(
        0,
        currentPomodoro.planned_seconds - remainingSeconds,
      );
      setPomodoroPending(true);
      setPomodoroError(null);

      try {
        const paused = await pausePomodoro(
          currentPomodoro.id,
          elapsedSeconds,
        );
        const remaining = getPomodoroRemaining(paused);
        setActivePomodoro(paused);
        setRemainingSeconds(remaining);
        remainingSnapshot.current = remaining;
        broadcastPomodoroChange();
      } catch (error) {
        remainingSnapshot.current = remainingSeconds;
        setIsRunning(true);
        setPomodoroError(getAuthErrorMessage(error));
      } finally {
        setPomodoroPending(false);
      }
      return;
    }

    if (hasActiveTimerSession) {
      if (!authUserId || !currentPomodoro) {
        remainingSnapshot.current = remainingSeconds;
        setIsRunning(true);
        return;
      }

      setPomodoroPending(true);
      setPomodoroError(null);

      try {
        const resumed = await resumePomodoro(currentPomodoro.id);
        const remaining = getPomodoroRemaining(resumed);
        setActivePomodoro(resumed);
        setRemainingSeconds(remaining);
        remainingSnapshot.current = remaining;
        setIsRunning(true);
        broadcastPomodoroChange();
      } catch (error) {
        setPomodoroError(getAuthErrorMessage(error));
      } finally {
        setPomodoroPending(false);
      }
      return;
    }

    if (mode === "focus" && !activeTask) return;

    setPomodoroError(null);

    if (!authUserId) {
      setGuestSessionActive(true);
      setIsRunning(true);
      return;
    }

    setPomodoroPending(true);

    try {
      const started = await startPomodoro({
        todoId: mode === "focus" ? (activeTask?.id ?? null) : null,
        mode: pomodoroModes[mode],
        plannedSeconds: timerDurations[mode],
      });
      const nextMode = timerModes[started.mode];
      const remaining = getPomodoroRemaining(started);
      setActivePomodoro(started);
      setMode(nextMode);
      setRemainingSeconds(remaining);
      remainingSnapshot.current = remaining;
      setActiveTaskId((current) =>
        started.mode === "focus" ? started.todo_id : current,
      );
      setIsRunning(started.status === "running");
      broadcastPomodoroChange();
    } catch (error) {
      setPomodoroError(getAuthErrorMessage(error));
    } finally {
      setPomodoroPending(false);
    }
  }

  async function handleResetTimer() {
    if (pomodoroPending) return;

    setIsRunning(false);
    setPomodoroError(null);

    if (!authUserId) {
      setGuestSessionActive(false);
      setRemainingSeconds(timerDurations[mode]);
      return;
    }

    if (!currentPomodoro) {
      setRemainingSeconds(timerDurations[mode]);
      return;
    }

    setPomodoroPending(true);
    const elapsedSeconds = getPomodoroElapsed(currentPomodoro);

    try {
      await cancelPomodoro(currentPomodoro.id, elapsedSeconds);
      setActivePomodoro(null);
      setRemainingSeconds(timerDurations[mode]);
      remainingSnapshot.current = timerDurations[mode];
      broadcastPomodoroChange();
    } catch (error) {
      setPomodoroError(getAuthErrorMessage(error));
    } finally {
      setPomodoroPending(false);
    }
  }

  function handleRetryPomodoro() {
    setPomodoroError(null);
    setPomodoroLoadedForUser(null);
    setPomodoroReloadToken((current) => current + 1);
  }

  function handleSelectTask(id: string) {
    if (hasActiveTimerSession && id !== activeTaskId) return;
    setActiveTaskId(id);
    setMode("focus");
    setRemainingSeconds(timerDurations.focus);
    setIsRunning(false);
  }

  async function handleAuthAction() {
    if (!supabaseConfigured || !authReady || authPending) return;

    setAuthError(null);
    setAuthPending(true);

    try {
      if (authUser) {
        if (currentPomodoro) {
          setIsRunning(false);
          const elapsedSeconds = getPomodoroElapsed(currentPomodoro);
          await cancelPomodoro(currentPomodoro.id, elapsedSeconds);
          setActivePomodoro(null);
          broadcastPomodoroChange();
        }
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
            error={todosError}
            focusLocked={hasActiveTimerSession}
            isLoading={todosLoading}
            isSaving={todoSaving}
            pendingTaskIds={pendingTodoIds}
            newTask={newTask}
            onNewTaskChange={setNewTask}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onRenameTask={handleRenameTask}
            onRetry={handleRetryTodos}
            onToggleTask={handleToggleTask}
            onSelectTask={handleSelectTask}
          />

          <FocusTimer
            activeTask={activeTask}
            error={pomodoroError}
            hasActiveSession={hasActiveTimerSession}
            isPending={pomodoroPending || pomodoroLoading}
            mode={mode}
            remainingSeconds={remainingSeconds}
            totalSeconds={timerDurations[mode]}
            todayCompletedSessions={todayCompletedSessions}
            todayFocusSeconds={todayFocusSeconds}
            isRunning={isRunning}
            onModeChange={handleModeChange}
            onRetry={handleRetryPomodoro}
            onToggleRunning={handleToggleTimer}
            onReset={handleResetTimer}
          />
        </div>
      </div>
    </main>
  );
}
