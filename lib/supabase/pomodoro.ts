"use client";

import { requireCurrentUser } from "./auth";
import { getSupabaseBrowserClient } from "./client";
import type {
  PomodoroMode,
  PomodoroSessionInsert,
  PomodoroSessionRow,
  PomodoroStatus,
} from "./database.types";

export type StartPomodoroInput = {
  todoId?: string | null;
  mode: PomodoroMode;
  plannedSeconds: number;
};

export type ImportCompletedPomodoroInput = {
  id: string;
  todoId?: string | null;
  elapsedSeconds: number;
  endedAt: string;
};

const MAX_SESSION_SECONDS = 86400;

function clampElapsedSeconds(elapsedSeconds: number) {
  return Math.min(
    Math.max(Math.floor(elapsedSeconds), 0),
    MAX_SESSION_SECONDS,
  );
}

async function getOwnedPomodoro(
  id: string,
): Promise<PomodoroSessionRow | null> {
  const user = await requireCurrentUser();
  const { data, error } = await getSupabaseBrowserClient()
    .from("pomodoro_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getActivePomodoro(): Promise<PomodoroSessionRow | null> {
  const user = await requireCurrentUser();
  const { data, error } = await getSupabaseBrowserClient()
    .from("pomodoro_sessions")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["running", "paused"])
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function startPomodoro(
  input: StartPomodoroInput,
): Promise<PomodoroSessionRow> {
  const user = await requireCurrentUser();
  const resumedAt = new Date().toISOString();
  const payload: PomodoroSessionInsert = {
    user_id: user.id,
    todo_id: input.todoId ?? null,
    mode: input.mode,
    planned_seconds: input.plannedSeconds,
    status: "running",
    last_resumed_at: resumedAt,
  };

  const { data, error } = await getSupabaseBrowserClient()
    .from("pomodoro_sessions")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const active = await getActivePomodoro();
      if (active) return active;
    }
    throw error;
  }
  return data;
}

export async function pausePomodoro(
  id: string,
  elapsedSeconds: number,
): Promise<PomodoroSessionRow> {
  return transitionPomodoro(id, "running", "paused", {
    elapsed_seconds: clampElapsedSeconds(elapsedSeconds),
    last_resumed_at: null,
  });
}

export async function resumePomodoro(
  id: string,
): Promise<PomodoroSessionRow> {
  return transitionPomodoro(id, "paused", "running", {
    last_resumed_at: new Date().toISOString(),
  });
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
      elapsed_seconds: clampElapsedSeconds(elapsedSeconds),
      last_resumed_at: null,
      ended_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["running", "paused"])
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const current = await getOwnedPomodoro(id);
  if (current?.status === status) return current;
  throw new Error(
    current
      ? "다른 화면에서 이미 이 타이머의 상태가 변경되었습니다."
      : "타이머 세션을 찾을 수 없습니다.",
  );
}

async function transitionPomodoro(
  id: string,
  fromStatus: PomodoroStatus,
  toStatus: PomodoroStatus,
  update: {
    elapsed_seconds?: number;
    last_resumed_at?: string | null;
  },
): Promise<PomodoroSessionRow> {
  const user = await requireCurrentUser();
  const { data, error } = await getSupabaseBrowserClient()
    .from("pomodoro_sessions")
    .update({
      ...update,
      status: toStatus,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", fromStatus)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const current = await getOwnedPomodoro(id);
  if (current?.status === toStatus) return current;
  throw new Error(
    current
      ? "다른 화면에서 이미 이 타이머의 상태가 변경되었습니다."
      : "타이머 세션을 찾을 수 없습니다.",
  );
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

export async function importCompletedPomodoros(
  inputs: ImportCompletedPomodoroInput[],
): Promise<void> {
  if (inputs.length === 0) return;

  const user = await requireCurrentUser();
  const payload: PomodoroSessionInsert[] = inputs.map((input) => {
    const elapsedSeconds = Math.max(
      1,
      clampElapsedSeconds(input.elapsedSeconds),
    );
    const endedAt = new Date(input.endedAt);
    const safeEndedAt = Number.isNaN(endedAt.getTime())
      ? new Date()
      : endedAt;

    return {
      id: input.id,
      user_id: user.id,
      todo_id: input.todoId ?? null,
      mode: "focus",
      status: "completed",
      planned_seconds: elapsedSeconds,
      elapsed_seconds: elapsedSeconds,
      started_at: new Date(
        safeEndedAt.getTime() - elapsedSeconds * 1000,
      ).toISOString(),
      last_resumed_at: null,
      ended_at: safeEndedAt.toISOString(),
    };
  });

  const { error } = await getSupabaseBrowserClient()
    .from("pomodoro_sessions")
    .upsert(payload, {
      onConflict: "id",
      ignoreDuplicates: true,
    });

  if (error) throw error;
}
