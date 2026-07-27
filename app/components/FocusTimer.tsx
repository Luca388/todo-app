import {
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { Task, TimerMode } from "../types";

type FocusTimerProps = {
  activeTask: Task | undefined;
  error: string | null;
  hasActiveSession: boolean;
  isPending: boolean;
  mode: TimerMode;
  remainingSeconds: number;
  totalSeconds: number;
  todayCompletedSessions: number;
  todayFocusSeconds: number;
  isRunning: boolean;
  onDurationChange: (seconds: number) => void;
  onModeChange: (mode: TimerMode) => void;
  onRetry: () => void;
  onToggleRunning: () => void;
  onReset: () => void;
};

const modeLabels: Record<TimerMode, string> = {
  focus: "집중",
  rest: "휴식",
};

function formatTime(value: number) {
  const minutes = Math.floor(value / 60).toString().padStart(2, "0");
  const seconds = (value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatDuration(value: number) {
  const totalMinutes = Math.floor(value / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

export function FocusTimer({
  activeTask,
  error,
  hasActiveSession,
  isPending,
  mode,
  remainingSeconds,
  totalSeconds,
  todayCompletedSessions,
  todayFocusSeconds,
  isRunning,
  onDurationChange,
  onModeChange,
  onRetry,
  onToggleRunning,
  onReset,
}: FocusTimerProps) {
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [draftMinutes, setDraftMinutes] = useState("");
  const elapsedRatio = (totalSeconds - remainingSeconds) / totalSeconds;
  const showDurationEditor =
    isEditingDuration && !hasActiveSession && !isPending;
  const timerStyle = {
    "--timer-progress": `${Math.max(0.02, elapsedRatio) * 360}deg`,
  } as CSSProperties;

  function openDurationEditor() {
    if (hasActiveSession || isPending) return;
    setDraftMinutes(String(Math.max(1, Math.round(totalSeconds / 60))));
    setIsEditingDuration(true);
  }

  function saveDuration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedMinutes = Number.parseInt(draftMinutes, 10);
    if (!Number.isFinite(parsedMinutes)) return;

    const minutes = Math.min(Math.max(parsedMinutes, 1), 1440);
    onDurationChange(minutes * 60);
    setDraftMinutes(String(minutes));
    setIsEditingDuration(false);
  }

  function handleDurationKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsEditingDuration(false);
    }
  }

  return (
    <aside className="focus-column" aria-labelledby="focus-title">
      <div className="focus-topbar">
        <span className="live-dot" aria-hidden="true" />
        <span>집중 공간</span>
        <button type="button" aria-label="집중 설정">•••</button>
      </div>

      <section className="timer-card">
        <div className="mode-tabs" aria-label="타이머 모드">
          {(Object.keys(modeLabels) as TimerMode[]).map((key) => (
            <button
              className={mode === key ? "is-active" : ""}
              type="button"
              key={key}
              onClick={() => {
                setIsEditingDuration(false);
                onModeChange(key);
              }}
              disabled={isRunning || hasActiveSession || isPending}
            >
              {modeLabels[key]}
            </button>
          ))}
        </div>

        <div className="timer-ring" style={timerStyle}>
          <div className="timer-face">
            <span>{mode === "focus" ? "FOCUS" : "BREAK"}</span>
            {showDurationEditor ? (
              <form
                className="timer-duration-editor"
                onSubmit={saveDuration}
              >
                <label>
                  <span className="sr-only">타이머 시간(분)</span>
                  <input
                    autoFocus
                    inputMode="numeric"
                    max={1440}
                    min={1}
                    onChange={(event) => setDraftMinutes(event.target.value)}
                    onKeyDown={handleDurationKeyDown}
                    type="number"
                    value={draftMinutes}
                  />
                  <span>분</span>
                </label>
                <button type="submit">저장</button>
              </form>
            ) : (
              <button
                className="timer-time-button"
                type="button"
                onClick={openDurationEditor}
                disabled={hasActiveSession || isPending}
                aria-label={`${formatTime(remainingSeconds)}, 시간 변경`}
              >
                <strong>{formatTime(remainingSeconds)}</strong>
              </button>
            )}
            <small>
              {isPending
                ? "기록을 저장하고 있어요"
                : isRunning
                  ? "집중하고 있어요"
                  : hasActiveSession
                    ? "일시정지됨"
                    : "시간을 누르면 변경할 수 있어요"}
            </small>
          </div>
        </div>

        <div className="timer-task">
          <span>지금 집중할 일</span>
          <strong>{activeTask?.title ?? "목록에서 할 일을 선택하세요"}</strong>
        </div>

        <div className="timer-actions">
          <button
            className="reset-button"
            type="button"
            onClick={() => {
              setIsEditingDuration(false);
              onReset();
            }}
            disabled={isPending}
            aria-label={hasActiveSession ? "실행 중인 세션 취소" : "타이머 초기화"}
          >
            ↺
          </button>
          <button
            className="start-button"
            type="button"
            onClick={() => {
              setIsEditingDuration(false);
              onToggleRunning();
            }}
            disabled={
              isPending ||
              (!activeTask && mode === "focus" && !hasActiveSession)
            }
          >
            <span aria-hidden="true">{isRunning ? "Ⅱ" : "▶"}</span>
            {isPending
              ? "저장 중…"
              : isRunning
                ? "잠시 멈춤"
                : hasActiveSession
                  ? "계속하기"
                  : mode === "focus"
                    ? "집중 시작"
                    : "휴식 시작"}
          </button>
          <button
            className="sound-button"
            type="button"
            aria-label="타이머 소리 켜기"
            disabled={isPending}
          >
            ♪
          </button>
        </div>

        {error && (
          <div className="timer-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onRetry} disabled={isPending}>
              다시 시도
            </button>
          </div>
        )}
      </section>

      <div className="focus-summary">
        <div>
          <span>오늘 집중</span>
          <strong>{formatDuration(todayFocusSeconds)}</strong>
        </div>
        <div>
          <span>완료 세션</span>
          <strong>{todayCompletedSessions}회</strong>
        </div>
      </div>
    </aside>
  );
}
