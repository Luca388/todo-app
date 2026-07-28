"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  formatDateKey,
  getDueDateKey,
  getLocalDateKey,
} from "../task-dates";
import type {
  FocusHistoryEntry,
  Task,
  TodoList,
} from "../types";

type CalendarPanelProps = {
  activeTaskId: string | null;
  activeListId: string;
  error: string | null;
  focusLocked: boolean;
  focusHistory: FocusHistoryEntry[];
  isOpen: boolean;
  isSaving: boolean;
  lists: TodoList[];
  tasks: Task[];
  onAddTask: (
    title: string,
    dueDate: string,
    listId: string,
  ) => Promise<boolean>;
  onClose: () => void;
  onOpenTask: (id: string) => void;
  onSelectTask: (id: string) => void;
};

function startOfCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());
  start.setHours(12, 0, 0, 0);
  return start;
}

function formatFocusDuration(seconds: number) {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

export function CalendarPanel({
  activeTaskId,
  activeListId,
  error,
  focusLocked,
  focusHistory,
  isOpen,
  isSaving,
  lists,
  tasks,
  onAddTask,
  onClose,
  onOpenTask,
  onSelectTask,
}: CalendarPanelProps) {
  const todayKey = getLocalDateKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [draftTitle, setDraftTitle] = useState("");
  const [draftListId, setDraftListId] = useState(activeListId);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const days = useMemo(() => {
    const start = startOfCalendarGrid(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
    );
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        date,
        key: getLocalDateKey(date),
      };
    });
  }, [visibleMonth]);

  const taskCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      const dateKey = getDueDateKey(task.dueAt);
      if (dateKey) counts[dateKey] = (counts[dateKey] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  const focusSecondsByDate = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const session of focusHistory) {
      const dateKey = getLocalDateKey(new Date(session.endedAt));
      totals[dateKey] = (totals[dateKey] ?? 0) + session.elapsedSeconds;
    }
    return totals;
  }, [focusHistory]);

  const selectedTasks = tasks
    .filter((task) => getDueDateKey(task.dueAt) === selectedDate)
    .sort(
      (left, right) => Number(left.completed) - Number(right.completed),
    );
  const completedOnSelectedDate = selectedTasks.filter(
    (task) => task.completed,
  );
  const selectedFocusSeconds = focusSecondsByDate[selectedDate] ?? 0;
  const effectiveDraftListId = lists.some(
    (list) => list.id === draftListId,
  )
    ? draftListId
    : lists.some((list) => list.id === activeListId)
      ? activeListId
      : (lists[0]?.id ?? "");
  const selectedList = lists.find(
    (list) => list.id === effectiveDraftListId,
  );

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draftTitle.trim();
    if (!title || !effectiveDraftListId || isSaving) return;
    setSubmitMessage(null);
    const saved = await onAddTask(
      title,
      selectedDate,
      effectiveDraftListId,
    );
    if (saved) {
      setDraftTitle("");
      setSubmitMessage("이날의 할 일에 추가했습니다.");
    } else {
      setSubmitMessage("할 일을 추가하지 못했습니다.");
    }
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
        className="calendar-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-title"
      >
        <header className="calendar-panel-header">
          <div>
            <p className="eyebrow">SCHEDULE</p>
            <h2 id="calendar-title">일정</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="캘린더 닫기">
            ×
          </button>
        </header>

        <div className="calendar-layout">
          <div className="calendar-main">
            <div className="calendar-month-nav">
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth() - 1,
                      1,
                    ),
                  )
                }
                aria-label="이전 달"
              >
                ←
              </button>
              <strong>
                {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
              </strong>
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth() + 1,
                      1,
                    ),
                  )
                }
                aria-label="다음 달"
              >
                →
              </button>
            </div>

            <div className="calendar-weekdays" aria-hidden="true">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {days.map(({ date, key }) => {
                const isCurrentMonth =
                  date.getMonth() === visibleMonth.getMonth();
                const isSelected = key === selectedDate;
                const taskCount = taskCountByDate[key] ?? 0;
                const hasFocus = (focusSecondsByDate[key] ?? 0) > 0;

                return (
                  <button
                    className={[
                      "calendar-day",
                      isCurrentMonth ? "" : "is-outside",
                      isSelected ? "is-selected" : "",
                      key === todayKey ? "is-today" : "",
                    ].join(" ")}
                    type="button"
                    key={key}
                    onClick={() => {
                      setSelectedDate(key);
                      setSubmitMessage(null);
                    }}
                    aria-label={`${formatDateKey(key)}, 할 일 ${taskCount}개`}
                  >
                    <span>{date.getDate()}</span>
                    <small>
                      {taskCount > 0 && <b>{taskCount}</b>}
                      {hasFocus && <i aria-label="집중 기록 있음" />}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="calendar-detail">
            <div className="calendar-selected-date">
              <span>선택한 날짜</span>
              <strong>{formatDateKey(selectedDate)}</strong>
            </div>

            <div className="calendar-stats">
              <div>
                <span>집중한 시간</span>
                <strong>{formatFocusDuration(selectedFocusSeconds)}</strong>
              </div>
              <div>
                <span>완료한 작업</span>
                <strong>{completedOnSelectedDate.length}개</strong>
              </div>
            </div>

            <form className="calendar-add-task" onSubmit={handleAddTask}>
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="이 날짜에 할 일 추가"
                maxLength={300}
                disabled={isSaving}
              />
              <select
                value={effectiveDraftListId}
                onChange={(event) => setDraftListId(event.target.value)}
                disabled={isSaving}
                aria-label="추가할 리스트"
              >
                {lists.map((list) => (
                  <option value={list.id} key={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={isSaving || !draftTitle.trim()}>
                {isSaving ? "추가 중…" : "추가"}
              </button>
            </form>
            {(error || submitMessage) && (
              <p
                className={`calendar-action-message ${error ? "is-error" : ""}`}
                role={error ? "alert" : "status"}
              >
                {error ?? submitMessage}
              </p>
            )}

            <div className="calendar-day-tasks">
              <div className="calendar-detail-heading">
                <strong>이날의 할 일</strong>
                <span>{selectedTasks.length}</span>
              </div>
              {selectedTasks.length === 0 ? (
                <p>등록된 할 일이 없습니다.</p>
              ) : (
                selectedTasks.map((task) => (
                  <div
                    className={`calendar-task-row ${task.completed ? "is-complete" : ""}`}
                    key={task.id}
                  >
                    <button
                      className="calendar-task-select"
                      type="button"
                      onClick={() => onSelectTask(task.id)}
                      disabled={
                        task.completed ||
                        (focusLocked && task.id !== activeTaskId)
                      }
                    >
                      <span aria-hidden="true">
                        {task.completed ? "✓" : "○"}
                      </span>
                      <span>
                        <strong>{task.title}</strong>
                        <small>
                          {lists.find((list) => list.id === task.listId)?.name ??
                            selectedList?.name ??
                            "todo 리스트"}
                        </small>
                      </span>
                    </button>
                    <button
                      className="calendar-task-detail"
                      type="button"
                      onClick={() => onOpenTask(task.id)}
                      aria-label={`${task.title} 상세 열기`}
                    >
                      상세
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
