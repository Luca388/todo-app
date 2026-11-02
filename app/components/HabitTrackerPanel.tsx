"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { formatDateKey, getLocalDateKey } from "../task-dates";
import type { Habit, HabitCompletion } from "../types";

type HabitTrackerPanelProps = {
  completions: HabitCompletion[];
  error: string | null;
  habits: Habit[];
  isLoading: boolean;
  isOpen: boolean;
  isSaving: boolean;
  onAddHabit: (name: string) => Promise<boolean>;
  onClose: () => void;
  onDeleteHabit: (id: string) => Promise<boolean>;
  onRetry: () => void;
  onToggleHabit: (
    habitId: string,
    date: string,
    completed: boolean,
  ) => Promise<boolean>;
};

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

function completionKey(habitId: string, date: string) {
  return `${habitId}\u0000${date}`;
}

function getStreak(
  habitId: string,
  selectedDate: string,
  completedKeys: ReadonlySet<string>,
) {
  let streak = 0;
  let cursor = dateFromKey(selectedDate);

  while (
    completedKeys.has(completionKey(habitId, getLocalDateKey(cursor)))
  ) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function HabitTrackerPanel({
  completions,
  error,
  habits,
  isLoading,
  isOpen,
  isSaving,
  onAddHabit,
  onClose,
  onDeleteHabit,
  onRetry,
  onToggleHabit,
}: HabitTrackerPanelProps) {
  const todayKey = getLocalDateKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [draftName, setDraftName] = useState("");
  const completedKeys = useMemo(
    () =>
      new Set(
        completions.map((completion) =>
          completionKey(completion.habitId, completion.date),
        ),
      ),
    [completions],
  );
  const selectedDateObject = dateFromKey(selectedDate);
  const weekStart = startOfWeek(selectedDateObject);
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  const selectedCompletedCount = habits.filter((habit) =>
    completedKeys.has(completionKey(habit.id, selectedDate)),
  ).length;
  const progress =
    habits.length === 0
      ? 0
      : Math.round((selectedCompletedCount / habits.length) * 100);
  const nextWeekDate = addDays(selectedDateObject, 7);
  const canMoveNext = getLocalDateKey(startOfWeek(nextWeekDate)) <= todayKey;

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftName.trim();
    if (!name || isSaving) return;
    const saved = await onAddHabit(name);
    if (saved) setDraftName("");
  }

  async function handleDelete(habit: Habit) {
    const confirmed = window.confirm(
      `"${habit.name}" 습관과 모든 체크 기록을 삭제할까요?`,
    );
    if (!confirmed) return;
    await onDeleteHabit(habit.id);
  }

  if (!isOpen) return null;

  return (
    <div
      className="calendar-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="habit-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-title"
      >
        <header className="calendar-panel-header">
          <h2 id="habit-title">습관 트래커</h2>
          <button type="button" onClick={onClose} aria-label="습관 트래커 닫기">
            ×
          </button>
        </header>

        <div className="habit-content">
          <section className="habit-overview" aria-label="선택한 날짜의 습관 진행률">
            <div>
              <span>{formatDateKey(selectedDate)}</span>
              <strong>
                {selectedCompletedCount}/{habits.length} 완료
              </strong>
            </div>
            <div
              className="habit-progress-ring"
              style={{ "--habit-progress": `${progress}%` } as CSSProperties}
              aria-label={`습관 ${progress}% 완료`}
            >
              <span>{progress}%</span>
            </div>
          </section>

          <section className="habit-week" aria-label="습관 날짜 선택">
            <div className="habit-week-nav">
              <button
                type="button"
                onClick={() =>
                  setSelectedDate(
                    getLocalDateKey(addDays(selectedDateObject, -7)),
                  )
                }
                aria-label="이전 주"
              >
                ←
              </button>
              <strong>
                {weekStart.getFullYear()}년 {weekStart.getMonth() + 1}월
              </strong>
              <button
                type="button"
                onClick={() =>
                  setSelectedDate(
                    getLocalDateKey(addDays(selectedDateObject, 7)),
                  )
                }
                disabled={!canMoveNext}
                aria-label="다음 주"
              >
                →
              </button>
            </div>

            <div className="habit-week-days">
              {weekDays.map((date) => {
                const key = getLocalDateKey(date);
                const isFuture = key > todayKey;
                return (
                  <button
                    className={[
                      key === selectedDate ? "is-selected" : "",
                      key === todayKey ? "is-today" : "",
                    ].join(" ")}
                    type="button"
                    key={key}
                    onClick={() => setSelectedDate(key)}
                    disabled={isFuture}
                    aria-label={formatDateKey(key)}
                  >
                    <span>
                      {["일", "월", "화", "수", "목", "금", "토"][date.getDay()]}
                    </span>
                    <strong>{date.getDate()}</strong>
                  </button>
                );
              })}
            </div>
          </section>

          <form className="habit-add-form" onSubmit={handleAdd}>
            <label className="sr-only" htmlFor="new-habit">
              새 습관
            </label>
            <input
              id="new-habit"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="매일 이어가고 싶은 습관"
              maxLength={100}
              disabled={isSaving || isLoading || Boolean(error)}
            />
            <button
              type="submit"
              disabled={
                isSaving || isLoading || Boolean(error) || !draftName.trim()
              }
            >
              {isSaving ? "저장 중…" : "습관 추가"}
            </button>
          </form>

          {isLoading && (
            <div className="habit-state" role="status">
              습관 기록을 불러오고 있어요…
            </div>
          )}

          {!isLoading && error && (
            <div className="habit-state is-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={onRetry}>
                다시 시도
              </button>
            </div>
          )}

          {!isLoading && !error && habits.length === 0 && (
            <div className="habit-state">
              첫 습관을 추가하고 오늘부터 체크해 보세요.
            </div>
          )}

          {!isLoading && !error && habits.length > 0 && (
            <div className="habit-list">
              {habits.map((habit) => {
                const isCompleted = completedKeys.has(
                  completionKey(habit.id, selectedDate),
                );
                const streak = getStreak(
                  habit.id,
                  selectedDate,
                  completedKeys,
                );
                return (
                  <article
                    className={`habit-row ${isCompleted ? "is-complete" : ""}`}
                    key={habit.id}
                  >
                    <button
                      className="habit-check"
                      type="button"
                      onClick={() =>
                        void onToggleHabit(
                          habit.id,
                          selectedDate,
                          !isCompleted,
                        )
                      }
                      disabled={isSaving}
                      aria-label={`${habit.name} ${isCompleted ? "체크 해제" : "완료 체크"}`}
                    >
                      <span aria-hidden="true">{isCompleted ? "✓" : ""}</span>
                    </button>
                    <div>
                      <strong>{habit.name}</strong>
                      <small>
                        {streak > 0 ? `연속 ${streak}일` : "오늘부터 시작"}
                      </small>
                    </div>
                    <button
                      className="habit-delete"
                      type="button"
                      onClick={() => void handleDelete(habit)}
                      disabled={isSaving}
                    >
                      삭제
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
