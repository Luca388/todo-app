"use client";

import type { User } from "@supabase/supabase-js";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  createHabit,
  createTodo,
  createTodoList,
  createTodos,
  deleteHabit,
  deleteTodoList,
  deleteTodos,
  ensureDefaultTodoList,
  getCurrentSession,
  importHabitCompletions,
  isHabitsSchemaMissing,
  isSupabaseConfigured,
  isTodoListsSchemaMissing,
  listHabitCompletions,
  listHabits,
  listTodos,
  onAuthStateChange,
  reorderTodos,
  setHabitCompletion,
  setTodoCompleted,
  signInWithGoogle,
  signOut,
  updateTodo,
  updateTodoList,
  type TodoLabel,
  type TodoRow,
} from "../../lib/supabase";
import { initialTasks } from "../data";
import { getErrorMessage } from "../error-message";
import {
  dueAtFromDateInput,
  getLocalDateKey,
} from "../task-dates";
import type {
  Habit,
  HabitCompletion,
  Task,
  TaskLabel,
  TodoList,
} from "../types";
import { CalendarPanel } from "./CalendarPanel";
import { HabitTrackerPanel } from "./HabitTrackerPanel";
import { ListRail } from "./ListRail";
import { Sidebar } from "./Sidebar";
import {
  TaskDetailDialog,
  type TaskDetailsUpdate,
} from "./TaskDetailDialog";
import { TaskList } from "./TaskList";

function getUserDisplayName(user: User) {
  const metadataName = user.user_metadata.full_name ?? user.user_metadata.name;
  return typeof metadataName === "string" && metadataName.trim()
    ? metadataName
    : (user.email ?? "로그인 사용자");
}

const taskLabels: Record<TodoLabel, TaskLabel> = {
  work: "업무",
  personal: "개인",
  health: "건강",
};

const todoLabels: Record<TaskLabel, TodoLabel> = {
  업무: "work",
  개인: "personal",
  건강: "health",
};

const GUEST_DATA_KEY = "haru:guest-data:v1";
const GUEST_HABITS_KEY = "haru:guest-habits:v1";
const APP_BASE_URL = import.meta.env.BASE_URL || "/";
const LOCAL_DEFAULT_LIST_ID = "local-default-list";
const REMOTE_FALLBACK_LIST_ID = "remote-default-list";
const DEFAULT_LIST: TodoList = {
  id: LOCAL_DEFAULT_LIST_ID,
  name: "todo 리스트",
  position: 0,
};

function publicAssetPath(fileName: string) {
  const base = APP_BASE_URL.endsWith("/") ? APP_BASE_URL : `${APP_BASE_URL}/`;
  return `${base}${fileName.replace(/^\/+/, "")}`;
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<Task>;
  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    (task.completedAt === undefined ||
      task.completedAt === null ||
      typeof task.completedAt === "string") &&
    (task.dueAt === undefined ||
      task.dueAt === null ||
      typeof task.dueAt === "string") &&
    (task.listId === undefined || typeof task.listId === "string") &&
    (task.label === "업무" ||
      task.label === "개인" ||
      task.label === "건강") &&
    typeof task.completed === "boolean"
  );
}

function isTodoList(value: unknown): value is TodoList {
  if (!value || typeof value !== "object") return false;
  const list = value as Partial<TodoList>;
  return (
    typeof list.id === "string" &&
    typeof list.name === "string" &&
    list.name.trim().length > 0 &&
    typeof list.position === "number" &&
    Number.isFinite(list.position)
  );
}

function isHabit(value: unknown): value is Habit {
  if (!value || typeof value !== "object") return false;
  const habit = value as Partial<Habit>;
  return (
    typeof habit.id === "string" &&
    typeof habit.name === "string" &&
    habit.name.trim().length > 0 &&
    typeof habit.position === "number" &&
    Number.isFinite(habit.position)
  );
}

function isHabitCompletion(value: unknown): value is HabitCompletion {
  if (!value || typeof value !== "object") return false;
  const completion = value as Partial<HabitCompletion>;
  return (
    typeof completion.habitId === "string" &&
    typeof completion.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(completion.date)
  );
}

function readGuestHabitData() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(GUEST_HABITS_KEY) ?? "{}",
    ) as {
      completions?: unknown;
      habits?: unknown;
    };
    const habits = Array.isArray(parsed.habits)
      ? parsed.habits.filter(isHabit)
      : [];
    const habitIds = new Set(habits.map((habit) => habit.id));
    const completions = Array.isArray(parsed.completions)
      ? parsed.completions
          .filter(isHabitCompletion)
          .filter((completion) => habitIds.has(completion.habitId))
      : [];
    return { completions, habits };
  } catch {
    return {
      completions: [] as HabitCompletion[],
      habits: [] as Habit[],
    };
  }
}

function readGuestData() {
  try {
    const raw = window.localStorage.getItem(GUEST_DATA_KEY);
    if (!raw) {
      return {
        lists: [DEFAULT_LIST],
        tasks: initialTasks,
      };
    }

    const parsed = JSON.parse(raw) as {
      lists?: unknown;
      tasks?: unknown;
    };
    const lists = Array.isArray(parsed.lists)
      ? parsed.lists.filter(isTodoList)
      : [];
    const normalizedLists = lists.length > 0 ? lists : [DEFAULT_LIST];
    const availableListIds = new Set(normalizedLists.map((list) => list.id));
    const fallbackListId = normalizedLists[0].id;
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.filter(isTask).map((task) => ({
          id: task.id,
          title: task.title,
          label: task.label,
          completed: task.completed,
          completedAt:
            typeof task.completedAt === "string" ? task.completedAt : null,
          dueAt: typeof task.dueAt === "string" ? task.dueAt : null,
          listId:
            typeof task.listId === "string" &&
            availableListIds.has(task.listId)
              ? task.listId
              : fallbackListId,
        }))
      : initialTasks;
    return { lists: normalizedLists, tasks };
  } catch {
    return {
      lists: [DEFAULT_LIST],
      tasks: initialTasks,
    };
  }
}

function todoRowToTask(todo: TodoRow): Task {
  return {
    id: todo.id,
    title: todo.title,
    completedAt: todo.completed_at ?? null,
    dueAt: todo.due_at,
    listId: todo.list_id ?? REMOTE_FALLBACK_LIST_ID,
    label: taskLabels[todo.label],
    completed: todo.completed,
  };
}

type RemoteTodosState = {
  ownerId: string;
  tasks: Task[];
  error: string | null;
};

type RemoteListsState = {
  ownerId: string;
  lists: TodoList[];
  schemaAvailable: boolean;
  error: string | null;
};

type RemoteHabitsState = {
  ownerId: string;
  habits: Habit[];
  completions: HabitCompletion[];
  schemaAvailable: boolean;
  error: string | null;
};

export function TodoApp() {
  const supabaseConfigured = isSupabaseConfigured();
  const [guestTasks, setGuestTasks] = useState(initialTasks);
  const [guestLists, setGuestLists] = useState<TodoList[]>([DEFAULT_LIST]);
  const [guestHabits, setGuestHabits] = useState<Habit[]>([]);
  const [guestHabitCompletions, setGuestHabitCompletions] = useState<
    HabitCompletion[]
  >([]);
  const [guestStorageReady, setGuestStorageReady] = useState(false);
  const [remoteTodos, setRemoteTodos] = useState<RemoteTodosState | null>(null);
  const [remoteLists, setRemoteLists] = useState<RemoteListsState | null>(null);
  const [remoteHabits, setRemoteHabits] =
    useState<RemoteHabitsState | null>(null);
  const [activeListId, setActiveListId] = useState(LOCAL_DEFAULT_LIST_ID);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isHabitTrackerOpen, setIsHabitTrackerOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [todoActionError, setTodoActionError] = useState<string | null>(null);
  const [todoReloadToken, setTodoReloadToken] = useState(0);
  const [todoSaving, setTodoSaving] = useState(false);
  const [habitSaving, setHabitSaving] = useState(false);
  const [habitActionError, setHabitActionError] = useState<string | null>(null);
  const [habitReloadToken, setHabitReloadToken] = useState(0);
  const [pendingTodoIds, setPendingTodoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const guestMigrationUser = useRef<string | null>(null);
  const guestHabitMigrationUser = useRef<string | null>(null);

  const authUserId = authUser?.id;
  const currentRemoteTodos =
    authUserId && remoteTodos?.ownerId === authUserId ? remoteTodos : null;
  const currentRemoteLists =
    authUserId && remoteLists?.ownerId === authUserId ? remoteLists : null;
  const currentRemoteHabits =
    authUserId && remoteHabits?.ownerId === authUserId ? remoteHabits : null;
  const allTasks = authUserId
    ? (currentRemoteTodos?.tasks ?? [])
    : guestTasks;
  const lists = authUserId
    ? (currentRemoteLists?.lists ?? [])
    : guestLists;
  const habits = authUserId
    ? (currentRemoteHabits?.habits ?? [])
    : guestHabits;
  const habitCompletions = authUserId
    ? (currentRemoteHabits?.completions ?? [])
    : guestHabitCompletions;
  const habitsLoading = Boolean(authUserId && !currentRemoteHabits);
  const habitsError = authUserId
    ? (currentRemoteHabits?.error ?? habitActionError)
    : habitActionError;
  const detailTask = allTasks.find((task) => task.id === detailTaskId);
  const activeList =
    lists.find((list) => list.id === activeListId) ?? lists[0];
  const effectiveActiveListId = activeList?.id ?? activeListId;
  const tasks = allTasks.filter(
    (task) => task.listId === effectiveActiveListId,
  );
  const listSchemaAvailable = authUserId
    ? (currentRemoteLists?.schemaAvailable ?? true)
    : true;
  const todosLoading = Boolean(
    authUserId && (!currentRemoteTodos || !currentRemoteLists),
  );
  const todosError = authUserId
    ? (currentRemoteTodos?.error ??
      currentRemoteLists?.error ??
      todoActionError)
    : null;
  const listTaskCounts = allTasks.reduce<Record<string, number>>(
    (counts, task) => ({
      ...counts,
      [task.listId]: (counts[task.listId] ?? 0) + 1,
    }),
    {},
  );
  const authDisplayName = authUser ? getUserDisplayName(authUser) : "게스트 모드";
  const authInitial = authUser
    ? authDisplayName.trim().charAt(0).toUpperCase() || "U"
    : "G";
  const authDescription = !supabaseConfigured
    ? "Supabase 환경변수 필요"
    : !authReady
      ? "로그인 확인 중…"
      : authPending
        ? "처리 중…"
        : authUser
          ? `${authUser.email ?? "Google 계정"} · 로그아웃`
          : "Google로 로그인하고 동기화";

  const updateVisibleTasks = useCallback(
    (updater: (current: Task[]) => Task[]) => {
      if (!authUserId) {
        setGuestTasks(updater);
        return;
      }

      setRemoteTodos((current) =>
        current?.ownerId === authUserId
          ? { ...current, tasks: updater(current.tasks) }
          : current,
      );
    },
    [authUserId],
  );

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;

      const guestData = readGuestData();
      const guestHabitData = readGuestHabitData();

      setGuestTasks(guestData.tasks);
      setGuestLists(guestData.lists);
      setGuestHabits(guestHabitData.habits);
      setGuestHabitCompletions(guestHabitData.completions);
      setGuestStorageReady(true);

      const firstTask = guestData.tasks.find((task) => !task.completed);
      setActiveListId(firstTask?.listId ?? guestData.lists[0].id);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!guestStorageReady || authUserId) return;
    window.localStorage.setItem(
      GUEST_HABITS_KEY,
      JSON.stringify({
        completions: guestHabitCompletions,
        habits: guestHabits,
      }),
    );
  }, [
    authUserId,
    guestHabitCompletions,
    guestHabits,
    guestStorageReady,
  ]);

  useEffect(() => {
    if (!guestStorageReady || authUserId) return;
    window.localStorage.setItem(
      GUEST_DATA_KEY,
      JSON.stringify({
        lists: guestLists,
        tasks: guestTasks,
      }),
    );
  }, [authUserId, guestLists, guestStorageReady, guestTasks]);

  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      void navigator.serviceWorker
        .register(publicAssetPath("sw.js"))
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;

    let mounted = true;

    function applyUser(user: User | null) {
      setAuthUser(user);
      if (!user) {
        const storedGuestData = readGuestData();
        const storedGuestHabitData = readGuestHabitData();
        guestMigrationUser.current = null;
        guestHabitMigrationUser.current = null;
        setGuestTasks(storedGuestData.tasks);
        setGuestLists(storedGuestData.lists);
        setGuestHabits(storedGuestHabitData.habits);
        setGuestHabitCompletions(storedGuestHabitData.completions);
        setRemoteTodos(null);
        setRemoteLists(null);
        setRemoteHabits(null);
        setHabitActionError(null);
        setTodoActionError(null);
        setPendingTodoIds(new Set());

        const firstTask = storedGuestData.tasks.find(
          (task) => !task.completed,
        );
        setActiveListId(
          firstTask?.listId ?? storedGuestData.lists[0].id,
        );
      }
    }

    const subscription = onAuthStateChange((_event, session) => {
      if (!mounted) return;
      applyUser(session?.user ?? null);
      setAuthReady(true);
      setAuthPending(false);
    });

    getCurrentSession()
      .then((session) => {
        if (mounted) applyUser(session?.user ?? null);
      })
      .catch((error: unknown) => {
        if (mounted) setAuthError(getErrorMessage(error));
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabaseConfigured]);

  useEffect(() => {
    if (!authUserId || !guestStorageReady) return;

    const ownerId = authUserId;
    let mounted = true;

    async function loadAndMigrateTodos() {
      try {
        const todos = await listTodos();
        let nextTodos = todos;
        let schemaAvailable = true;
        let nextLists: TodoList[];

        try {
          nextLists = (await ensureDefaultTodoList()).map((list) => ({
            id: list.id,
            name: list.name,
            position: list.position,
          }));
        } catch (error) {
          if (!isTodoListsSchemaMissing(error)) throw error;
          schemaAvailable = false;
          nextLists = [
            {
              id: REMOTE_FALLBACK_LIST_ID,
              name: "todo 리스트",
              position: 0,
            },
          ];
        }

        if (
          guestMigrationUser.current !== ownerId &&
          guestTasks.length > 0
        ) {
          guestMigrationUser.current = ownerId;
          const guestListIds = new Map<string, string>();

          if (schemaAvailable) {
            for (const guestList of guestLists) {
              let remoteList = nextLists.find(
                (list) => list.name === guestList.name.trim(),
              );
              if (!remoteList) {
                const createdList = await createTodoList({
                  name: guestList.name,
                  position: nextLists.length,
                });
                remoteList = {
                  id: createdList.id,
                  name: createdList.name,
                  position: createdList.position,
                };
                nextLists.push(remoteList);
              }
              guestListIds.set(guestList.id, remoteList.id);
            }
          } else {
            for (const guestList of guestLists) {
              guestListIds.set(guestList.id, REMOTE_FALLBACK_LIST_ID);
            }
          }

          const availableTodos = new Map<string, string[]>();
          for (const todo of todos) {
            const key = [
              todo.title.trim(),
              todo.label,
              todo.completed,
              todo.due_at,
              schemaAvailable
                ? (todo.list_id ?? nextLists[0].id)
                : REMOTE_FALLBACK_LIST_ID,
            ].join("\u0000");
            const ids = availableTodos.get(key) ?? [];
            ids.push(todo.id);
            availableTodos.set(key, ids);
          }

          const todosToCreate = guestTasks.flatMap((task, index) => {
            const label = todoLabels[task.label];
            const listId =
              guestListIds.get(task.listId) ?? nextLists[0].id;
            const key = [
              task.title.trim(),
              label,
              task.completed,
              task.dueAt,
              listId,
            ].join("\u0000");
            const matchingIds = availableTodos.get(key);
            if (matchingIds?.shift()) return [];

            return [
              {
                id: window.crypto.randomUUID(),
                title: task.title,
                label,
                completed: task.completed,
                ...(schemaAvailable
                  ? {
                      completedAt: task.completedAt,
                      listId,
                    }
                  : {}),
                dueAt: task.dueAt,
                position: todos.length + index,
              },
            ];
          });

          const created = await createTodos(todosToCreate);
          nextTodos = [...todos, ...created].sort(
            (left, right) => left.position - right.position,
          );
          window.localStorage.removeItem(GUEST_DATA_KEY);
          setGuestTasks([]);
          setGuestLists([DEFAULT_LIST]);
          setMigrationNotice(
            `게스트 할 일 ${guestTasks.length}개를 계정으로 옮겼습니다.`,
          );
        }

        if (!mounted) return;

        const nextTasks = nextTodos.map((todo) => {
          const task = todoRowToTask(todo);
          return schemaAvailable
            ? task
            : { ...task, listId: REMOTE_FALLBACK_LIST_ID };
        });
        setRemoteTodos({
          ownerId,
          tasks: nextTasks,
          error: null,
        });
        setRemoteLists({
          ownerId,
          lists: nextLists,
          schemaAvailable,
          error: null,
        });
        setTodoActionError(null);
        setActiveListId((current) =>
          nextLists.some((list) => list.id === current)
            ? current
            : (nextTasks.find((task) => !task.completed)?.listId ??
              nextLists[0].id),
        );
      } catch (error) {
        if (!mounted) return;
        guestMigrationUser.current = null;
        const message = getErrorMessage(error);
        setRemoteTodos({
          ownerId,
          tasks: [],
          error: message,
        });
        setRemoteLists({
          ownerId,
          lists: [],
          schemaAvailable: false,
          error: message,
        });
      }
    }

    void loadAndMigrateTodos();

    return () => {
      mounted = false;
    };
  }, [
    authUserId,
    guestLists,
    guestStorageReady,
    guestTasks,
    todoReloadToken,
  ]);

  useEffect(() => {
    if (!authUserId || !guestStorageReady) return;

    const ownerId = authUserId;
    let mounted = true;

    async function loadAndMigrateHabits() {
      try {
        let [habitRows, completionRows] = await Promise.all([
          listHabits(),
          listHabitCompletions(),
        ]);

        if (
          guestHabitMigrationUser.current !== ownerId &&
          guestHabits.length > 0
        ) {
          guestHabitMigrationUser.current = ownerId;
          const habitsByName = new Map(
            habitRows.map((habit) => [habit.name.trim().toLowerCase(), habit]),
          );
          const guestHabitIds = new Map<string, string>();

          for (const guestHabit of guestHabits) {
            const key = guestHabit.name.trim().toLowerCase();
            let remoteHabit = habitsByName.get(key);
            if (!remoteHabit) {
              remoteHabit = await createHabit(
                guestHabit.name,
                habitRows.length,
              );
              habitRows = [...habitRows, remoteHabit];
              habitsByName.set(key, remoteHabit);
            }
            guestHabitIds.set(guestHabit.id, remoteHabit.id);
          }

          await importHabitCompletions(
            guestHabitCompletions.flatMap((completion) => {
              const habitId = guestHabitIds.get(completion.habitId);
              return habitId
                ? [{ habitId, date: completion.date }]
                : [];
            }),
          );
          completionRows = await listHabitCompletions();
          window.localStorage.removeItem(GUEST_HABITS_KEY);
          setGuestHabits([]);
          setGuestHabitCompletions([]);
          setMigrationNotice(
            `게스트 습관 ${guestHabits.length}개와 체크 기록 ${guestHabitCompletions.length}개를 계정으로 옮겼습니다.`,
          );
        }

        if (!mounted) return;
        setRemoteHabits({
          ownerId,
          habits: habitRows.map((habit) => ({
            id: habit.id,
            name: habit.name,
            position: habit.position,
          })),
          completions: completionRows.map((completion) => ({
            habitId: completion.habit_id,
            date: completion.completed_on,
          })),
          schemaAvailable: true,
          error: null,
        });
        setHabitActionError(null);
      } catch (error) {
        if (!mounted) return;
        guestHabitMigrationUser.current = null;
        const schemaMissing = isHabitsSchemaMissing(error);
        setRemoteHabits({
          ownerId,
          habits: [],
          completions: [],
          schemaAvailable: false,
          error: schemaMissing
            ? "Supabase에 최신 습관 트래커 SQL을 적용해 주세요."
            : getErrorMessage(error),
        });
      }
    }

    void loadAndMigrateHabits();

    return () => {
      mounted = false;
    };
  }, [
    authUserId,
    guestHabitCompletions,
    guestHabits,
    guestStorageReady,
    habitReloadToken,
  ]);

  async function handleToggleTask(id: string) {
    const task = tasks.find((candidate) => candidate.id === id);
    if (!task || pendingTodoIds.has(id)) return;

    const completed = !task.completed;
    const completedAt = completed ? new Date().toISOString() : null;
    updateVisibleTasks((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? { ...candidate, completed, completedAt }
          : candidate,
      ),
    );

    if (!authUserId) return;

    setTodoActionError(null);
    setPendingTodoIds((current) => new Set(current).add(id));

    try {
      const updated = await setTodoCompleted(
        id,
        completed,
        listSchemaAvailable,
      );
      updateVisibleTasks((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? {
                ...candidate,
                completed: updated.completed,
                completedAt: listSchemaAvailable
                  ? updated.completed_at
                  : completedAt,
              }
            : candidate,
        ),
      );
    } catch (error) {
      updateVisibleTasks((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? {
                ...candidate,
                completed: task.completed,
                completedAt: task.completedAt,
              }
            : candidate,
        ),
      );
      setTodoActionError(getErrorMessage(error));
    } finally {
      setPendingTodoIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function createTask(
    titleValue: string,
    dueDate: string,
    listId: string,
  ) {
    const title = titleValue.trim();
    if (
      !title ||
      !lists.some((list) => list.id === listId) ||
      todoSaving ||
      todosLoading
    ) {
      return false;
    }
    const dueAt = dueAtFromDateInput(dueDate);

    if (!authUserId) {
      const createdTask: Task = {
          id: window.crypto.randomUUID(),
          title,
          completedAt: null,
          dueAt,
          listId,
          label: "개인",
          completed: false,
      };
      setGuestTasks((current) => [...current, createdTask]);
      return true;
    }

    setTodoSaving(true);
    setTodoActionError(null);

    try {
      const created = await createTodo({
        title,
        dueAt,
        ...(listSchemaAvailable ? { listId } : {}),
        position: allTasks.filter((task) => task.listId === listId).length,
      });
      const createdTask = {
        ...todoRowToTask(created),
        dueAt,
        listId,
      };
      updateVisibleTasks((current) => [...current, createdTask]);
      return true;
    } catch (error) {
      setTodoActionError(getErrorMessage(error));
      return false;
    } finally {
      setTodoSaving(false);
    }
  }

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await createTask(
      newTask,
      getLocalDateKey(),
      effectiveActiveListId,
    );
    if (saved) setNewTask("");
  }

  function handleCalendarAddTask(
    title: string,
    dueDate: string,
    listId: string,
  ) {
    return createTask(title, dueDate, listId);
  }

  async function handleUpdateTaskDetails(
    id: string,
    update: TaskDetailsUpdate,
  ) {
    const nextTitle = update.title.trim();
    const nextDueAt = dueAtFromDateInput(update.dueDate);
    const task = allTasks.find((candidate) => candidate.id === id);
    const listExists = lists.some((list) => list.id === update.listId);
    if (
      !nextTitle ||
      !task ||
      !listExists ||
      pendingTodoIds.has(id)
    ) {
      return false;
    }
    const listChanged = task.listId !== update.listId;
    if (!listSchemaAvailable && listChanged) return false;

    if (!authUserId) {
      setGuestTasks((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? {
                ...candidate,
                dueAt: nextDueAt,
                listId: update.listId,
                title: nextTitle,
              }
            : candidate,
        ),
      );
      return true;
    }

    setTodoActionError(null);
    setPendingTodoIds((current) => new Set(current).add(id));

    try {
      const updated = await updateTodo(id, {
        due_at: nextDueAt,
        ...(listSchemaAvailable ? { list_id: update.listId } : {}),
        title: nextTitle,
      });
      updateVisibleTasks((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? {
                ...candidate,
                dueAt: updated.due_at ?? nextDueAt,
                listId: listSchemaAvailable
                  ? (updated.list_id ?? update.listId)
                  : candidate.listId,
                title: updated.title,
              }
            : candidate,
        ),
      );
      return true;
    } catch (error) {
      setTodoActionError(getErrorMessage(error));
      return false;
    } finally {
      setPendingTodoIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  function handleSelectList(id: string) {
    if (!lists.some((list) => list.id === id)) return;
    setActiveListId(id);
  }

  async function handleAddList(nameValue: string) {
    const name = nameValue.trim();
    if (!name) return false;
    setTodoActionError(null);

    if (!authUserId) {
      const nextList: TodoList = {
        id: window.crypto.randomUUID(),
        name,
        position: lists.length,
      };
      setGuestLists((current) => [...current, nextList]);
      setActiveListId(nextList.id);
      return true;
    }

    if (!listSchemaAvailable) {
      setTodoActionError(
        "리스트 관리를 사용하려면 최신 Supabase 마이그레이션을 적용해 주세요.",
      );
      return false;
    }

    try {
      const created = await createTodoList({
        name,
        position: lists.length,
      });
      const nextList = {
        id: created.id,
        name: created.name,
        position: created.position,
      };
      setRemoteLists((current) =>
        current?.ownerId === authUserId
          ? { ...current, lists: [...current.lists, nextList] }
          : current,
      );
      setActiveListId(nextList.id);
      return true;
    } catch (error) {
      setTodoActionError(getErrorMessage(error));
      return false;
    }
  }

  async function handleRenameList(id: string, nameValue: string) {
    const name = nameValue.trim();
    const list = lists.find((candidate) => candidate.id === id);
    if (!name || !list) return false;
    if (list.name === name) return true;
    setTodoActionError(null);

    if (!authUserId) {
      setGuestLists((current) =>
        current.map((candidate) =>
          candidate.id === id ? { ...candidate, name } : candidate,
        ),
      );
      return true;
    }

    if (!listSchemaAvailable) return false;

    try {
      const updated = await updateTodoList(id, { name });
      setRemoteLists((current) =>
        current?.ownerId === authUserId
          ? {
              ...current,
              lists: current.lists.map((candidate) =>
                candidate.id === id
                  ? { ...candidate, name: updated.name }
                  : candidate,
              ),
            }
          : current,
      );
      return true;
    } catch (error) {
      setTodoActionError(getErrorMessage(error));
      return false;
    }
  }

  async function handleDeleteList(id: string) {
    const list = lists.find((candidate) => candidate.id === id);
    if (!list || lists.length <= 1) return false;
    const fallbackList = lists.find((candidate) => candidate.id !== id);
    if (!fallbackList) return false;
    setTodoActionError(null);

    if (!authUserId) {
      setGuestTasks((current) =>
        current.filter((task) => task.listId !== id),
      );
      setGuestLists((current) =>
        current.filter((candidate) => candidate.id !== id),
      );
    } else {
      if (!listSchemaAvailable) return false;
      try {
        await deleteTodoList(id);
        setRemoteTodos((current) =>
          current?.ownerId === authUserId
            ? {
                ...current,
                tasks: current.tasks.filter((task) => task.listId !== id),
              }
            : current,
        );
        setRemoteLists((current) =>
          current?.ownerId === authUserId
            ? {
                ...current,
                lists: current.lists.filter(
                  (candidate) => candidate.id !== id,
                ),
              }
            : current,
        );
      } catch (error) {
        setTodoActionError(getErrorMessage(error));
        return false;
      }
    }

    setActiveListId(fallbackList.id);
    return true;
  }

  async function handleDeleteTasks(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    const idSet = new Set(uniqueIds);
    const selectedTasks = allTasks.filter((task) => idSet.has(task.id));
    if (
      uniqueIds.length === 0 ||
      selectedTasks.length !== uniqueIds.length ||
      selectedTasks.some((task) => pendingTodoIds.has(task.id)) ||
      todoSaving
    ) {
      return false;
    }

    setTodoSaving(true);
    setTodoActionError(null);

    if (!authUserId) {
      setGuestTasks((current) =>
        current.filter((candidate) => !idSet.has(candidate.id)),
      );
    } else {
      setPendingTodoIds((current) => {
        const next = new Set(current);
        uniqueIds.forEach((id) => next.add(id));
        return next;
      });

      try {
        await deleteTodos(uniqueIds);
        updateVisibleTasks((current) =>
          current.filter((candidate) => !idSet.has(candidate.id)),
        );
      } catch (error) {
        setTodoActionError(getErrorMessage(error));
        return false;
      } finally {
        setPendingTodoIds((current) => {
          const next = new Set(current);
          uniqueIds.forEach((id) => next.delete(id));
          return next;
        });
        setTodoSaving(false);
      }
    }

    if (detailTaskId && idSet.has(detailTaskId)) {
      setDetailTaskId(null);
    }

    setTodoSaving(false);
    return true;
  }

  function handleDeleteTask(id: string) {
    return handleDeleteTasks([id]);
  }

  async function handleReorderTask(id: string, targetId: string) {
    const movingTask = tasks.find((candidate) => candidate.id === id);
    const targetTask = tasks.find((candidate) => candidate.id === targetId);
    if (
      !movingTask ||
      !targetTask ||
      movingTask.completed ||
      targetTask.completed ||
      movingTask.listId !== targetTask.listId ||
      id === targetId ||
      todoSaving
    ) {
      return false;
    }

    const incompleteTasks = tasks.filter((task) => !task.completed);
    const sourceIndex = incompleteTasks.findIndex((task) => task.id === id);
    const originalTargetIndex = incompleteTasks.findIndex(
      (task) => task.id === targetId,
    );
    if (sourceIndex < 0 || originalTargetIndex < 0) return false;

    const reorderedIncomplete = [...incompleteTasks];
    const [movedTask] = reorderedIncomplete.splice(sourceIndex, 1);
    const targetIndex = reorderedIncomplete.findIndex(
      (task) => task.id === targetId,
    );
    reorderedIncomplete.splice(
      targetIndex + (originalTargetIndex > sourceIndex ? 1 : 0),
      0,
      movedTask,
    );

    const nextListTasks = [
      ...reorderedIncomplete,
      ...tasks.filter((task) => task.completed),
    ];
    const originalIds = tasks.map((task) => task.id);
    const nextIds = nextListTasks.map((task) => task.id);

    function applyOrder(current: Task[], orderedIds: string[]) {
      const currentById = new Map(
        current
          .filter((task) => task.listId === movingTask.listId)
          .map((task) => [task.id, task]),
      );
      const orderedTasks = orderedIds.flatMap((taskId) => {
        const task = currentById.get(taskId);
        return task ? [task] : [];
      });
      let index = 0;
      return current.map((task) =>
        task.listId === movingTask.listId
          ? (orderedTasks[index++] ?? task)
          : task,
      );
    }

    updateVisibleTasks((current) => applyOrder(current, nextIds));
    if (!authUserId) return true;

    setTodoSaving(true);
    setTodoActionError(null);
    setPendingTodoIds((current) => {
      const next = new Set(current);
      nextIds.forEach((taskId) => next.add(taskId));
      return next;
    });

    try {
      await reorderTodos(nextIds);
      return true;
    } catch (error) {
      updateVisibleTasks((current) => applyOrder(current, originalIds));
      setTodoActionError(getErrorMessage(error));
      return false;
    } finally {
      setTodoSaving(false);
      setPendingTodoIds((current) => {
        const next = new Set(current);
        nextIds.forEach((taskId) => next.delete(taskId));
        return next;
      });
    }
  }

  function handleRetryTodos() {
    setRemoteTodos(null);
    setTodoActionError(null);
    setTodoReloadToken((current) => current + 1);
  }

  async function handleAddHabit(name: string) {
    const trimmedName = name.trim();
    if (
      !trimmedName ||
      habitSaving ||
      habits.some(
        (habit) =>
          habit.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      if (trimmedName) {
        setHabitActionError("이미 같은 이름의 습관이 있습니다.");
      }
      return false;
    }

    setHabitSaving(true);
    setHabitActionError(null);

    if (!authUserId) {
      setGuestHabits((current) => [
        ...current,
        {
          id: window.crypto.randomUUID(),
          name: trimmedName,
          position: current.length,
        },
      ]);
      setHabitSaving(false);
      return true;
    }

    if (!currentRemoteHabits?.schemaAvailable) {
      setHabitActionError("Supabase에 최신 습관 트래커 SQL을 적용해 주세요.");
      setHabitSaving(false);
      return false;
    }

    try {
      const created = await createHabit(trimmedName, habits.length);
      setRemoteHabits((current) =>
        current?.ownerId === authUserId
          ? {
              ...current,
              habits: [
                ...current.habits,
                {
                  id: created.id,
                  name: created.name,
                  position: created.position,
                },
              ],
            }
          : current,
      );
      return true;
    } catch (error) {
      setHabitActionError(getErrorMessage(error));
      return false;
    } finally {
      setHabitSaving(false);
    }
  }

  async function handleToggleHabit(
    habitId: string,
    date: string,
    completed: boolean,
  ) {
    if (
      habitSaving ||
      !habits.some((habit) => habit.id === habitId) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      return false;
    }

    setHabitSaving(true);
    setHabitActionError(null);

    const updateCompletions = (current: HabitCompletion[]) => {
      const withoutDate = current.filter(
        (entry) => entry.habitId !== habitId || entry.date !== date,
      );
      return completed
        ? [...withoutDate, { habitId, date }]
        : withoutDate;
    };

    if (!authUserId) {
      setGuestHabitCompletions(updateCompletions);
      setHabitSaving(false);
      return true;
    }

    try {
      await setHabitCompletion(habitId, date, completed);
      setRemoteHabits((current) =>
        current?.ownerId === authUserId
          ? {
              ...current,
              completions: updateCompletions(current.completions),
            }
          : current,
      );
      return true;
    } catch (error) {
      setHabitActionError(getErrorMessage(error));
      return false;
    } finally {
      setHabitSaving(false);
    }
  }

  async function handleDeleteHabit(id: string) {
    if (
      habitSaving ||
      !habits.some((habit) => habit.id === id)
    ) {
      return false;
    }

    setHabitSaving(true);
    setHabitActionError(null);

    if (!authUserId) {
      setGuestHabits((current) =>
        current.filter((habit) => habit.id !== id),
      );
      setGuestHabitCompletions((current) =>
        current.filter((completion) => completion.habitId !== id),
      );
      setHabitSaving(false);
      return true;
    }

    try {
      await deleteHabit(id);
      setRemoteHabits((current) =>
        current?.ownerId === authUserId
          ? {
              ...current,
              habits: current.habits.filter((habit) => habit.id !== id),
              completions: current.completions.filter(
                (completion) => completion.habitId !== id,
              ),
            }
          : current,
      );
      return true;
    } catch (error) {
      setHabitActionError(getErrorMessage(error));
      return false;
    } finally {
      setHabitSaving(false);
    }
  }

  function handleRetryHabits() {
    setRemoteHabits(null);
    setHabitActionError(null);
    setHabitReloadToken((current) => current + 1);
  }

  function handleCalendarSelectTask(id: string) {
    const task = allTasks.find((candidate) => candidate.id === id);
    if (task) setActiveListId(task.listId);
    setIsCalendarOpen(false);
  }

  async function handleAuthAction() {
    if (!supabaseConfigured || !authReady || authPending) return;

    setAuthError(null);
    setAuthPending(true);

    try {
      if (authUser) {
        await signOut();
      } else {
        await signInWithGoogle();
      }
    } catch (error) {
      setAuthError(getErrorMessage(error));
      setAuthPending(false);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar
        authDescription={authDescription}
        authDisabled={!supabaseConfigured || !authReady || authPending}
        authInitial={authInitial}
        authLabel={authDisplayName}
        onAuthAction={handleAuthAction}
      />

      <div className="workspace-frame">
        <ListRail
          activeListId={effectiveActiveListId}
          disabled={todosLoading}
          lists={lists}
          listTaskCounts={listTaskCounts}
          schemaAvailable={listSchemaAvailable}
          onAddList={handleAddList}
          onDeleteList={handleDeleteList}
          onOpenCalendar={() => {
            setIsHabitTrackerOpen(false);
            setIsCalendarOpen(true);
          }}
          onOpenHabitTracker={() => {
            setIsCalendarOpen(false);
            setIsHabitTrackerOpen(true);
          }}
          onRenameList={handleRenameList}
          onSelectList={handleSelectList}
        />

        <div className="workspace">
        {migrationNotice && (
          <div className="notice" role="status">
            <div>
              <strong>게스트 데이터 이전 완료</strong>
              <span>{migrationNotice}</span>
            </div>
            <button type="button" onClick={() => setMigrationNotice(null)} aria-label="닫기">×</button>
          </div>
        )}

        {authError && (
          <div className="notice is-error" role="alert">
            <div>
              <strong>로그인하지 못했습니다</strong>
              <span>{authError}</span>
            </div>
            <button type="button" onClick={() => setAuthError(null)} aria-label="닫기">×</button>
          </div>
        )}

          <TaskList
            tasks={tasks}
            listName={activeList?.name ?? "todo 리스트"}
            error={todosError}
            isLoading={todosLoading}
            isSaving={todoSaving}
            pendingTaskIds={pendingTodoIds}
            newTask={newTask}
            onNewTaskChange={setNewTask}
            onAddTask={handleAddTask}
            onDeleteTasks={handleDeleteTasks}
            onOpenTask={setDetailTaskId}
            onReorderTask={handleReorderTask}
            onRetry={handleRetryTodos}
            onToggleTask={handleToggleTask}
          />
        </div>
      </div>

      <CalendarPanel
        activeListId={effectiveActiveListId}
        error={todosError}
        isOpen={isCalendarOpen}
        isSaving={todoSaving}
        lists={lists}
        tasks={allTasks}
        onAddTask={handleCalendarAddTask}
        onClose={() => setIsCalendarOpen(false)}
        onOpenTask={setDetailTaskId}
        onSelectTask={handleCalendarSelectTask}
      />

      <HabitTrackerPanel
        completions={habitCompletions}
        error={habitsError}
        habits={habits}
        isLoading={habitsLoading}
        isOpen={isHabitTrackerOpen}
        isSaving={habitSaving}
        onAddHabit={handleAddHabit}
        onClose={() => setIsHabitTrackerOpen(false)}
        onDeleteHabit={handleDeleteHabit}
        onRetry={handleRetryHabits}
        onToggleHabit={handleToggleHabit}
      />

      {detailTask && (
        <TaskDetailDialog
          key={detailTask.id}
          canChangeList={listSchemaAvailable}
          error={todoActionError}
          isPending={pendingTodoIds.has(detailTask.id)}
          lists={lists}
          task={detailTask}
          onClose={() => setDetailTaskId(null)}
          onDelete={handleDeleteTask}
          onSave={handleUpdateTaskDetails}
        />
      )}
    </main>
  );
}
