"use client";

import { requireCurrentUser } from "./auth";
import { getSupabaseBrowserClient } from "./client";
import type {
  TodoInsert,
  TodoLabel,
  TodoRow,
  TodoUpdate,
} from "./database.types";

export type CreateTodoInput = {
  id?: string;
  title: string;
  label?: TodoLabel;
  completed?: boolean;
  completedAt?: string | null;
  dueAt?: string | null;
  listId?: string;
  position?: number;
};

export async function listTodos(): Promise<TodoRow[]> {
  const user = await requireCurrentUser();
  const { data, error } = await getSupabaseBrowserClient()
    .from("todos")
    .select("*")
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createTodo(input: CreateTodoInput): Promise<TodoRow> {
  const [created] = await createTodos([input]);
  return created;
}

export async function createTodos(
  inputs: CreateTodoInput[],
): Promise<TodoRow[]> {
  const user = await requireCurrentUser();
  const payload: TodoInsert[] = inputs.map((input) => {
    const title = input.title.trim();
    if (!title) throw new Error("할 일 제목을 입력해 주세요.");

    return {
      id: input.id ?? window.crypto.randomUUID(),
      user_id: user.id,
      title,
      label: input.label ?? "personal",
      completed: input.completed ?? false,
      ...(Object.prototype.hasOwnProperty.call(input, "completedAt")
        ? { completed_at: input.completedAt ?? null }
        : {}),
      due_at: input.dueAt ?? null,
      ...(input.listId ? { list_id: input.listId } : {}),
      position: input.position ?? 0,
    };
  });

  if (payload.length === 0) return [];

  const { data, error } = await getSupabaseBrowserClient()
    .from("todos")
    .insert(payload)
    .select("*");

  if (error) throw error;
  return data;
}

export async function updateTodo(
  id: string,
  changes: TodoUpdate,
): Promise<TodoRow> {
  const user = await requireCurrentUser();
  const { data, error } = await getSupabaseBrowserClient()
    .from("todos")
    .update(changes)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export function setTodoCompleted(
  id: string,
  completed: boolean,
  trackCompletedAt = true,
) {
  return updateTodo(id, {
    completed,
    ...(trackCompletedAt
      ? { completed_at: completed ? new Date().toISOString() : null }
      : {}),
  });
}

export async function reorderTodos(ids: string[]): Promise<void> {
  const user = await requireCurrentUser();
  const client = getSupabaseBrowserClient();
  const results = await Promise.all(
    ids.map((id, position) =>
      client
        .from("todos")
        .update({ position })
        .eq("id", id)
        .eq("user_id", user.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function deleteTodo(id: string): Promise<void> {
  return deleteTodos([id]);
}

export async function deleteTodos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const user = await requireCurrentUser();
  const { error } = await getSupabaseBrowserClient()
    .from("todos")
    .delete()
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) throw error;
}
