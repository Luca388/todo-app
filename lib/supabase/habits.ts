"use client";

import { requireCurrentUser } from "./auth";
import { getSupabaseBrowserClient } from "./client";
import type {
  HabitCompletionInsert,
  HabitCompletionRow,
  HabitInsert,
  HabitRow,
} from "./database.types";

export function isHabitsSchemaMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
  };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message =
    typeof candidate.message === "string" ? candidate.message : "";
  return (
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    /habits|habit_completions/i.test(message)
  );
}

export async function listHabits(): Promise<HabitRow[]> {
  const user = await requireCurrentUser();
  const { data, error } = await getSupabaseBrowserClient()
    .from("habits")
    .select("*")
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function listHabitCompletions(): Promise<
  HabitCompletionRow[]
> {
  const user = await requireCurrentUser();
  const { data, error } = await getSupabaseBrowserClient()
    .from("habit_completions")
    .select("*")
    .eq("user_id", user.id)
    .order("completed_on", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createHabit(
  name: string,
  position: number,
  id?: string,
): Promise<HabitRow> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("습관 이름을 입력해 주세요.");

  const user = await requireCurrentUser();
  const payload: HabitInsert = {
    id: id ?? window.crypto.randomUUID(),
    user_id: user.id,
    name: trimmedName,
    position,
  };
  const { data, error } = await getSupabaseBrowserClient()
    .from("habits")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function importHabitCompletions(
  completions: Array<{ habitId: string; date: string }>,
): Promise<HabitCompletionRow[]> {
  if (completions.length === 0) return [];
  const user = await requireCurrentUser();
  const payload: HabitCompletionInsert[] = completions.map((completion) => ({
    habit_id: completion.habitId,
    user_id: user.id,
    completed_on: completion.date,
  }));
  const { data, error } = await getSupabaseBrowserClient()
    .from("habit_completions")
    .upsert(payload, { onConflict: "habit_id,completed_on" })
    .select("*");

  if (error) throw error;
  return data;
}

export async function setHabitCompletion(
  habitId: string,
  date: string,
  completed: boolean,
): Promise<void> {
  const user = await requireCurrentUser();
  const client = getSupabaseBrowserClient();

  if (completed) {
    const payload: HabitCompletionInsert = {
      habit_id: habitId,
      user_id: user.id,
      completed_on: date,
    };
    const { error } = await client
      .from("habit_completions")
      .upsert(payload, { onConflict: "habit_id,completed_on" });
    if (error) throw error;
    return;
  }

  const { error } = await client
    .from("habit_completions")
    .delete()
    .eq("habit_id", habitId)
    .eq("completed_on", date)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function deleteHabit(id: string): Promise<void> {
  const user = await requireCurrentUser();
  const { error } = await getSupabaseBrowserClient()
    .from("habits")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}
