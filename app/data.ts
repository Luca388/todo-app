import type { Task } from "./types";

export const initialTasks: Task[] = [];

export const defaultTimerDurations = {
  focus: 25 * 60,
  rest: 5 * 60,
} as const;
