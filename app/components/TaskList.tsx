import type { FormEvent } from "react";
import type { Task } from "../types";

type TaskListProps = {
  tasks: Task[];
  activeTaskId: number | null;
  newTask: string;
  onNewTaskChange: (value: string) => void;
  onAddTask: (event: FormEvent<HTMLFormElement>) => void;
  onToggleTask: (id: number) => void;
  onSelectTask: (id: number) => void;
};

export function TaskList({
  tasks,
  activeTaskId,
  newTask,
  onNewTaskChange,
  onAddTask,
  onToggleTask,
  onSelectTask,
}: TaskListProps) {
  const remaining = tasks.filter((task) => !task.completed).length;

  return (
    <section className="tasks-panel" aria-labelledby="today-title">
      <header className="content-heading">
        <div>
          <p className="eyebrow">7월 18일 토요일</p>
          <h1 id="today-title">오늘도 한 걸음씩.</h1>
          <p className="heading-note">가장 중요한 일 하나부터 시작해 보세요.</p>
        </div>
        <span className="remaining-pill">{remaining}개 남음</span>
      </header>

      <form className="task-composer" onSubmit={onAddTask}>
        <span className="composer-plus" aria-hidden="true">＋</span>
        <label className="sr-only" htmlFor="new-task">새 할 일</label>
        <input
          id="new-task"
          value={newTask}
          onChange={(event) => onNewTaskChange(event.target.value)}
          placeholder="새로운 할 일을 적어보세요"
          autoComplete="off"
        />
        <button type="submit">추가</button>
      </form>

      <div className="task-section-heading">
        <h2>오늘의 목록</h2>
        <button type="button">정렬 <span aria-hidden="true">⌄</span></button>
      </div>

      <div className="task-list">
        {tasks.map((task) => {
          const isActive = activeTaskId === task.id;

          return (
            <article
              className={`task-item ${task.completed ? "is-complete" : ""} ${isActive ? "is-active" : ""}`}
              key={task.id}
            >
              <label className="task-check-wrap">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => onToggleTask(task.id)}
                />
                <span className="custom-check" aria-hidden="true">✓</span>
                <span className="sr-only">{task.title} 완료</span>
              </label>

              <button
                className="task-copy"
                type="button"
                onClick={() => onSelectTask(task.id)}
              >
                <strong>{task.title}</strong>
                <span>
                  <span className={`label-dot label-${task.label}`} aria-hidden="true" />
                  {task.label}
                  <span className="task-divider">·</span>
                  {task.pomodoros}/{task.estimate} 포모도로
                </span>
              </button>

              <button
                className={`focus-task-button ${isActive ? "is-selected" : ""}`}
                type="button"
                onClick={() => onSelectTask(task.id)}
                disabled={task.completed}
                aria-label={`${task.title} 집중 대상으로 선택`}
              >
                {isActive ? "집중 중" : "집중"}
                <span aria-hidden="true">{isActive ? "●" : "▶"}</span>
              </button>
            </article>
          );
        })}
      </div>

      <button className="show-completed" type="button">
        완료한 일 {tasks.filter((task) => task.completed).length}개
        <span aria-hidden="true">⌄</span>
      </button>
    </section>
  );
}
