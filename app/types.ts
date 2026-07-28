export type TaskLabel = "업무" | "개인" | "건강";

export type Task = {
  id: string;
  title: string;
  completedAt: string | null;
  dueAt: string | null;
  listId: string;
  label: TaskLabel;
  completed: boolean;
  pomodoros: number;
};

export type TodoList = {
  id: string;
  name: string;
  position: number;
};

export type Habit = {
  id: string;
  name: string;
  position: number;
};

export type HabitCompletion = {
  habitId: string;
  date: string;
};

export type FocusHistoryEntry = {
  elapsedSeconds: number;
  endedAt: string;
  taskId: string | null;
};

export type TimerMode = "focus" | "rest";
