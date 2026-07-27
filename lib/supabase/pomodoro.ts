"use client";

import { requireCurrentUser } from "./auth";
import { getSupabaseBrowserClient } from "./client";
import type {
  PomodoroMode,
  PomodoroSessionInsert,
  PomodoroSessionRow,
} from "./database.types";

export type StartPomodoroInput = {
  todoId?: string | null;
  mode: PomodoroMode;
  plannedSeconds: number;
};

export async function getRunningPomodoro(): Promise<PomodoroSessionRow | null> {
  const user = await requireCurrentUser();
  const { data, error } = await getSupabaseBrowserClient()
    .from("pomodoro_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "running")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function startPomodoro(
  input: StartPomodoroInput,
): Promise<PomodoroSessionRow> {
  const user = await requireCurrentUser();
  const payload: PomodoroSessionInsert = {
    user_id: user.id,
    todo_id: input.todoId ?? null,
    mode: input.mode,
    planned_seconds: input.plannedSeconds,
    status: "running",
  };

  const { data, error } = await getSupabaseBrowserClient()
    .from("pomodoro_sessions")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function completePomodoro(
  id: string,
  elapsedSeconds: number,
): Promise<PomodoroSessionRow> {
  return finishPomodoro(id, "completed", elapsedSeconds);
}

export async function cancelPomodoro(
  id: string,
  elapsedSeconds: number,
): Promise<PomodoroSessionRow> {
  return finishPomodoro(id, "cancelled", elapsedSeconds);
}

async function finishPomodoro(
  id: string,
  status: "completed" | "cancelled",
  elapsedSeconds: number,
): Promise<PomodoroSessionRow> {
  const user = await requireCurrentUser();
  const { data, error } = await getSupabaseBrowserClient()
    .from("pomodoro_sessions")
    .update({
      status,
      elapsed_seconds: elapsedSeconds,
      ended_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "running")
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function listRecentPomodoros(
  limit = 30,
): Promise<PomodoroSessionRow[]> {
  const user = await requireCurrentUser();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const { data, error } = await getSupabaseBrowserClient()
    .from("pomodoro_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  return data;
}
