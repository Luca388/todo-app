export type TaskLabel = "업무" | "개인" | "건강";

export type Task = {
  id: number;
  title: string;
  label: TaskLabel;
  estimate: number;
  completed: boolean;
  pomodoros: number;
};

export type TimerMode = "focus" | "short" | "long";
