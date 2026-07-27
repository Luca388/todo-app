import type { Task } from "./types";

export const initialTasks: Task[] = [
  {
    id: "1",
    title: "아침 스트레칭 10분",
    label: "건강",
    estimate: 1,
    completed: true,
    pomodoros: 1,
  },
  {
    id: "2",
    title: "투두 앱 화면 구성 정리",
    label: "업무",
    estimate: 2,
    completed: false,
    pomodoros: 1,
  },
  {
    id: "3",
    title: "Supabase 연동 항목 메모",
    label: "업무",
    estimate: 1,
    completed: false,
    pomodoros: 0,
  },
  {
    id: "4",
    title: "책 20쪽 읽기",
    label: "개인",
    estimate: 1,
    completed: false,
    pomodoros: 0,
  },
  {
    id: "5",
    title: "내일 일정 확인",
    label: "개인",
    estimate: 1,
    completed: true,
    pomodoros: 1,
  },
];

export const timerDurations = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
} as const;
