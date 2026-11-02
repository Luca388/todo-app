"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getDueDateKey } from "../task-dates";
import type { Task, TodoList } from "../types";
import { CalendarDatePicker } from "./CalendarDatePicker";

export type TaskDetailsUpdate = {
  dueDate: string;
  listId: string;
  title: string;
};

type TaskDetailDialogProps = {
  canChangeList: boolean;
  error: string | null;
  isPending: boolean;
  lists: TodoList[];
  task: Task;
  onClose: () => void;
  onDelete: (id: string) => Promise<boolean>;
  onSave: (id: string, update: TaskDetailsUpdate) => Promise<boolean>;
};

export function TaskDetailDialog({
  canChangeList,
  error,
  isPending,
  lists,
  task,
  onClose,
  onDelete,
  onSave,
}: TaskDetailDialogProps) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(getDueDateKey(task.dueAt) ?? "");
  const [listId, setListId] = useState(task.listId);
  const [message, setMessage] = useState<string | null>(null);

  const effectiveListId = lists.some((list) => list.id === listId)
    ? listId
    : (lists[0]?.id ?? "");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPending, onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const saved = await onSave(task.id, {
      dueDate,
      listId: effectiveListId,
      title,
    });
    if (saved) {
      onClose();
    } else {
      setMessage("변경사항을 저장하지 못했습니다.");
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `"${task.title}" 할 일을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;
    const deleted = await onDelete(task.id);
    if (deleted) {
      onClose();
    } else {
      setMessage("할 일을 삭제하지 못했습니다.");
    }
  }

  return (
    <div
      className="task-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="task-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        <header>
          <h2 id="task-detail-title">할 일 상세</h2>
          <button type="button" onClick={onClose} aria-label="상세창 닫기">
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <label>
            <span>할 일</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              autoFocus
              disabled={isPending}
            />
          </label>

          <label>
            <span>리스트</span>
            <select
              value={effectiveListId}
              onChange={(event) => setListId(event.target.value)}
              disabled={isPending || !canChangeList}
            >
              {lists.map((list) => (
                <option value={list.id} key={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>

          <CalendarDatePicker
            value={dueDate}
            onChange={setDueDate}
            disabled={isPending}
          />

          {!canChangeList && lists.length > 1 && (
            <p className="task-detail-note">
              리스트 이동은 최신 Supabase 설정을 적용한 뒤 사용할 수 있습니다.
            </p>
          )}
          {(message || error) && (
            <p className="task-detail-error" role="alert">
              {error ?? message}
            </p>
          )}

          <div className="task-detail-actions">
            <button
              className="is-danger"
              type="button"
              onClick={handleDelete}
              disabled={isPending}
            >
              삭제
            </button>
            <span />
            <button type="button" onClick={onClose} disabled={isPending}>
              취소
            </button>
            <button
              className="is-primary"
              type="submit"
              disabled={
                isPending ||
                !title.trim() ||
                !effectiveListId
              }
            >
              {isPending ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
