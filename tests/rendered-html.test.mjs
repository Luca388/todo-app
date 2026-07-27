import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Haru app and authentication entry points", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>하루 \| 투두와 포모도로<\/title>/);
  assert.match(html, /class="app-shell"/);
  assert.match(html, /오늘도 한 걸음씩\./);
  assert.match(html, /게스트 모드/);
  assert.match(html, /Google 로그인/);
  assert.match(html, /로그인 확인 중…/);
});

test("wires the Supabase auth lifecycle to desktop and mobile controls", async () => {
  const [app, sidebar] = await Promise.all([
    readFile(
      new URL("../app/components/TodoTimerApp.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/Sidebar.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(app, /getCurrentSession/);
  assert.match(app, /onAuthStateChange/);
  assert.match(app, /subscription\.unsubscribe\(\)/);
  assert.match(app, /await signInWithGoogle\(\)/);
  assert.match(app, /await signOut\(\)/);
  assert.match(app, /className="mobile-auth-button"/);
  assert.match(sidebar, /onClick=\{onAuthAction\}/);
  assert.match(sidebar, /disabled=\{authDisabled\}/);
});

test("wires authenticated todos to Supabase with visible request states", async () => {
  const [app, taskList] = await Promise.all([
    readFile(
      new URL("../app/components/TodoTimerApp.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/TaskList.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(app, /listTodos\(\)/);
  assert.match(app, /await createTodo\(/);
  assert.match(app, /await setTodoCompleted\(/);
  assert.match(app, /await updateTodo\(/);
  assert.match(app, /await deleteTodo\(/);
  assert.match(app, /todos\.map\(todoRowToTask\)/);
  assert.match(taskList, /Supabase에서 할 일을 불러오고 있어요/);
  assert.match(taskList, /아직 할 일이 없어요/);
  assert.match(taskList, /다시 시도/);
  assert.match(taskList, /할 일 제목 수정/);
  assert.match(taskList, /이 작업은 되돌릴 수 없습니다/);
});

test("persists and restores the Pomodoro session lifecycle", async () => {
  const [app, timer, pomodoro, migration] = await Promise.all([
    readFile(
      new URL("../app/components/TodoTimerApp.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/FocusTimer.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../lib/supabase/pomodoro.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/202607270001_pomodoro_pause_state.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(app, /getActivePomodoro\(\)/);
  assert.match(app, /listRecentPomodoros\(100\)/);
  assert.match(app, /await startPomodoro\(/);
  assert.match(app, /await pausePomodoro\(/);
  assert.match(app, /await resumePomodoro\(/);
  assert.match(app, /completePomodoro\(/);
  assert.match(app, /await cancelPomodoro\(/);
  assert.match(app, /new BroadcastChannel\("haru-pomodoro"\)/);
  assert.match(pomodoro, /last_resumed_at/);
  assert.match(migration, /status in \('running', 'paused'\)/);
  assert.match(timer, /일시정지됨/);
  assert.match(timer, /실행 중인 세션 취소/);
  assert.match(timer, /다시 시도/);
  assert.match(timer, /todayCompletedSessions/);
  assert.match(timer, /todayFocusSeconds/);
});
