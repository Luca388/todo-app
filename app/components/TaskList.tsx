"use client";

import { useState, type FormEvent } from "react";
import {
  formatDateKey,
  getDueDateKey,
  getLocalDateKey,
  getTaskDateStatus,
} from "../task-dates";
import type { Task } from "../types";

type TaskFilter =
  | "all"
  | "today"
  | "upcoming"
  | "overdue"
  | "active"
  | "completed";

type TaskListProps = {
  tasks: Task[];
  activeTaskId: string | null;
  error: string | null;
  focusLocked: boolean;
  isLoading: boolean;
  isSaving: boolean;
  pendingTaskIds: ReadonlySet<string>;
  newTask: string;
  newTaskDueDate: string;
  onNewTaskChange: (value: string) => void;
  onNewTaskDueDateChange: (value: string) => void;
  onAddTask: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDeleteTask: (id: string) => Promise<boolean>;
  onUpdateTask: (
    id: string,
    title: string,
    dueDate: string,
  ) => Promise<boolean>;
  onRetry: () => void;
  onToggleTask: (id: string) => void;
  onSelectTask: (id: string) => void;
};

export function TaskList({
  tasks,
  activeTaskId,
  error,
  focusLocked,
  isLoading,
  isSaving,
  pendingTaskIds,
  newTask,
  newTaskDueDate,
  onNewTaskChange,
  onNewTaskDueDateChange,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
  onRetry,
  onToggleTask,
  onSelectTask,
}: TaskListProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const todayKey = getLocalDateKey();
  const remaining = tasks.filter((task) => !task.completed).length;
  const completed = tasks.length - remaining;
  const today = tasks.filter(
    (task) =>
      !task.completed &&
      getTaskDateStatus(task.dueAt, todayKey) === "today",
  ).length;
  const upcoming = tasks.filter(
    (task) =>
      !task.completed &&
      getTaskDateStatus(task.dueAt, todayKey) === "upcoming",
  ).length;
  const overdue = tasks.filter(
    (task) =>
      !task.completed &&
      getTaskDateStatus(task.dueAt, todayKey) === "overdue",
  ).length;
  const orderedTasks = [...tasks].sort(
    (left, right) => Number(left.completed) - Number(right.completed),
  );
  const visibleTasks = orderedTasks.filter((task) => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    if (filter === "today") {
      return (
        !task.completed &&
        getTaskDateStatus(task.dueAt, todayKey) === "today"
      );
    }
    if (filter === "upcoming") {
      return (
        !task.completed &&
        getTaskDateStatus(task.dueAt, todayKey) === "upcoming"
      );
    }
    if (filter === "overdue") {
      return (
        !task.completed &&
        getTaskDateStatus(task.dueAt, todayKey) === "overdue"
      );
    }
    return true;
  });

  async function handleUpdateSubmit(
    event: FormEvent<HTMLFormElement>,
    id: string,
  ) {
    event.preventDefault();
    const saved = await onUpdateTask(id, editingTitle, editingDueDate);
    if (saved) {
      setEditingTaskId(null);
      setEditingTitle("");
      setEditingDueDate("");
    }
  }

  async function handleDelete(task: Task) {
    const confirmed = window.confirm(
      `"${task.title}" 할 일을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;

    const deleted = await onDeleteTask(task.id);
    if (deleted && editingTaskId === task.id) {
      setEditingTaskId(null);
      setEditingTitle("");
      setEditingDueDate("");
    }
  }

  return (
    <section className="tasks-panel" aria-labelledby="today-title">
      <header className="content-heading">
        <div>
          <p className="eyebrow">TASKS</p>
          <h2 id="today-title">할 일</h2>
          <p className="heading-note">
            할 일을 선택하면 집중 타이머에 바로 연결됩니다.
          </p>
        </div>
        <span className="remaining-pill">{remaining}개 남음</span>
      </header>

      <form className="task-composer" onSubmit={onAddTask}>
        <span className="composer-plus" aria-hidden="true">＋</span>
        <label className="sr-only" htmlFor="new-task">새 할 일</label>
        <input
          id="new-task"
          value={newTask}
          onChange={(event) => onNewTaskChange(event.target.value)}
          placeholder="새로운 할 일을 적어보세요"
          autoComplete="off"
          disabled={isLoading || isSaving}
        />
        <label className="composer-date">
          <span className="sr-only">할 일 날짜</span>
          <input
            aria-label="할 일 날짜"
            type="date"
            value={newTaskDueDate}
            onChange={(event) => onNewTaskDueDateChange(event.target.value)}
            disabled={isLoading || isSaving}
          />
        </label>
        <button type="submit" disabled={isLoading || isSaving}>
          {isSaving ? "저장 중…" : "추가"}
        </button>
      </form>

      <div className="task-section-heading">
        <div className="task-filters" aria-label="할 일 필터">
          <button
            className={filter === "all" ? "is-active" : ""}
            type="button"
            onClick={() => setFilter("all")}
          >
            전체 <span>{tasks.length}</span>
          </button>
          <button
            className={filter === "today" ? "is-active" : ""}
            type="button"
            onClick={() => setFilter("today")}
          >
            오늘 <span>{today}</span>
          </button>
          <button
            className={filter === "upcoming" ? "is-active" : ""}
            type="button"
            onClick={() => setFilter("upcoming")}
          >
            예정 <span>{upcoming}</span>
          </button>
          <button
            className={filter === "overdue" ? "is-active" : ""}
            type="button"
            onClick={() => setFilter("overdue")}
          >
            기한 지남 <span>{overdue}</span>
          </button>
          <button
            className={filter === "active" ? "is-active" : ""}
            type="button"
            onClick={() => setFilter("active")}
          >
            진행 중 <span>{remaining}</span>
          </button>
          <button
            className={filter === "completed" ? "is-active" : ""}
            type="button"
            onClick={() => setFilter("completed")}
          >
            완료 <span>{completed}</span>
          </button>
        </div>
      </div>

      <div className="task-list">
        {isLoading && (
          <div className="task-state" role="status">
            Supabase에서 할 일을 불러오고 있어요…
          </div>
        )}

        {!isLoading && error && (
          <div className="task-state is-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onRetry}>다시 시도</button>
          </div>
        )}

        {!isLoading && !error && tasks.length === 0 && (
          <div className="task-state">
            아직 할 일이 없어요. 첫 할 일을 추가해 보세요.
          </div>
        )}

        {!isLoading &&
          !error &&
          tasks.length > 0 &&
          visibleTasks.length === 0 && (
            <div className="task-state">
              이 필터에 표시할 할 일이 없습니다.
            </div>
          )}

        {visibleTasks.map((task) => {
          const isActive = activeTaskId === task.id;
          const isPending = pendingTaskIds.has(task.id);
          const isEditing = editingTaskId === task.id;
          const dueDateKey = getDueDateKey(task.dueAt);
          const dateStatus = getTaskDateStatus(task.dueAt, todayKey);

          return (
            <article
              className={`task-item ${task.completed ? "is-complete" : ""} ${isActive ? "is-active" : ""} ${isEditing ? "is-editing" : ""}`}
              key={task.id}
            >
              <label className="task-check-wrap">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => onToggleTask(task.id)}
                  disabled={
                    isPending || isEditing || (focusLocked && isActive)
                  }
                />
                <span className="custom-check" aria-hidden="true">✓</span>
                <span className="sr-only">{task.title} 완료</span>
              </label>

              {isEditing ? (
                <form
                  className="task-edit-form"
                  onSubmit={(event) => handleUpdateSubmit(event, task.id)}
                >
                  <label className="sr-only" htmlFor={`edit-task-${task.id}`}>
                    할 일 제목 수정
                  </label>
                  <input
                    id={`edit-task-${task.id}`}
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    maxLength={300}
                    autoFocus
                    disabled={isPending}
                  />
                  <label className="task-edit-date">
                    <span className="sr-only">할 일 날짜 수정</span>
                    <input
                      aria-label="할 일 날짜 수정"
                      type="date"
                      value={editingDueDate}
                      onChange={(event) =>
                        setEditingDueDate(event.target.value)
                      }
                      disabled={isPending}
                    />
                  </label>
                  <button type="submit" disabled={isPending || !editingTitle.trim()}>
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTaskId(null);
                      setEditingTitle("");
                      setEditingDueDate("");
                    }}
                    disabled={isPending}
                  >
                    취소
                  </button>
                </form>
              ) : (
                <>
                  <button
                    className="task-copy"
                    type="button"
                    onClick={() => onSelectTask(task.id)}
                    disabled={
                      task.completed ||
                      isPending ||
                      (focusLocked && !isActive)
                    }
                  >
                    <strong>{task.title}</strong>
                    {dueDateKey && (
                      <span className={`task-date is-${dateStatus}`}>
                        {dateStatus === "today"
                          ? "오늘"
                          : dateStatus === "overdue" && !task.completed
                            ? `기한 지남 · ${formatDateKey(dueDateKey)}`
                            : formatDateKey(dueDateKey)}
                      </span>
                    )}
                  </button>

                  <div className="task-row-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setEditingTitle(task.title);
                        setEditingDueDate(dueDateKey ?? "");
                      }}
                      disabled={isPending}
                    >
                      수정
                    </button>
                    <button
                      className="is-danger"
                      type="button"
                      onClick={() => handleDelete(task)}
                      disabled={isPending || (focusLocked && isActive)}
                    >
                      삭제
                    </button>
                  </div>

                  <button
                    className={`focus-task-button ${isActive ? "is-selected" : ""}`}
                    type="button"
                    onClick={() => onSelectTask(task.id)}
                    disabled={task.completed || isPending || focusLocked}
                    aria-label={`${task.title} 집중 대상으로 선택`}
                  >
                    {isActive
                      ? focusLocked
                        ? "집중 중"
                        : "선택됨"
                      : "집중"}
                    <span aria-hidden="true">{isActive ? "●" : "▶"}</span>
                  </button>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
