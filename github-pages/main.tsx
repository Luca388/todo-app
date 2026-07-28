import { createRoot } from "react-dom/client";
import { TodoTimerApp } from "../app/components/TodoTimerApp";
import "../app/globals.css";
import "../app/redesign.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("앱을 표시할 루트 요소를 찾지 못했습니다.");
}

createRoot(root).render(<TodoTimerApp />);
