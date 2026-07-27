"use client";

import { useState, type FormEvent } from "react";
import type { Task } from "../types";

type TaskListProps = {
  tasks: Task[];
  activeTaskId: string | null;
  error: string | null;
  focusLocked: boolean;
  isLoading: boolean;
  isSaving: boolean;
  pendingTaskIds: ReadonlySet<string>;
  newTask: string;
  onNewTaskChange: (value: string) => void;
  onAddTask: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDeleteTask: (id: string) => Promise<boolean>;
  onRenameTask: (id: string, title: string) => Promise<boolean>;
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
  onNewTaskChange,
  onAddTask,
  onDeleteTask,
  onRenameTask,
  onRetry,
  onToggleTask,
  onSelectTask,
}: TaskListProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const remaining = tasks.filter((task) => !task.completed).length;

  async function handleRenameSubmit(
    event: FormEvent<HTMLFormElement>,
    id: string,
  ) {
    event.preventDefault();
    const saved = await onRenameTask(id, editingTitle);
    if (saved) {
      setEditingTaskId(null);
      setEditingTitle("");
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
    }
  }

  return (
    <section className="tasks-panel" aria-labelledby="today-title">
      <header className="content-heading">
        <div>
          <p className="eyebrow">7월 18일 토요일</p>
          <h1 id="today-title">오늘도 한 걸음씩.</h1>
          <p className="heading-note">가장 중요한 일 하나부터 시작해 보세요.</p>
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
        <button type="submit" disabled={isLoading || isSaving}>
          {isSaving ? "저장 중…" : "추가"}
        </button>
      </form>

      <div className="task-section-heading">
        <h2>오늘의 목록</h2>
        <button type="button">정렬 <span aria-hidden="true">⌄</span></button>
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

        {tasks.map((task) => {
          const isActive = activeTaskId === task.id;
          const isPending = pendingTaskIds.has(task.id);
          const isEditing = editingTaskId === task.id;

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
                  onSubmit={(event) => handleRenameSubmit(event, task.id)}
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
                  <button type="submit" disabled={isPending || !editingTitle.trim()}>
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTaskId(null);
                      setEditingTitle("");
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
                    disabled={isPending || (focusLocked && !isActive)}
                  >
                    <strong>{task.title}</strong>
                    <span>
                      <span className={`label-dot label-${task.label}`} aria-hidden="true" />
                      {task.label}
                      <span className="task-divider">·</span>
                      {task.pomodoros}/{task.estimate} 포모도로
                    </span>
                  </button>

                  <div className="task-row-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setEditingTitle(task.title);
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
                    {isActive ? "집중 중" : "집중"}
                    <span aria-hidden="true">{isActive ? "●" : "▶"}</span>
                  </button>
                </>
              )}
            </article>
          );
        })}
      </div>

      <button className="show-completed" type="button">
        완료한 일 {tasks.filter((task) => task.completed).length}개
        <span aria-hidden="true">⌄</span>
      </button>
    </section>
  );
}
