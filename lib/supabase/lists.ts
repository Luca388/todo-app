"use client";

import { requireCurrentUser } from "./auth";
import { getSupabaseBrowserClient } from "./client";
import type {
  TodoListInsert,
  TodoListRow,
  TodoListUpdate,
} from "./database.types";

export const DEFAULT_TODO_LIST_NAME = "todo 리스트";

export function isTodoListsSchemaMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    /todo_lists|list_id|completed_at/i.test(message)
  );
}

export async function listTodoLists(): Promise<TodoListRow[]> {
  const user = await requireCurrentUser();
  const { data, error } = await getSupabaseBrowserClient()
    .from("todo_lists")
    .select("*")
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createTodoList(input: {
  id?: string;
  name: string;
  position?: number;
}): Promise<TodoListRow> {
  const user = await requireCurrentUser();
  const name = input.name.trim();
  if (!name) throw new Error("리스트 이름을 입력해 주세요.");

  const payload: TodoListInsert = {
    id: input.id,
    user_id: user.id,
    name,
    position: input.position ?? 0,
  };
  const { data, error } = await getSupabaseBrowserClient()
    .from("todo_lists")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function ensureDefaultTodoList(): Promise<TodoListRow[]> {
  const lists = await listTodoLists();
  if (lists.length > 0) return lists;
  return [
    await createTodoList({
      name: DEFAULT_TODO_LIST_NAME,
      position: 0,
    }),
  ];
}

export async function updateTodoList(
  id: string,
  changes: TodoListUpdate,
): Promise<TodoListRow> {
  const user = await requireCurrentUser();
  const nextChanges = {
    ...changes,
    ...(typeof changes.name === "string"
      ? { name: changes.name.trim() }
      : {}),
  };
  if ("name" in nextChanges && !nextChanges.name) {
    throw new Error("리스트 이름을 입력해 주세요.");
  }

  const { data, error } = await getSupabaseBrowserClient()
    .from("todo_lists")
    .update(nextChanges)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTodoList(id: string): Promise<void> {
  const user = await requireCurrentUser();
  const { error } = await getSupabaseBrowserClient()
    .from("todo_lists")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}
