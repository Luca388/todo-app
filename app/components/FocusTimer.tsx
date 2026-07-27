import {
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { Task, TimerMode } from "../types";

type FocusTimerProps = {
  activeTask: Task | undefined;
  autoStartFocus: boolean;
  autoStartRest: boolean;
  browserNotificationsEnabled: boolean;
  browserNotificationsSupported: boolean;
  error: string | null;
  hasActiveSession: boolean;
  isPending: boolean;
  mode: TimerMode;
  notificationMessage: string | null;
  remainingSeconds: number;
  repeatCount: number;
  soundEnabled: boolean;
  currentRound: number;
  totalSeconds: number;
  todayCompletedSessions: number;
  todayFocusSeconds: number;
  isRunning: boolean;
  onAutoStartFocusChange: (enabled: boolean) => void;
  onAutoStartRestChange: (enabled: boolean) => void;
  onBrowserNotificationsEnabledChange: (
    enabled: boolean,
  ) => void | Promise<void>;
  onDurationChange: (seconds: number) => void;
  onModeChange: (mode: TimerMode) => void;
  onRepeatCountChange: (count: number) => void;
  onRetry: () => void;
  onSkip: () => void;
  onSoundEnabledChange: (enabled: boolean) => void;
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
  autoStartFocus,
  autoStartRest,
  browserNotificationsEnabled,
  browserNotificationsSupported,
  error,
  hasActiveSession,
  isPending,
  mode,
  notificationMessage,
  remainingSeconds,
  repeatCount,
  soundEnabled,
  currentRound,
  totalSeconds,
  todayCompletedSessions,
  todayFocusSeconds,
  isRunning,
  onAutoStartFocusChange,
  onAutoStartRestChange,
  onBrowserNotificationsEnabledChange,
  onDurationChange,
  onModeChange,
  onRepeatCountChange,
  onRetry,
  onSkip,
  onSoundEnabledChange,
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
      <header className="focus-heading">
        <div>
          <p className="eyebrow">TIMER</p>
          <h2 id="focus-title">집중 타이머</h2>
        </div>
        <span
          className={`timer-status ${isRunning ? "is-running" : ""}`}
        >
          <span aria-hidden="true" />
          {isPending
            ? "저장 중"
            : isRunning
              ? "진행 중"
              : hasActiveSession
                ? "일시정지"
                : "준비"}
        </span>
      </header>

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

        <div className="repeat-control">
          <div>
            <span>집중 반복</span>
            <small>
              {currentRound} / {repeatCount}회
            </small>
          </div>
          <div className="repeat-stepper" aria-label="집중 반복 횟수">
            <button
              type="button"
              onClick={() => onRepeatCountChange(repeatCount - 1)}
              disabled={hasActiveSession || isPending || repeatCount <= 1}
              aria-label="반복 횟수 줄이기"
            >
              −
            </button>
            <output aria-live="polite">{repeatCount}회</output>
            <button
              type="button"
              onClick={() => onRepeatCountChange(repeatCount + 1)}
              disabled={hasActiveSession || isPending || repeatCount >= 99}
              aria-label="반복 횟수 늘리기"
            >
              ＋
            </button>
          </div>
        </div>

        <div className="timer-preferences">
          <section className="preference-group" aria-labelledby="alerts-title">
            <div>
              <strong id="alerts-title">알림</strong>
              <small>종료와 자동 시작을 알려드려요</small>
            </div>
            <div className="preference-toggles">
              <button
                className={soundEnabled ? "is-active" : ""}
                type="button"
                role="switch"
                aria-checked={soundEnabled}
                onClick={() => onSoundEnabledChange(!soundEnabled)}
              >
                <span aria-hidden="true" />
                소리
              </button>
              <button
                className={browserNotificationsEnabled ? "is-active" : ""}
                type="button"
                role="switch"
                aria-checked={browserNotificationsEnabled}
                onClick={() =>
                  void onBrowserNotificationsEnabledChange(
                    !browserNotificationsEnabled,
                  )
                }
                disabled={!browserNotificationsSupported}
                title={
                  browserNotificationsSupported
                    ? undefined
                    : "이 브라우저에서는 알림을 사용할 수 없습니다"
                }
              >
                <span aria-hidden="true" />
                브라우저
              </button>
            </div>
          </section>

          <section
            className="preference-group"
            aria-labelledby="auto-start-title"
          >
            <div>
              <strong id="auto-start-title">자동 시작</strong>
              <small>끄면 다음 단계에서 확인 후 시작해요</small>
            </div>
            <div className="preference-toggles">
              <button
                className={autoStartRest ? "is-active" : ""}
                type="button"
                role="switch"
                aria-checked={autoStartRest}
                onClick={() => onAutoStartRestChange(!autoStartRest)}
              >
                <span aria-hidden="true" />
                휴식
              </button>
              <button
                className={autoStartFocus ? "is-active" : ""}
                type="button"
                role="switch"
                aria-checked={autoStartFocus}
                onClick={() => onAutoStartFocusChange(!autoStartFocus)}
              >
                <span aria-hidden="true" />
                다음 집중
              </button>
            </div>
          </section>
        </div>

        {notificationMessage && (
          <p className="preference-message" role="status">
            {notificationMessage}
          </p>
        )}

        <div className="timer-ring" style={timerStyle}>
          <div className="timer-face">
            <span>{mode === "focus" ? "집중" : "휴식"}</span>
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
                  ? mode === "focus"
                    ? "집중하고 있어요"
                    : "쉬고 있어요"
                  : hasActiveSession
                    ? "일시정지됨"
                    : "시간을 누르면 변경할 수 있어요"}
            </small>
          </div>
        </div>

        <div className="timer-task">
          <span>{mode === "focus" ? "선택한 할 일" : "현재 모드"}</span>
          <strong>
            {mode === "focus"
              ? (activeTask?.title ?? "목록에서 할 일을 선택하세요")
              : "잠시 쉬어가기"}
          </strong>
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
            <span aria-hidden="true">↺</span>
            {hasActiveSession ? "취소" : "초기화"}
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
            className="skip-button"
            type="button"
            onClick={() => {
              setIsEditingDuration(false);
              onSkip();
            }}
            disabled={isPending}
            aria-label={`${mode === "focus" ? "휴식" : "집중"} 모드로 건너뛰기`}
          >
            건너뛰기
            <span aria-hidden="true">→</span>
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
