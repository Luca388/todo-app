import type { Metadata } from "next";
import { TodoApp } from "./components/TodoApp";

export const metadata: Metadata = {
  title: "하루 | 투두",
  description: "오늘 할 일을 정리하고 한 번에 하나씩 집중하세요.",
};

export default function Home() {
  return <TodoApp />;
}
