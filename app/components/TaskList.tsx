"use client";

import { useState, type FormEvent } from "react";
import {
  formatDateKey,
  getDueDateKey,
  getTaskDateStatus,
} from "../task-dates";
import type { Task } from "../types";

type TaskFilter = "all" | "active" | "completed";

type TaskListProps = {
  tasks: Task[];
  listName: string;
  error: string | null;
  isLoading: boolean;
  isSaving: boolean;
  pendingTaskIds: ReadonlySet<string>;
  newTask: string;
  onNewTaskChange: (value: string) => void;
  onAddTask: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDeleteTasks: (ids: string[]) => Promise<boolean>;
  onOpenTask: (id: string) => void;
  onReorderTask: (id: string, targetId: string) => Promise<boolean>;
  onRetry: () => void;
  onToggleTask: (id: string) => void;
};

export function TaskList({
  tasks,
  listName,
  error,
  isLoading,
  isSaving,
  pendingTaskIds,
  newTask,
  onNewTaskChange,
  onAddTask,
  onDeleteTasks,
  onOpenTask,
  onReorderTask,
  onRetry,
  onToggleTask,
}: TaskListProps) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const remaining = tasks.filter((task) => !task.completed).length;
  const completed = tasks.length - remaining;
  const orderedTasks = [...tasks].sort(
    (left, right) => Number(left.completed) - Number(right.completed),
  );
  const visibleTasks = orderedTasks.filter((task) => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });
  const reorderableTasks = orderedTasks.filter((task) => !task.completed);
  const selectedIds = [...selectedTaskIds].filter((id) =>
    tasks.some((task) => task.id === id),
  );

  function changeFilter(nextFilter: TaskFilter) {
    setFilter(nextFilter);
    setSelectedTaskIds(new Set());
  }

  function toggleDeleteSelection(id: string) {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function closeDeleteMode() {
    setIsDeleteMode(false);
    setSelectedTaskIds(new Set());
  }

  async function handleBulkDelete() {
    if (!isDeleteMode) {
      setIsDeleteMode(true);
      setSelectedTaskIds(new Set());
      return;
    }
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(
      `선택한 할 일 ${selectedIds.length}개를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;

    const deleted = await onDeleteTasks(selectedIds);
    if (deleted) closeDeleteMode();
  }

  return (
    <section className="tasks-panel" aria-labelledby="today-title">
      <header className="content-heading">
        <h1 id="today-title">{listName}</h1>
        <span className="remaining-count">
          {completed}/{tasks.length} 완료
        </span>
      </header>

      <form className="task-composer" onSubmit={onAddTask}>
        <span className="composer-plus" aria-hidden="true">+</span>
        <label className="sr-only" htmlFor="new-task">새 할 일</label>
        <input
          id="new-task"
          value={newTask}
          onChange={(event) => onNewTaskChange(event.target.value)}
          placeholder="할 일 추가"
          autoComplete="off"
          disabled={isLoading || isSaving}
        />
        <button type="submit" disabled={isLoading || isSaving}>
          {isSaving ? "저장 중…" : "추가"}
        </button>
      </form>

      <div className="task-section-heading">
        <div className="task-filters" aria-label="할 일 필터">
          <button
            className={filter === "all" ? "is-active" : ""}
            type="button"
            onClick={() => changeFilter("all")}
          >
            전체 <span>{tasks.length}</span>
          </button>
          <button
            className={filter === "active" ? "is-active" : ""}
            type="button"
            onClick={() => changeFilter("active")}
          >
            미완료 <span>{remaining}</span>
          </button>
          <button
            className={filter === "completed" ? "is-active" : ""}
            type="button"
            onClick={() => changeFilter("completed")}
          >
            완료 <span>{completed}</span>
          </button>
        </div>
        <div className="task-bulk-actions">
          {isDeleteMode && (
            <button
              type="button"
              onClick={closeDeleteMode}
              disabled={isSaving}
            >
              취소
            </button>
          )}
          <button
            className="is-danger"
            type="button"
            onClick={() => void handleBulkDelete()}
            disabled={
              isLoading ||
              isSaving ||
              tasks.length === 0 ||
              (isDeleteMode && selectedIds.length === 0)
            }
          >
            {isDeleteMode ? `선택 삭제 ${selectedIds.length}` : "삭제"}
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
          const isPending = pendingTaskIds.has(task.id);
          const isDeleteSelected = selectedTaskIds.has(task.id);
          const reorderIndex = reorderableTasks.findIndex(
            (candidate) => candidate.id === task.id,
          );
          const canReorder =
            !isDeleteMode &&
            !task.completed &&
            !isPending &&
            !isSaving &&
            reorderIndex >= 0;
          const previousTask = reorderableTasks[reorderIndex - 1];
          const nextTask = reorderableTasks[reorderIndex + 1];
          const dueDateKey = getDueDateKey(task.dueAt);
          const dateStatus = getTaskDateStatus(task.dueAt);
          return (
            <article
              className={`task-item ${task.completed ? "is-complete" : ""} ${draggedTaskId === task.id ? "is-dragging" : ""} ${isDeleteMode ? "is-delete-mode" : ""} ${isDeleteSelected ? "is-delete-selected" : ""}`}
              key={task.id}
              draggable={canReorder}
              onDragStart={(event) => {
                setDraggedTaskId(task.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", task.id);
              }}
              onDragEnd={() => setDraggedTaskId(null)}
              onDragOver={(event) => {
                if (canReorder && draggedTaskId !== task.id) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId =
                  draggedTaskId || event.dataTransfer.getData("text/plain");
                setDraggedTaskId(null);
                if (sourceId && sourceId !== task.id) {
                  void onReorderTask(sourceId, task.id);
                }
              }}
            >
              {isDeleteMode ? (
                <label className="task-check-wrap is-delete-select">
                  <input
                    type="checkbox"
                    checked={isDeleteSelected}
                    onChange={() => toggleDeleteSelection(task.id)}
                    disabled={isPending}
                  />
                  <span className="custom-check" aria-hidden="true">✓</span>
                  <span className="sr-only">{task.title} 삭제 선택</span>
                </label>
              ) : (
                <label className="task-check-wrap">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => onToggleTask(task.id)}
                    disabled={isPending}
                  />
                  <span className="custom-check" aria-hidden="true">✓</span>
                  <span className="sr-only">{task.title} 완료</span>
                </label>
              )}

              <>
                <button
                  className="task-copy"
                  type="button"
                  onClick={() =>
                    isDeleteMode
                      ? toggleDeleteSelection(task.id)
                      : onOpenTask(task.id)
                  }
                  disabled={isPending}
                  aria-label={
                    isDeleteMode
                      ? `${task.title} 삭제 선택`
                      : `${task.title} 상세 열기`
                  }
                >
                  <strong>{task.title}</strong>
                  {dueDateKey && (
                    <small className={`task-due is-${dateStatus}`}>
                      {dateStatus === "today"
                        ? "오늘"
                        : formatDateKey(dueDateKey)}
                    </small>
                  )}
                </button>

                {!isDeleteMode && <div className="task-row-actions">
                  <button
                    type="button"
                    onClick={() =>
                      previousTask &&
                      void onReorderTask(task.id, previousTask.id)
                    }
                    disabled={!canReorder || !previousTask}
                    aria-label={`${task.title} 위로 이동`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      nextTask && void onReorderTask(task.id, nextTask.id)
                    }
                    disabled={!canReorder || !nextTask}
                    aria-label={`${task.title} 아래로 이동`}
                  >
                    ↓
                  </button>
                </div>}

              </>
            </article>
          );
        })}
      </div>
    </section>
  );
}
