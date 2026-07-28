import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  dueAtFromDateInput,
  getDueDateKey,
  getTaskDateStatus,
} from "../app/task-dates.ts";
import { getErrorMessage } from "../app/error-message.ts";

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
  assert.match(html, /오늘 할 일/);
  assert.match(html, /게스트 모드/);
  assert.match(html, /로그인 확인 중…/);
  assert.match(html, /할 일과 집중 타이머/);
  assert.match(html, /집중 타이머/);
  assert.match(html, /todo 리스트/);
  assert.match(html, /미완료/);
  assert.match(html, /일정/);
  assert.match(html, /습관 트래커/);
});

test("stores and classifies task dates without timezone drift", () => {
  const dueAt = dueAtFromDateInput("2026-07-27");

  assert.equal(dueAt, "2026-07-27T12:00:00.000Z");
  assert.equal(getDueDateKey(dueAt), "2026-07-27");
  assert.equal(getTaskDateStatus(dueAt, "2026-07-27"), "today");
  assert.equal(getTaskDateStatus(dueAt, "2026-07-28"), "overdue");
  assert.equal(getTaskDateStatus(dueAt, "2026-07-26"), "upcoming");
});

test("shows the real Supabase error instead of a generic auth message", () => {
  assert.equal(
    getErrorMessage({
      code: "42501",
      details: "The selected list does not belong to this user.",
      message: "new row violates row-level security policy",
    }),
    "new row violates row-level security policy (오류 코드: 42501 · The selected list does not belong to this user.)",
  );
  assert.equal(
    getErrorMessage(null),
    "알 수 없는 오류가 발생했습니다.",
  );
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
  assert.match(app, /className="dashboard-intro"/);
  assert.match(sidebar, /className="app-header"/);
  assert.match(sidebar, /onClick=\{onAuthAction\}/);
  assert.match(sidebar, /disabled=\{authDisabled\}/);
});

test("wires todo lists and the calendar to Supabase with visible request states", async () => {
  const [
    app,
    taskList,
    taskDetail,
    datePicker,
    taskDates,
    listRail,
    calendar,
    habitTracker,
    lists,
    todos,
    migration,
    habits,
    habitMigration,
  ] = await Promise.all([
      readFile(
        new URL("../app/components/TodoTimerApp.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/TaskList.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/TaskDetailDialog.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/CalendarDatePicker.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/task-dates.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/components/ListRail.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/CalendarPanel.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/HabitTrackerPanel.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../lib/supabase/lists.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/supabase/todos.ts", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../supabase/migrations/202607270002_todo_lists_and_completion_dates.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("../lib/supabase/habits.ts", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../supabase/migrations/202607280002_habit_tracker.sql",
          import.meta.url,
        ),
        "utf8",
      ),
  ]);

  assert.match(app, /listTodos\(\)/);
  assert.match(app, /ensureDefaultTodoList\(\)/);
  assert.match(app, /await createTodo\(/);
  assert.match(app, /await createTodoList\(/);
  assert.match(app, /await updateTodoList\(/);
  assert.match(app, /await deleteTodoList\(/);
  assert.match(app, /await setTodoCompleted\(/);
  assert.match(app, /await updateTodo\(/);
  assert.match(app, /dueAtFromDateInput/);
  assert.match(app, /await deleteTodos\(uniqueIds\)/);
  assert.doesNotMatch(app, /completeRecurringTodo|getNextRecurringDateKey/);
  assert.match(app, /nextTodos\.map\(\(todo\)/);
  assert.match(app, /await createTodos\(/);
  assert.match(app, /await importCompletedPomodoros\(/);
  assert.match(app, /haru:guest-data:v1/);
  assert.match(taskList, /Supabase에서 할 일을 불러오고 있어요/);
  assert.match(taskList, /아직 할 일이 없어요/);
  assert.match(taskList, /다시 시도/);
  assert.match(taskList, /changeFilter\("active"\)/);
  assert.match(taskList, /changeFilter\("completed"\)/);
  assert.doesNotMatch(taskList, /changeFilter\("today"\)/);
  assert.doesNotMatch(taskList, /changeFilter\("upcoming"\)/);
  assert.doesNotMatch(taskList, /changeFilter\("overdue"\)/);
  assert.doesNotMatch(taskList, /type="date"/);
  assert.match(taskList, /Number\(left\.completed\) - Number\(right\.completed\)/);
  assert.match(taskList, /task\.completed \|\|/);
  assert.match(taskList, /상세 열기/);
  assert.match(taskList, /draggable=\{canReorder\}/);
  assert.match(taskList, /onReorderTask\(sourceId, task\.id\)/);
  assert.match(taskList, /위로 이동/);
  assert.match(taskList, /아래로 이동/);
  assert.match(taskList, /selectedTaskIds/);
  assert.match(taskList, /선택 삭제/);
  assert.match(taskList, /onDeleteTasks\(selectedIds\)/);
  assert.match(taskList, /삭제 선택/);
  assert.doesNotMatch(taskList, /\bonDeleteTask(?:\s*:|\()/);
  assert.match(
    taskList,
    /className="task-copy"[\s\S]*?isDeleteMode[\s\S]*?onSelectTask\(task\.id\)/,
  );
  assert.match(
    taskList,
    /className="task-row-actions"[\s\S]*?onClick=\{\(\) => onOpenTask\(task\.id\)\}/,
  );
  assert.match(taskList, /이 작업은 되돌릴 수 없습니다/);
  assert.doesNotMatch(taskList, /\{task\.label\}/);
  assert.doesNotMatch(taskList, /포모도로/);
  assert.match(taskDates, /T12:00:00\.000Z/);
  assert.match(taskDates, /getTaskDateStatus/);
  assert.match(listRail, /캘린더와 기록/);
  assert.match(listRail, /매일의 작은 체크/);
  assert.match(listRail, /onOpenHabitTracker/);
  assert.match(listRail, /새 리스트 추가/);
  assert.match(listRail, /이름 변경/);
  assert.match(calendar, /집중한 시간/);
  assert.match(calendar, /완료한 작업/);
  assert.match(
    calendar,
    /selectedTasks\.filter\(\s*\(task\) => task\.completed/,
  );
  assert.doesNotMatch(calendar, /task\.completedAt/);
  assert.match(calendar, /이 날짜에 할 일 추가/);
  assert.match(calendar, /이날의 할 일에 추가했습니다/);
  assert.match(calendar, /onSelectTask\(task\.id\)/);
  assert.match(calendar, /onOpenTask\(task\.id\)/);
  assert.match(habitTracker, /HABIT TRACKER/);
  assert.match(habitTracker, /연속 \$\{streak\}일/);
  assert.match(habitTracker, /onToggleHabit/);
  assert.match(habitTracker, /습관 추가/);
  assert.match(taskDetail, /할 일 상세/);
  assert.doesNotMatch(taskDetail, /type="date"/);
  assert.doesNotMatch(taskDetail, /예상 집중 횟수|estimate/);
  assert.match(taskDetail, /CalendarDatePicker/);
  assert.doesNotMatch(taskDetail, /recurrence/);
  assert.match(datePicker, /calendar-grid task-date-grid/);
  assert.match(datePicker, /날짜 없음/);
  assert.match(taskDetail, /리스트/);
  assert.match(
    app,
    /createTask\(\s*newTask,\s*getLocalDateKey\(\),\s*effectiveActiveListId/,
  );
  assert.match(todos, /export async function deleteTodos/);
  assert.match(todos, /\.in\("id", ids\)/);
  assert.match(app, /dueAt: updated\.due_at \?\? nextDueAt/);
  assert.match(app, /list_id: update\.listId/);
  assert.match(app, /await reorderTodos\(nextIds\)/);
  assert.match(lists, /DEFAULT_TODO_LIST_NAME = "todo 리스트"/);
  assert.match(lists, /isTodoListsSchemaMissing/);
  assert.match(todos, /id: input\.id \?\? window\.crypto\.randomUUID\(\)/);
  assert.match(todos, /export async function reorderTodos/);
  assert.match(lists, /id: input\.id \?\? window\.crypto\.randomUUID\(\)/);
  assert.match(migration, /create table public\.todo_lists/);
  assert.match(migration, /add column list_id/);
  assert.match(migration, /add column completed_at/);
  assert.match(migration, /alter column list_id set not null/);
  assert.match(app, /listHabits\(\)/);
  assert.match(app, /listHabitCompletions\(\)/);
  assert.match(app, /await setHabitCompletion/);
  assert.match(app, /haru:guest-habits:v1/);
  assert.match(habits, /export async function createHabit/);
  assert.match(habits, /onConflict: "habit_id,completed_on"/);
  assert.match(habitMigration, /create table public\.habits/);
  assert.match(habitMigration, /create table public\.habit_completions/);
  assert.match(habitMigration, /alter table public\.habits force row level security/);
  assert.match(habitMigration, /habit_completions_insert_own/);
  assert.match(habitMigration, /habit_completions_update_own/);
});

test("keeps local secrets, logs, and deployment archives out of Git", async () => {
  const gitignore = await readFile(
    new URL("../.gitignore", import.meta.url),
    "utf8",
  );

  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^log\.txt$/m);
  assert.match(gitignore, /^\*\.tgz$/m);
});

test("persists and restores the Pomodoro session lifecycle", async () => {
  const [app, timer, pomodoro, migration, uuidDefaultMigration] =
    await Promise.all([
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
    readFile(
      new URL(
        "../supabase/migrations/202607280001_restore_uuid_defaults.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(app, /getActivePomodoro\(\)/);
  assert.match(app, /listRecentPomodoros\(1000\)/);
  assert.match(app, /await startPomodoro\(/);
  assert.match(app, /await pausePomodoro\(/);
  assert.match(app, /await resumePomodoro\(/);
  assert.match(app, /completePomodoro\(/);
  assert.match(app, /await cancelPomodoro\(/);
  assert.match(app, /handleSkipTimer/);
  assert.match(app, /startAutomaticSession/);
  assert.match(app, /DEFAULT_REPEAT_COUNT = 1/);
  assert.match(app, /currentRound < repeatCount/);
  assert.match(app, /Notification\.requestPermission\(\)/);
  assert.match(app, /playTimerSound/);
  assert.match(app, /autoStartRest/);
  assert.match(app, /autoStartFocus/);
  assert.match(app, /if \(!shouldAutoStart\) return/);
  assert.match(app, /browserNotificationsEnabled/);
  assert.match(app, /new BroadcastChannel\("haru-pomodoro"\)/);
  assert.match(pomodoro, /id: window\.crypto\.randomUUID\(\)/);
  assert.match(pomodoro, /last_resumed_at/);
  assert.match(migration, /status in \('running', 'paused'\)/);
  assert.match(
    uuidDefaultMigration,
    /alter table public\.todos[\s\S]*alter column id set default gen_random_uuid\(\)/,
  );
  assert.match(
    uuidDefaultMigration,
    /alter table public\.todo_lists[\s\S]*alter column id set default gen_random_uuid\(\)/,
  );
  assert.match(
    uuidDefaultMigration,
    /alter table public\.pomodoro_sessions[\s\S]*alter column id set default gen_random_uuid\(\)/,
  );
  assert.match(timer, /일시정지됨/);
  assert.match(timer, /실행 중인 세션 취소/);
  assert.match(timer, /다시 시도/);
  assert.match(timer, /timer-duration-editor/);
  assert.match(timer, /onDurationChange/);
  assert.match(timer, /onSkip/);
  assert.match(timer, /건너뛰기/);
  assert.match(timer, /집중 반복/);
  assert.match(timer, /onRepeatCountChange/);
  assert.match(timer, /브라우저/);
  assert.match(timer, /다음 집중/);
  assert.match(timer, /role="switch"/);
  assert.match(timer, /rest: "휴식"/);
  assert.doesNotMatch(timer, /짧은 휴식|긴 휴식/);
  assert.match(timer, /todayCompletedSessions/);
  assert.match(timer, /todayFocusSeconds/);
});

test("ships an installable offline PWA shell", async () => {
  const [manifestSource, serviceWorker, layout, app] = await Promise.all([
    readFile(
      new URL("../public/manifest.webmanifest", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/TodoTimerApp.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  const manifest = JSON.parse(manifestSource);

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.deepEqual(
    manifest.icons.map((icon) => icon.sizes),
    ["192x192", "512x512"],
  );
  assert.match(serviceWorker, /haru-shell-v3/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
  assert.match(serviceWorker, /notificationclick/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.doesNotMatch(app, /beforeinstallprompt|앱 설치/);
  assert.match(app, /serviceWorker\.register\("\/sw\.js"\)/);
});
