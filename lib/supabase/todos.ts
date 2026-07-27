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
  dueAt?: string | null;
  position?: number;
  estimatedPomodoros?: number;
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
      id: input.id,
      user_id: user.id,
      title,
      label: input.label ?? "personal",
      completed: input.completed ?? false,
      due_at: input.dueAt ?? null,
      position: input.position ?? 0,
      estimated_pomodoros: input.estimatedPomodoros ?? 1,
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

export function setTodoCompleted(id: string, completed: boolean) {
  return updateTodo(id, { completed });
}

export async function deleteTodo(id: string): Promise<void> {
  const user = await requireCurrentUser();
  const { error } = await getSupabaseBrowserClient()
    .from("todos")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}
