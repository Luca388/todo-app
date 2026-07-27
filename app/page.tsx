import type { Metadata } from "next";
import { TodoTimerApp } from "./components/TodoTimerApp";

export const metadata: Metadata = {
  title: "하루 | 투두와 포모도로",
  description: "오늘 할 일을 정리하고 한 번에 하나씩 집중하세요.",
};

export default function Home() {
  return <TodoTimerApp />;
}
