import type { CSSProperties } from "react";
import type { Task, TimerMode } from "../types";

type FocusTimerProps = {
  activeTask: Task | undefined;
  mode: TimerMode;
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  onModeChange: (mode: TimerMode) => void;
  onToggleRunning: () => void;
  onReset: () => void;
};

const modeLabels: Record<TimerMode, string> = {
  focus: "집중",
  short: "짧은 휴식",
  long: "긴 휴식",
};

function formatTime(value: number) {
  const minutes = Math.floor(value / 60).toString().padStart(2, "0");
  const seconds = (value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function FocusTimer({
  activeTask,
  mode,
  remainingSeconds,
  totalSeconds,
  isRunning,
  onModeChange,
  onToggleRunning,
  onReset,
}: FocusTimerProps) {
  const elapsedRatio = (totalSeconds - remainingSeconds) / totalSeconds;
  const timerStyle = {
    "--timer-progress": `${Math.max(0.02, elapsedRatio) * 360}deg`,
  } as CSSProperties;

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
              onClick={() => onModeChange(key)}
              disabled={isRunning}
            >
              {modeLabels[key]}
            </button>
          ))}
        </div>

        <div className="timer-ring" style={timerStyle}>
          <div className="timer-face">
            <span>{mode === "focus" ? "FOCUS" : "BREAK"}</span>
            <strong>{formatTime(remainingSeconds)}</strong>
            <small>{isRunning ? "집중하고 있어요" : "준비되면 시작하세요"}</small>
          </div>
        </div>

        <div className="timer-task">
          <span>지금 집중할 일</span>
          <strong>{activeTask?.title ?? "목록에서 할 일을 선택하세요"}</strong>
        </div>

        <div className="timer-actions">
          <button className="reset-button" type="button" onClick={onReset} aria-label="타이머 초기화">↺</button>
          <button
            className="start-button"
            type="button"
            onClick={onToggleRunning}
            disabled={!activeTask && mode === "focus"}
          >
            <span aria-hidden="true">{isRunning ? "Ⅱ" : "▶"}</span>
            {isRunning ? "잠시 멈춤" : "집중 시작"}
          </button>
          <button className="sound-button" type="button" aria-label="타이머 소리 켜기">♪</button>
        </div>
      </section>

      <div className="focus-summary">
        <div>
          <span>오늘 집중</span>
          <strong>1시간 15분</strong>
        </div>
        <div>
          <span>완료 세션</span>
          <strong>3회</strong>
        </div>
      </div>

      <blockquote>
        “작은 집중이 모여<br />큰 하루를 만들어요.”
      </blockquote>
    </aside>
  );
}
