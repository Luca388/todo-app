"use client";

import { useState, type FormEvent } from "react";
import type { TodoList } from "../types";

type ListRailProps = {
  activeListId: string;
  disabled: boolean;
  lists: TodoList[];
  listTaskCounts: Record<string, number>;
  schemaAvailable: boolean;
  onAddList: (name: string) => Promise<boolean>;
  onDeleteList: (id: string) => Promise<boolean>;
  onOpenCalendar: () => void;
  onOpenHabitTracker: () => void;
  onRenameList: (id: string, name: string) => Promise<boolean>;
  onSelectList: (id: string) => void;
};

export function ListRail({
  activeListId,
  disabled,
  lists,
  listTaskCounts,
  schemaAvailable,
  onAddList,
  onDeleteList,
  onOpenCalendar,
  onOpenHabitTracker,
  onRenameList,
  onSelectList,
}: ListRailProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pending, setPending] = useState(false);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newListName.trim() || pending) return;
    setPending(true);
    const saved = await onAddList(newListName);
    setPending(false);
    if (saved) {
      setNewListName("");
      setShowAddForm(false);
    }
  }

  async function handleRename(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (!editingName.trim() || pending) return;
    setPending(true);
    const saved = await onRenameList(id, editingName);
    setPending(false);
    if (saved) {
      setEditingListId(null);
      setEditingName("");
    }
  }

  async function handleDelete(list: TodoList) {
    if (lists.length <= 1 || pending) return;
    const confirmed = window.confirm(
      `"${list.name}" 리스트와 안의 모든 할 일을 삭제할까요?`,
    );
    if (!confirmed) return;
    setPending(true);
    await onDeleteList(list.id);
    setPending(false);
  }

  return (
    <aside className="workspace-rail" aria-label="할 일 리스트">
      <div className="rail-tools">
        <button
          className="calendar-launch"
          type="button"
          onClick={onOpenCalendar}
        >
          <span aria-hidden="true">▦</span>
          <span>
            <strong>일정</strong>
            <small>캘린더와 기록</small>
          </span>
        </button>
        <button
          className="habit-launch"
          type="button"
          onClick={onOpenHabitTracker}
        >
          <span aria-hidden="true">✓</span>
          <span>
            <strong>습관 트래커</strong>
            <small>매일의 작은 체크</small>
          </span>
        </button>
      </div>

      <div className="rail-section-heading">
        <span>리스트</span>
        <button
          type="button"
          onClick={() => setShowAddForm((current) => !current)}
          disabled={disabled || pending || !schemaAvailable}
          aria-label="새 리스트 추가"
        >
          ＋
        </button>
      </div>

      {showAddForm && (
        <form className="rail-list-form" onSubmit={handleAdd}>
          <input
            autoFocus
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
            maxLength={80}
            placeholder="리스트 이름"
            disabled={pending}
          />
          <button type="submit" disabled={pending || !newListName.trim()}>
            추가
          </button>
        </form>
      )}

      <div className="rail-list-items">
        {lists.map((list) => {
          const isActive = list.id === activeListId;
          const isEditing = list.id === editingListId;

          return (
            <div
              className={`rail-list-item ${isActive ? "is-active" : ""}`}
              key={list.id}
            >
              {isEditing ? (
                <form
                  className="rail-list-form is-editing"
                  onSubmit={(event) => handleRename(event, list.id)}
                >
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    maxLength={80}
                    disabled={pending}
                  />
                  <button type="submit" disabled={pending || !editingName.trim()}>
                    저장
                  </button>
                </form>
              ) : (
                <>
                  <button
                    className="rail-list-select"
                    type="button"
                    onClick={() => onSelectList(list.id)}
                    disabled={disabled && !isActive}
                  >
                    <span aria-hidden="true">•</span>
                    <strong>{list.name}</strong>
                    <small>{listTaskCounts[list.id] ?? 0}</small>
                  </button>
                  {isActive && schemaAvailable && (
                    <div className="rail-list-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingListId(list.id);
                          setEditingName(list.name);
                        }}
                        disabled={pending}
                        aria-label={`${list.name} 이름 변경`}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(list)}
                        disabled={pending || lists.length <= 1 || disabled}
                        aria-label={`${list.name} 삭제`}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {!schemaAvailable && (
        <p className="rail-schema-note">
          리스트 관리를 사용하려면 최신 Supabase 설정이 필요합니다.
        </p>
      )}
    </aside>
  );
}
