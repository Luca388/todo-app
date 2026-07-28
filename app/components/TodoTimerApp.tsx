"use client";

import type { User } from "@supabase/supabase-js";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  cancelPomodoro,
  completePomodoro,
  createHabit,
  createTodo,
  createTodoList,
  createTodos,
  deleteHabit,
  deleteTodoList,
  deleteTodos,
  ensureDefaultTodoList,
  getActivePomodoro,
  getCurrentSession,
  importHabitCompletions,
  importCompletedPomodoros,
  isHabitsSchemaMissing,
  isSupabaseConfigured,
  isTodoListsSchemaMissing,
  listHabitCompletions,
  listHabits,
  listRecentPomodoros,
  listTodos,
  onAuthStateChange,
  pausePomodoro,
  reorderTodos,
  resumePomodoro,
  setHabitCompletion,
  setTodoCompleted,
  signInWithGoogle,
  signOut,
  startPomodoro,
  updateTodo,
  updateTodoList,
  type PomodoroMode,
  type PomodoroSessionRow,
  type TodoLabel,
  type TodoRow,
} from "../../lib/supabase";
import { defaultTimerDurations, initialTasks } from "../data";
import { getErrorMessage } from "../error-message";
import {
  dueAtFromDateInput,
  getLocalDateKey,
} from "../task-dates";
import type {
  FocusHistoryEntry,
  Habit,
  HabitCompletion,
  Task,
  TaskLabel,
  TimerMode,
  TodoList,
} from "../types";
import { CalendarPanel } from "./CalendarPanel";
import { FocusTimer } from "./FocusTimer";
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

const pomodoroModes: Record<TimerMode, PomodoroMode> = {
  focus: "focus",
  rest: "short_break",
};

const timerModes: Record<PomodoroMode, TimerMode> = {
  focus: "focus",
  short_break: "rest",
  long_break: "rest",
};

const GUEST_DATA_KEY = "haru:guest-data:v1";
const GUEST_HABITS_KEY = "haru:guest-habits:v1";
const GUEST_TIMER_KEY = "haru:guest-timer:v1";
const TIMER_SETTINGS_KEY = "haru:timer-settings:v1";
const APP_BASE_URL = import.meta.env.BASE_URL || "/";
const DEFAULT_REPEAT_COUNT = 1;
const MAX_REPEAT_COUNT = 99;
const DEFAULT_SOUND_ENABLED = true;
const DEFAULT_AUTO_START_REST = true;
const DEFAULT_AUTO_START_FOCUS = true;
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

type TimerDurations = Record<TimerMode, number>;
type TimerSettings = TimerDurations & {
  autoStartFocus: boolean;
  autoStartRest: boolean;
  browserNotificationsEnabled: boolean;
  currentRound: number;
  repeatCount: number;
  soundEnabled: boolean;
};

type GuestCompletedSession = {
  id: string;
  elapsedSeconds: number;
  endedAt: string;
  taskId: string | null;
};

type GuestTimerSession = {
  elapsedSeconds: number;
  lastResumedAt: number | null;
  mode: TimerMode;
  plannedSeconds: number;
  status: "running" | "paused";
  taskId: string | null;
};

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
    typeof task.completed === "boolean" &&
    typeof task.pomodoros === "number" &&
    Number.isFinite(task.pomodoros)
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
        sessions: [] as GuestCompletedSession[],
      };
    }

    const parsed = JSON.parse(raw) as {
      lists?: unknown;
      tasks?: unknown;
      sessions?: unknown;
    };
    const lists = Array.isArray(parsed.lists)
      ? parsed.lists.filter(isTodoList)
      : [];
    const normalizedLists = lists.length > 0 ? lists : [DEFAULT_LIST];
    const availableListIds = new Set(normalizedLists.map((list) => list.id));
    const fallbackListId = normalizedLists[0].id;
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.filter(isTask).map((task) => ({
          ...task,
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
    const sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions.filter((value): value is GuestCompletedSession => {
          if (!value || typeof value !== "object") return false;
          const session = value as Partial<GuestCompletedSession>;
          return (
            typeof session.elapsedSeconds === "number" &&
            Number.isFinite(session.elapsedSeconds) &&
            typeof session.endedAt === "string" &&
            (typeof session.taskId === "string" || session.taskId === null)
          );
        }).map((session) => ({
          ...session,
          id:
            typeof session.id === "string"
              ? session.id
              : window.crypto.randomUUID(),
        }))
      : [];

    return { lists: normalizedLists, tasks, sessions };
  } catch {
    return {
      lists: [DEFAULT_LIST],
      tasks: initialTasks,
      sessions: [] as GuestCompletedSession[],
    };
  }
}

function readTimerSettings(): TimerSettings {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(TIMER_SETTINGS_KEY) ?? "{}",
    ) as Partial<TimerSettings>;
    const repeatCount =
      typeof parsed.repeatCount === "number" &&
      Number.isFinite(parsed.repeatCount)
        ? Math.min(
            Math.max(Math.floor(parsed.repeatCount), 1),
            MAX_REPEAT_COUNT,
          )
        : DEFAULT_REPEAT_COUNT;
    return {
      focus:
        typeof parsed.focus === "number" && Number.isFinite(parsed.focus)
          ? Math.min(Math.max(parsed.focus, 60), 86400)
          : defaultTimerDurations.focus,
      rest:
        typeof parsed.rest === "number" && Number.isFinite(parsed.rest)
          ? Math.min(Math.max(parsed.rest, 60), 86400)
          : defaultTimerDurations.rest,
      repeatCount,
      currentRound:
        typeof parsed.currentRound === "number" &&
        Number.isFinite(parsed.currentRound)
          ? Math.min(
              Math.max(Math.floor(parsed.currentRound), 1),
              repeatCount,
            )
          : 1,
      soundEnabled:
        typeof parsed.soundEnabled === "boolean"
          ? parsed.soundEnabled
          : DEFAULT_SOUND_ENABLED,
      browserNotificationsEnabled:
        parsed.browserNotificationsEnabled === true,
      autoStartRest:
        typeof parsed.autoStartRest === "boolean"
          ? parsed.autoStartRest
          : DEFAULT_AUTO_START_REST,
      autoStartFocus:
        typeof parsed.autoStartFocus === "boolean"
          ? parsed.autoStartFocus
          : DEFAULT_AUTO_START_FOCUS,
    };
  } catch {
    return {
      ...defaultTimerDurations,
      autoStartFocus: DEFAULT_AUTO_START_FOCUS,
      autoStartRest: DEFAULT_AUTO_START_REST,
      browserNotificationsEnabled: false,
      currentRound: 1,
      repeatCount: DEFAULT_REPEAT_COUNT,
      soundEnabled: DEFAULT_SOUND_ENABLED,
    };
  }
}

function readGuestTimer(): GuestTimerSession | null {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(GUEST_TIMER_KEY) ?? "null",
    ) as Partial<GuestTimerSession> | null;
    if (
      !parsed ||
      (parsed.mode !== "focus" && parsed.mode !== "rest") ||
      (parsed.status !== "running" && parsed.status !== "paused") ||
      typeof parsed.plannedSeconds !== "number" ||
      !Number.isFinite(parsed.plannedSeconds) ||
      typeof parsed.elapsedSeconds !== "number" ||
      !Number.isFinite(parsed.elapsedSeconds) ||
      (typeof parsed.lastResumedAt !== "number" &&
        parsed.lastResumedAt !== null) ||
      (typeof parsed.taskId !== "string" && parsed.taskId !== null)
    ) {
      return null;
    }

    return {
      elapsedSeconds: Math.max(0, parsed.elapsedSeconds),
      lastResumedAt: parsed.lastResumedAt,
      mode: parsed.mode,
      plannedSeconds: Math.min(
        Math.max(parsed.plannedSeconds, 60),
        86400,
      ),
      status: parsed.status,
      taskId: parsed.taskId,
    };
  } catch {
    return null;
  }
}

function getGuestTimerElapsed(
  session: GuestTimerSession,
  now = Date.now(),
) {
  if (session.status === "paused" || session.lastResumedAt === null) {
    return session.elapsedSeconds;
  }

  return Math.min(
    session.plannedSeconds,
    session.elapsedSeconds +
      Math.max(0, Math.floor((now - session.lastResumedAt) / 1000)),
  );
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
    pomodoros: 0,
  };
}

function getPomodoroElapsed(
  session: PomodoroSessionRow,
  now = Date.now(),
) {
  const savedElapsed = Math.max(0, session.elapsed_seconds);
  if (session.status !== "running") return savedElapsed;

  const resumedAt = session.last_resumed_at ?? session.started_at;
  const currentRunElapsed = Math.max(
    0,
    Math.floor((now - new Date(resumedAt).getTime()) / 1000),
  );
  return Math.min(
    session.planned_seconds,
    savedElapsed + currentRunElapsed,
  );
}

function getPomodoroRemaining(session: PomodoroSessionRow) {
  return Math.max(
    0,
    session.planned_seconds - getPomodoroElapsed(session),
  );
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

export function TodoTimerApp() {
  const supabaseConfigured = isSupabaseConfigured();
  const [guestTasks, setGuestTasks] = useState(initialTasks);
  const [guestLists, setGuestLists] = useState<TodoList[]>([DEFAULT_LIST]);
  const [guestHabits, setGuestHabits] = useState<Habit[]>([]);
  const [guestHabitCompletions, setGuestHabitCompletions] = useState<
    HabitCompletion[]
  >([]);
  const [guestCompletedSessions, setGuestCompletedSessions] = useState<
    GuestCompletedSession[]
  >([]);
  const [guestStorageReady, setGuestStorageReady] = useState(false);
  const [guestTimer, setGuestTimer] = useState<GuestTimerSession | null>(null);
  const [remoteTodos, setRemoteTodos] = useState<RemoteTodosState | null>(null);
  const [remoteLists, setRemoteLists] = useState<RemoteListsState | null>(null);
  const [remoteHabits, setRemoteHabits] =
    useState<RemoteHabitsState | null>(null);
  const [activeListId, setActiveListId] = useState(LOCAL_DEFAULT_LIST_ID);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isHabitTrackerOpen, setIsHabitTrackerOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [mode, setMode] = useState<TimerMode>("focus");
  const [timerDurations, setTimerDurations] = useState<TimerDurations>({
    ...defaultTimerDurations,
  });
  const [repeatCount, setRepeatCount] = useState(DEFAULT_REPEAT_COUNT);
  const [currentRound, setCurrentRound] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(DEFAULT_SOUND_ENABLED);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] =
    useState(false);
  const [browserNotificationsSupported, setBrowserNotificationsSupported] =
    useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(
    null,
  );
  const [autoStartRest, setAutoStartRest] = useState(
    DEFAULT_AUTO_START_REST,
  );
  const [autoStartFocus, setAutoStartFocus] = useState(
    DEFAULT_AUTO_START_FOCUS,
  );
  const [remainingSeconds, setRemainingSeconds] = useState(
    defaultTimerDurations.focus,
  );
  const [isRunning, setIsRunning] = useState(false);
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
  const [activePomodoro, setActivePomodoro] =
    useState<PomodoroSessionRow | null>(null);
  const [pomodoroLoadedForUser, setPomodoroLoadedForUser] =
    useState<string | null>(null);
  const [pomodoroPending, setPomodoroPending] = useState(false);
  const [pomodoroError, setPomodoroError] = useState<string | null>(null);
  const [pomodoroReloadToken, setPomodoroReloadToken] = useState(0);
  const [pomodoroCounts, setPomodoroCounts] = useState<Record<string, number>>(
    {},
  );
  const [remoteFocusSummary, setRemoteFocusSummary] = useState({
    seconds: 0,
    sessions: 0,
  });
  const [remoteFocusHistory, setRemoteFocusHistory] = useState<
    FocusHistoryEntry[]
  >([]);
  const remainingSnapshot = useRef(remainingSeconds);
  const pomodoroChannel = useRef<BroadcastChannel | null>(null);
  const guestMigrationUser = useRef<string | null>(null);
  const guestHabitMigrationUser = useRef<string | null>(null);
  const audioContext = useRef<AudioContext | null>(null);

  const authUserId = authUser?.id;
  const currentRemoteTodos =
    authUserId && remoteTodos?.ownerId === authUserId ? remoteTodos : null;
  const currentRemoteLists =
    authUserId && remoteLists?.ownerId === authUserId ? remoteLists : null;
  const currentRemoteHabits =
    authUserId && remoteHabits?.ownerId === authUserId ? remoteHabits : null;
  const storedTasks = authUserId
    ? (currentRemoteTodos?.tasks ?? [])
    : guestTasks;
  const allTasks = authUserId
    ? storedTasks.map((task) => ({
        ...task,
        pomodoros: pomodoroCounts[task.id] ?? 0,
      }))
    : storedTasks;
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
  const activeTask = allTasks.find((task) => task.id === activeTaskId);
  const detailTask = allTasks.find((task) => task.id === detailTaskId);
  const currentPomodoro =
    authUserId && activePomodoro?.user_id === authUserId
      ? activePomodoro
      : null;
  const sessionListId =
    (currentPomodoro || (!authUserId && guestTimer)) && activeTask
      ? activeTask.listId
      : null;
  const activeList =
    lists.find((list) => list.id === (sessionListId ?? activeListId)) ??
    lists[0];
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
  const pomodoroLoading = Boolean(
    authUserId && pomodoroLoadedForUser !== authUserId,
  );
  const hasActiveTimerSession = Boolean(
    currentPomodoro || (!authUserId && guestTimer),
  );
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayGuestSessions = guestCompletedSessions.filter(
    (session) => new Date(session.endedAt).getTime() >= todayStart.getTime(),
  );
  const todayFocusSeconds = authUserId
    ? remoteFocusSummary.seconds
    : todayGuestSessions.reduce(
        (total, session) => total + session.elapsedSeconds,
        0,
      );
  const todayCompletedSessions = authUserId
    ? remoteFocusSummary.sessions
    : todayGuestSessions.length;
  const completedCount = tasks.filter((task) => task.completed).length;
  const focusHistory = authUserId
    ? remoteFocusHistory
    : guestCompletedSessions.map((session) => ({
        elapsedSeconds: session.elapsedSeconds,
        endedAt: session.endedAt,
        taskId: session.taskId,
      }));
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

  const broadcastPomodoroChange = useCallback(() => {
    pomodoroChannel.current?.postMessage("pomodoro-changed");
  }, []);

  const getAudioContext = useCallback(() => {
    if (audioContext.current?.state === "closed") {
      audioContext.current = null;
    }
    if (audioContext.current) return audioContext.current;

    const AudioContextConstructor =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    const context = new AudioContextConstructor();
    audioContext.current = context;
    return context;
  }, []);

  const primeTimerSound = useCallback(() => {
    const context = getAudioContext();
    if (!context) return;

    const unlock = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.01);
    };

    if (context.state === "suspended") {
      void context.resume().then(unlock).catch(() => undefined);
    } else {
      unlock();
    }
  }, [getAudioContext]);

  const playTimerSound = useCallback(
    (kind: "complete" | "auto-start") => {
      if (!soundEnabled) return;
      const context = getAudioContext();
      if (!context) return;

      const play = () => {
        const startAt = context.currentTime;
        const frequencies =
          kind === "complete" ? [659.25, 783.99] : [523.25, 659.25];

        frequencies.forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const noteStartsAt = startAt + index * 0.15;
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, noteStartsAt);
          gain.gain.setValueAtTime(0.0001, noteStartsAt);
          gain.gain.exponentialRampToValueAtTime(
            0.16,
            noteStartsAt + 0.025,
          );
          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            noteStartsAt + 0.28,
          );
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(noteStartsAt);
          oscillator.stop(noteStartsAt + 0.3);
        });
      };

      if (context.state === "suspended") {
        void context.resume().then(play).catch(() => undefined);
      } else {
        play();
      }
    },
    [getAudioContext, soundEnabled],
  );

  const showBrowserNotification = useCallback(
    (title: string, body: string, tag: string) => {
      if (
        !browserNotificationsEnabled ||
        !("Notification" in window) ||
        window.Notification.permission !== "granted"
      ) {
        return;
      }

      const options: NotificationOptions = {
        body,
        icon: publicAssetPath("icon-192.png"),
        badge: publicAssetPath("icon-192.png"),
        tag,
      };
      const showFallback = () => {
        try {
          new window.Notification(title, options);
        } catch {
          // Service worker notifications cover browsers that reject this API.
        }
      };

      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker
          .getRegistration()
          .then((registration) =>
            registration
              ? registration.showNotification(title, options)
              : showFallback(),
          )
          .catch(showFallback);
      } else {
        showFallback();
      }
    },
    [browserNotificationsEnabled],
  );

  const announceTimerEvent = useCallback(
    (
      title: string,
      body: string,
      kind: "complete" | "auto-start",
      tag: string,
    ) => {
      playTimerSound(kind);
      showBrowserNotification(title, body, tag);
    },
    [playTimerSound, showBrowserNotification],
  );

  const startAutomaticSession = useCallback(
    async (
      nextMode: TimerMode,
      nextRound: number,
      focusTaskId: string | null,
      shouldAutoStart: boolean,
    ) => {
      const plannedSeconds = timerDurations[nextMode];
      setMode(nextMode);
      setCurrentRound(nextRound);
      setRemainingSeconds(plannedSeconds);
      remainingSnapshot.current = plannedSeconds;
      setIsRunning(false);

      if (nextMode === "focus" && !focusTaskId) {
        setPomodoroError(
          "반복 집중을 계속하려면 먼저 할 일을 선택해 주세요.",
        );
        return;
      }

      if (!shouldAutoStart) return;

      if (!authUserId) {
        const nextGuestTimer: GuestTimerSession = {
          elapsedSeconds: 0,
          lastResumedAt: Date.now(),
          mode: nextMode,
          plannedSeconds,
          status: "running",
          taskId: nextMode === "focus" ? focusTaskId : null,
        };
        setGuestTimer(nextGuestTimer);
        setIsRunning(true);
        announceTimerEvent(
          nextMode === "rest" ? "휴식 자동 시작" : "집중 자동 시작",
          nextMode === "rest"
            ? `${nextRound}/${repeatCount}회 집중을 마치고 휴식을 시작합니다.`
            : `${nextRound}/${repeatCount}회 집중을 시작합니다.`,
          "auto-start",
          `haru-auto-${nextMode}`,
        );
        return;
      }

      const started = await startPomodoro({
        todoId: nextMode === "focus" ? focusTaskId : null,
        mode: pomodoroModes[nextMode],
        plannedSeconds,
      });
      const startedMode = timerModes[started.mode];
      const remaining = getPomodoroRemaining(started);
      setActivePomodoro(started);
      setMode(startedMode);
      setRemainingSeconds(remaining);
      remainingSnapshot.current = remaining;
      setActiveTaskId((current) =>
        started.mode === "focus" ? started.todo_id : current,
      );
      setIsRunning(started.status === "running");
      broadcastPomodoroChange();
      announceTimerEvent(
        startedMode === "rest" ? "휴식 자동 시작" : "집중 자동 시작",
        startedMode === "rest"
          ? `${nextRound}/${repeatCount}회 집중을 마치고 휴식을 시작합니다.`
          : `${nextRound}/${repeatCount}회 집중을 시작합니다.`,
        "auto-start",
        `haru-auto-${startedMode}`,
      );
    },
    [
      announceTimerEvent,
      authUserId,
      broadcastPomodoroChange,
      repeatCount,
      timerDurations,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;

      const guestData = readGuestData();
      const guestHabitData = readGuestHabitData();
      const settings = readTimerSettings();
      const storedTimer = readGuestTimer();

      setGuestTasks(guestData.tasks);
      setGuestLists(guestData.lists);
      setGuestCompletedSessions(guestData.sessions);
      setGuestHabits(guestHabitData.habits);
      setGuestHabitCompletions(guestHabitData.completions);
      setTimerDurations({
        focus: settings.focus,
        rest: settings.rest,
      });
      setRepeatCount(settings.repeatCount);
      setCurrentRound(settings.currentRound);
      setSoundEnabled(settings.soundEnabled);
      setAutoStartRest(settings.autoStartRest);
      setAutoStartFocus(settings.autoStartFocus);
      const notificationsSupported = "Notification" in window;
      setBrowserNotificationsSupported(notificationsSupported);
      setBrowserNotificationsEnabled(
        settings.browserNotificationsEnabled &&
          notificationsSupported &&
          window.Notification.permission === "granted",
      );
      setGuestTimer(storedTimer);
      setGuestStorageReady(true);

      if (storedTimer) {
        const timerTask = guestData.tasks.find(
          (task) => task.id === storedTimer.taskId,
        );
        const elapsed = getGuestTimerElapsed(storedTimer);
        const remaining = Math.max(
          0,
          storedTimer.plannedSeconds - elapsed,
        );
        setMode(storedTimer.mode);
        setActiveTaskId(
          storedTimer.mode === "focus" ? storedTimer.taskId : null,
        );
        setActiveListId(timerTask?.listId ?? guestData.lists[0].id);
        setRemainingSeconds(remaining);
        remainingSnapshot.current = remaining;
        setIsRunning(storedTimer.status === "running");
      } else {
        const firstTask = guestData.tasks.find((task) => !task.completed);
        setActiveTaskId(firstTask?.id ?? null);
        setActiveListId(firstTask?.listId ?? guestData.lists[0].id);
        setRemainingSeconds(settings.focus);
        remainingSnapshot.current = settings.focus;
      }
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
        sessions: guestCompletedSessions,
        tasks: guestTasks,
      }),
    );
  }, [
    authUserId,
    guestCompletedSessions,
    guestLists,
    guestStorageReady,
    guestTasks,
  ]);

  useEffect(() => {
    if (!guestStorageReady || authUserId) return;

    if (guestTimer) {
      window.localStorage.setItem(
        GUEST_TIMER_KEY,
        JSON.stringify(guestTimer),
      );
    } else {
      window.localStorage.removeItem(GUEST_TIMER_KEY);
    }
  }, [authUserId, guestStorageReady, guestTimer]);

  useEffect(() => {
    if (!guestStorageReady) return;
    window.localStorage.setItem(
      TIMER_SETTINGS_KEY,
      JSON.stringify({
        ...timerDurations,
        autoStartFocus,
        autoStartRest,
        browserNotificationsEnabled,
        currentRound,
        repeatCount,
        soundEnabled,
      }),
    );
  }, [
    autoStartFocus,
    autoStartRest,
    browserNotificationsEnabled,
    currentRound,
    guestStorageReady,
    repeatCount,
    soundEnabled,
    timerDurations,
  ]);

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

  useEffect(
    () => () => {
      const context = audioContext.current;
      audioContext.current = null;
      if (context && context.state !== "closed") {
        void context.close();
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel("haru-pomodoro");
    pomodoroChannel.current = channel;
    channel.onmessage = () => {
      setPomodoroLoadedForUser(null);
      setPomodoroReloadToken((current) => current + 1);
    };

    return () => {
      channel.close();
      pomodoroChannel.current = null;
    };
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;

    let mounted = true;

    function applyUser(user: User | null) {
      setAuthUser(user);
      if (!user) {
        const storedGuestData = readGuestData();
        const storedGuestHabitData = readGuestHabitData();
        const storedTimerSettings = readTimerSettings();
        const storedGuestTimer = readGuestTimer();
        guestMigrationUser.current = null;
        guestHabitMigrationUser.current = null;
        setGuestTasks(storedGuestData.tasks);
        setGuestLists(storedGuestData.lists);
        setGuestCompletedSessions(storedGuestData.sessions);
        setGuestHabits(storedGuestHabitData.habits);
        setGuestHabitCompletions(storedGuestHabitData.completions);
        setRemoteTodos(null);
        setRemoteLists(null);
        setRemoteHabits(null);
        setHabitActionError(null);
        setRemoteFocusHistory([]);
        setTodoActionError(null);
        setPendingTodoIds(new Set());
        setActivePomodoro(null);
        setPomodoroLoadedForUser(null);
        setPomodoroError(null);
        setPomodoroPending(false);
        setRepeatCount(storedTimerSettings.repeatCount);
        setCurrentRound(storedTimerSettings.currentRound);
        setSoundEnabled(storedTimerSettings.soundEnabled);
        setAutoStartRest(storedTimerSettings.autoStartRest);
        setAutoStartFocus(storedTimerSettings.autoStartFocus);
        setBrowserNotificationsEnabled(
          storedTimerSettings.browserNotificationsEnabled &&
            "Notification" in window &&
            window.Notification.permission === "granted",
        );

        if (storedGuestTimer) {
          const timerTask = storedGuestData.tasks.find(
            (task) => task.id === storedGuestTimer.taskId,
          );
          const elapsed = getGuestTimerElapsed(storedGuestTimer);
          const remaining = Math.max(
            0,
            storedGuestTimer.plannedSeconds - elapsed,
          );
          setGuestTimer(storedGuestTimer);
          setActiveTaskId(
            storedGuestTimer.mode === "focus"
              ? storedGuestTimer.taskId
              : null,
          );
          setActiveListId(timerTask?.listId ?? storedGuestData.lists[0].id);
          setMode(storedGuestTimer.mode);
          setRemainingSeconds(remaining);
          remainingSnapshot.current = remaining;
          setIsRunning(storedGuestTimer.status === "running");
        } else {
          const firstTask = storedGuestData.tasks.find(
            (task) => !task.completed,
          );
          setActiveTaskId(firstTask?.id ?? null);
          setActiveListId(
            firstTask?.listId ?? storedGuestData.lists[0].id,
          );
          setIsRunning(false);
          setMode("focus");
          setRemainingSeconds(storedTimerSettings.focus);
          remainingSnapshot.current = storedTimerSettings.focus;
        }
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
          (guestTasks.length > 0 || guestCompletedSessions.length > 0)
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

          const guestTodoIds = new Map<string, string>();
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
            const matchingId = matchingIds?.shift();

            if (matchingId) {
              guestTodoIds.set(task.id, matchingId);
              return [];
            }

            const id = window.crypto.randomUUID();
            guestTodoIds.set(task.id, id);
            return [
              {
                id,
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
          await importCompletedPomodoros(
            guestCompletedSessions.map((session) => ({
              id: session.id,
              todoId: session.taskId
                ? (guestTodoIds.get(session.taskId) ?? null)
                : null,
              elapsedSeconds: session.elapsedSeconds,
              endedAt: session.endedAt,
            })),
          );

          nextTodos = [...todos, ...created].sort(
            (left, right) => left.position - right.position,
          );
          window.localStorage.removeItem(GUEST_DATA_KEY);
          window.localStorage.removeItem(GUEST_TIMER_KEY);
          setGuestTasks([]);
          setGuestLists([DEFAULT_LIST]);
          setGuestCompletedSessions([]);
          setGuestTimer(null);
          setPomodoroLoadedForUser(null);
          setPomodoroReloadToken((current) => current + 1);
          broadcastPomodoroChange();
          setMigrationNotice(
            `게스트 할 일 ${guestTasks.length}개와 집중 기록 ${guestCompletedSessions.length}개를 계정으로 옮겼습니다.`,
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
        setActiveTaskId((current) =>
          nextTasks.some((task) => task.id === current && !task.completed)
            ? current
            : (nextTasks.find((task) => !task.completed)?.id ?? null),
        );
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
    broadcastPomodoroChange,
    guestCompletedSessions,
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

  useEffect(() => {
    if (!authUserId) return;

    let mounted = true;

    Promise.allSettled([
      getActivePomodoro(),
      listRecentPomodoros(1000),
    ]).then(([activeResult, recentResult]) => {
      if (!mounted) return;

      setPomodoroLoadedForUser(authUserId);
      setPomodoroError(null);

      if (recentResult.status === "fulfilled") {
        const completedFocusSessions = recentResult.value.filter(
          (session) =>
            session.status === "completed" && session.mode === "focus",
        );
        const counts: Record<string, number> = {};

        for (const session of completedFocusSessions) {
          if (!session.todo_id) continue;
          counts[session.todo_id] = (counts[session.todo_id] ?? 0) + 1;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySessions = completedFocusSessions.filter((session) => {
          const endedAt = session.ended_at ?? session.started_at;
          return new Date(endedAt).getTime() >= today.getTime();
        });

        setPomodoroCounts(counts);
        setRemoteFocusHistory(
          completedFocusSessions.map((session) => ({
            elapsedSeconds: session.elapsed_seconds,
            endedAt: session.ended_at ?? session.started_at,
            taskId: session.todo_id,
          })),
        );
        setRemoteFocusSummary({
          seconds: todaySessions.reduce(
            (total, session) => total + session.elapsed_seconds,
            0,
          ),
          sessions: todaySessions.length,
        });
      } else {
        setRemoteFocusHistory([]);
        setPomodoroError(getErrorMessage(recentResult.reason));
      }

      if (activeResult.status === "fulfilled") {
        const active = activeResult.value;
        setActivePomodoro(active);

        if (active) {
          const nextMode = timerModes[active.mode];
          const remaining = getPomodoroRemaining(active);

          setMode(nextMode);
          setRemainingSeconds(remaining);
          remainingSnapshot.current = remaining;
          setActiveTaskId((current) =>
            active.mode === "focus" ? active.todo_id : current,
          );
          setIsRunning(active.status === "running");
        } else {
          setIsRunning(false);
        }
      } else {
        setActivePomodoro(null);
        setIsRunning(false);
        setPomodoroError(getErrorMessage(activeResult.reason));
      }
    });

    return () => {
      mounted = false;
    };
  }, [authUserId, pomodoroReloadToken]);

  useEffect(() => {
    if (!isRunning) remainingSnapshot.current = remainingSeconds;
  }, [isRunning, remainingSeconds]);

  useEffect(() => {
    if (!isRunning) return;

    const endsAt = Date.now() + remainingSnapshot.current * 1000;
    const intervalId = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemainingSeconds(next);

      if (next === 0) {
        window.clearInterval(intervalId);
        setIsRunning(false);
        announceTimerEvent(
          mode === "focus" ? "집중 종료" : "휴식 종료",
          mode === "focus"
            ? `${currentRound}/${repeatCount}회 집중을 마쳤습니다.`
            : "휴식이 끝났습니다.",
          "complete",
          `haru-complete-${mode}`,
        );

        if (authUserId && currentPomodoro) {
          setPomodoroPending(true);
          setPomodoroError(null);

          void completePomodoro(
            currentPomodoro.id,
            currentPomodoro.planned_seconds,
          )
            .then(async (completed) => {
              setActivePomodoro(null);
              broadcastPomodoroChange();

              if (completed.mode === "focus") {
                const todoId = completed.todo_id;
                if (todoId) {
                  setPomodoroCounts((current) => ({
                    ...current,
                    [todoId]: (current[todoId] ?? 0) + 1,
                  }));
                }

                setRemoteFocusSummary((current) => ({
                  seconds: current.seconds + completed.elapsed_seconds,
                  sessions: current.sessions + 1,
                }));
                setRemoteFocusHistory((current) => [
                  {
                    elapsedSeconds: completed.elapsed_seconds,
                    endedAt: completed.ended_at ?? completed.started_at,
                    taskId: completed.todo_id,
                  },
                  ...current,
                ]);
              }

              const completedMode = timerModes[completed.mode];
              const shouldContinue =
                completedMode === "rest" || currentRound < repeatCount;

              if (shouldContinue) {
                const nextMode =
                  completedMode === "focus" ? "rest" : "focus";
                const nextRound =
                  completedMode === "rest"
                    ? Math.min(currentRound + 1, repeatCount)
                    : currentRound;
                await startAutomaticSession(
                  nextMode,
                  nextRound,
                  completed.todo_id ?? activeTaskId,
                  nextMode === "rest" ? autoStartRest : autoStartFocus,
                );
                return;
              }

              setMode("focus");
              setCurrentRound(1);
              setRemainingSeconds(timerDurations.focus);
              remainingSnapshot.current = timerDurations.focus;
            })
            .catch((error: unknown) => {
              setPomodoroError(getErrorMessage(error));
            })
            .finally(() => {
              setPomodoroPending(false);
            });
        } else {
          setGuestTimer(null);

          if (mode === "focus" && activeTaskId !== null) {
            const elapsedSeconds =
              guestTimer?.plannedSeconds ?? timerDurations.focus;
            updateVisibleTasks((current) =>
              current.map((task) =>
                task.id === activeTaskId
                  ? { ...task, pomodoros: task.pomodoros + 1 }
                  : task,
              ),
            );
            setGuestCompletedSessions((current) => [
              ...current,
              {
                id: window.crypto.randomUUID(),
                elapsedSeconds,
                endedAt: new Date().toISOString(),
                taskId: activeTaskId,
              },
            ]);
          }

          const shouldContinue =
            mode === "rest" || currentRound < repeatCount;

          if (shouldContinue) {
            const nextMode = mode === "focus" ? "rest" : "focus";
            const nextRound =
              mode === "rest"
                ? Math.min(currentRound + 1, repeatCount)
                : currentRound;
            void startAutomaticSession(
              nextMode,
              nextRound,
              activeTaskId,
              nextMode === "rest" ? autoStartRest : autoStartFocus,
            );
          } else {
            setMode("focus");
            setCurrentRound(1);
            setRemainingSeconds(timerDurations.focus);
            remainingSnapshot.current = timerDurations.focus;
          }
        }
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [
    activeTaskId,
    announceTimerEvent,
    autoStartFocus,
    autoStartRest,
    authUserId,
    broadcastPomodoroChange,
    currentRound,
    currentPomodoro,
    guestTimer,
    isRunning,
    mode,
    repeatCount,
    startAutomaticSession,
    timerDurations.focus,
    updateVisibleTasks,
  ]);

  const progressPercent = useMemo(
    () => Math.round((completedCount / Math.max(tasks.length, 1)) * 100),
    [completedCount, tasks.length],
  );

  function handleModeChange(nextMode: TimerMode) {
    if (hasActiveTimerSession || pomodoroPending) return;
    setMode(nextMode);
    setCurrentRound(1);
    setRemainingSeconds(timerDurations[nextMode]);
    remainingSnapshot.current = timerDurations[nextMode];
    setIsRunning(false);
  }

  function handleRepeatCountChange(count: number) {
    if (hasActiveTimerSession || pomodoroPending) return;

    const safeCount = Math.min(
      Math.max(Math.floor(count), 1),
      MAX_REPEAT_COUNT,
    );
    setRepeatCount(safeCount);
    setCurrentRound(1);
  }

  function handleSoundEnabledChange(enabled: boolean) {
    setSoundEnabled(enabled);
    if (enabled) primeTimerSound();
  }

  async function handleBrowserNotificationsEnabledChange(enabled: boolean) {
    setNotificationMessage(null);

    if (!enabled) {
      setBrowserNotificationsEnabled(false);
      return;
    }

    if (!("Notification" in window)) {
      setBrowserNotificationsSupported(false);
      setNotificationMessage("이 브라우저는 알림을 지원하지 않습니다.");
      return;
    }

    try {
      const permission =
        window.Notification.permission === "default"
          ? await window.Notification.requestPermission()
          : window.Notification.permission;

      if (permission === "granted") {
        setBrowserNotificationsEnabled(true);
        setNotificationMessage("브라우저 알림을 켰습니다.");
      } else {
        setBrowserNotificationsEnabled(false);
        setNotificationMessage(
          "브라우저 설정에서 이 사이트의 알림을 허용해 주세요.",
        );
      }
    } catch {
      setBrowserNotificationsEnabled(false);
      setNotificationMessage("브라우저 알림 권한을 확인하지 못했습니다.");
    }
  }

  function handleDurationChange(seconds: number) {
    if (hasActiveTimerSession || pomodoroPending) return;

    const safeSeconds = Math.min(Math.max(Math.floor(seconds), 60), 86400);
    setTimerDurations((current) => ({
      ...current,
      [mode]: safeSeconds,
    }));
    setRemainingSeconds(safeSeconds);
    remainingSnapshot.current = safeSeconds;
  }

  async function handleToggleTask(id: string) {
    const task = tasks.find((candidate) => candidate.id === id);
    if (!task || pendingTodoIds.has(id)) return;
    if (
      hasActiveTimerSession &&
      mode === "focus" &&
      activeTaskId === id
    ) {
      setTodoActionError("실행 중인 포모도로를 먼저 완료하거나 취소해 주세요.");
      return;
    }

    const completed = !task.completed;
    const completedAt = completed ? new Date().toISOString() : null;
    updateVisibleTasks((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? { ...candidate, completed, completedAt }
          : candidate,
      ),
    );

    if (completed && activeTaskId === id) {
      setActiveTaskId(null);
      setIsRunning(false);
    }

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
          pomodoros: 0,
      };
      setGuestTasks((current) => [...current, createdTask]);
      if (listId === effectiveActiveListId) {
        setActiveTaskId((current) => current ?? createdTask.id);
      }
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
      if (listId === effectiveActiveListId) {
        setActiveTaskId((current) => current ?? createdTask.id);
      }
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
    if (
      listChanged &&
      hasActiveTimerSession &&
      activeTaskId === task.id
    ) {
      setTodoActionError(
        "실행 중인 집중 대상은 다른 리스트로 이동할 수 없습니다.",
      );
      return false;
    }

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
      if (activeTaskId === id && listChanged) {
        setActiveListId(update.listId);
      }
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
      if (activeTaskId === id && listChanged) {
        setActiveListId(update.listId);
      }
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
    if (
      hasActiveTimerSession ||
      !lists.some((list) => list.id === id) ||
      id === effectiveActiveListId
    ) {
      return;
    }

    const nextTasks = allTasks.filter((task) => task.listId === id);
    const nextActiveTask =
      nextTasks.find(
        (task) => task.id === activeTaskId && !task.completed,
      ) ?? nextTasks.find((task) => !task.completed);
    setActiveListId(id);
    setActiveTaskId(nextActiveTask?.id ?? null);
    setMode("focus");
    setCurrentRound(1);
    setRemainingSeconds(timerDurations.focus);
    remainingSnapshot.current = timerDurations.focus;
    setIsRunning(false);
  }

  async function handleAddList(nameValue: string) {
    const name = nameValue.trim();
    if (!name || hasActiveTimerSession) return false;
    setTodoActionError(null);

    if (!authUserId) {
      const nextList: TodoList = {
        id: window.crypto.randomUUID(),
        name,
        position: lists.length,
      };
      setGuestLists((current) => [...current, nextList]);
      setActiveListId(nextList.id);
      setActiveTaskId(null);
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
      setActiveTaskId(null);
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
    if (!list || lists.length <= 1 || hasActiveTimerSession) return false;
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

    const nextTask = allTasks.find(
      (task) => task.listId === fallbackList.id && !task.completed,
    );
    setActiveListId(fallbackList.id);
    setActiveTaskId(nextTask?.id ?? null);
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
    if (hasActiveTimerSession && activeTaskId && idSet.has(activeTaskId)) {
      setTodoActionError("실행 중인 포모도로를 먼저 완료하거나 취소해 주세요.");
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

    if (activeTaskId && idSet.has(activeTaskId)) {
      setActiveTaskId(
        tasks.find(
          (candidate) => !idSet.has(candidate.id) && !candidate.completed,
        )?.id ?? null,
      );
      setIsRunning(false);
      setRemainingSeconds(timerDurations[mode]);
      remainingSnapshot.current = timerDurations[mode];
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

  async function handleToggleTimer() {
    if (pomodoroPending || pomodoroLoading) return;
    if (!isRunning && soundEnabled) primeTimerSound();

    if (isRunning) {
      setIsRunning(false);

      if (!authUserId) {
        if (guestTimer) {
          setGuestTimer({
            ...guestTimer,
            elapsedSeconds: Math.max(
              0,
              guestTimer.plannedSeconds - remainingSeconds,
            ),
            lastResumedAt: null,
            status: "paused",
          });
        }
        return;
      }

      if (!currentPomodoro) return;

      const elapsedSeconds = Math.max(
        0,
        currentPomodoro.planned_seconds - remainingSeconds,
      );
      setPomodoroPending(true);
      setPomodoroError(null);

      try {
        const paused = await pausePomodoro(
          currentPomodoro.id,
          elapsedSeconds,
        );
        const remaining = getPomodoroRemaining(paused);
        setActivePomodoro(paused);
        setRemainingSeconds(remaining);
        remainingSnapshot.current = remaining;
        broadcastPomodoroChange();
      } catch (error) {
        remainingSnapshot.current = remainingSeconds;
        setIsRunning(true);
        setPomodoroError(getErrorMessage(error));
      } finally {
        setPomodoroPending(false);
      }
      return;
    }

    if (hasActiveTimerSession) {
      if (!authUserId) {
        if (guestTimer) {
          setGuestTimer({
            ...guestTimer,
            lastResumedAt: Date.now(),
            status: "running",
          });
        }
        remainingSnapshot.current = remainingSeconds;
        setIsRunning(true);
        return;
      }

      if (!currentPomodoro) return;

      setPomodoroPending(true);
      setPomodoroError(null);

      try {
        const resumed = await resumePomodoro(currentPomodoro.id);
        const remaining = getPomodoroRemaining(resumed);
        setActivePomodoro(resumed);
        setRemainingSeconds(remaining);
        remainingSnapshot.current = remaining;
        setIsRunning(true);
        broadcastPomodoroChange();
      } catch (error) {
        setPomodoroError(getErrorMessage(error));
      } finally {
        setPomodoroPending(false);
      }
      return;
    }

    if (mode === "focus" && !activeTask) return;

    setPomodoroError(null);

    if (!authUserId) {
      const guestSession: GuestTimerSession = {
        elapsedSeconds: 0,
        lastResumedAt: Date.now(),
        mode,
        plannedSeconds: timerDurations[mode],
        status: "running",
        taskId: mode === "focus" ? (activeTask?.id ?? null) : null,
      };
      setGuestTimer(guestSession);
      setRemainingSeconds(guestSession.plannedSeconds);
      remainingSnapshot.current = guestSession.plannedSeconds;
      setIsRunning(true);
      return;
    }

    setPomodoroPending(true);

    try {
      const started = await startPomodoro({
        todoId: mode === "focus" ? (activeTask?.id ?? null) : null,
        mode: pomodoroModes[mode],
        plannedSeconds: timerDurations[mode],
      });
      const nextMode = timerModes[started.mode];
      const remaining = getPomodoroRemaining(started);
      setActivePomodoro(started);
      setMode(nextMode);
      setRemainingSeconds(remaining);
      remainingSnapshot.current = remaining;
      setActiveTaskId((current) =>
        started.mode === "focus" ? started.todo_id : current,
      );
      setIsRunning(started.status === "running");
      broadcastPomodoroChange();
    } catch (error) {
      setPomodoroError(getErrorMessage(error));
    } finally {
      setPomodoroPending(false);
    }
  }

  async function handleResetTimer() {
    if (pomodoroPending) return;

    setIsRunning(false);
    setPomodoroError(null);

    if (!authUserId) {
      setGuestTimer(null);
      setCurrentRound(1);
      setRemainingSeconds(timerDurations[mode]);
      remainingSnapshot.current = timerDurations[mode];
      return;
    }

    if (!currentPomodoro) {
      setCurrentRound(1);
      setRemainingSeconds(timerDurations[mode]);
      remainingSnapshot.current = timerDurations[mode];
      return;
    }

    setPomodoroPending(true);
    const elapsedSeconds = getPomodoroElapsed(currentPomodoro);

    try {
      await cancelPomodoro(currentPomodoro.id, elapsedSeconds);
      setActivePomodoro(null);
      setCurrentRound(1);
      setRemainingSeconds(timerDurations[mode]);
      remainingSnapshot.current = timerDurations[mode];
      broadcastPomodoroChange();
    } catch (error) {
      setPomodoroError(getErrorMessage(error));
    } finally {
      setPomodoroPending(false);
    }
  }

  async function handleSkipTimer() {
    if (pomodoroPending || pomodoroLoading) return;

    const nextMode: TimerMode = mode === "focus" ? "rest" : "focus";
    const nextDuration = timerDurations[nextMode];
    const nextRound =
      mode === "rest"
        ? Math.min(currentRound + 1, repeatCount)
        : currentRound;
    const wasRunning = isRunning;
    setPomodoroError(null);

    if (!authUserId) {
      setIsRunning(false);
      setGuestTimer(null);
      setMode(nextMode);
      setCurrentRound(nextRound);
      setRemainingSeconds(nextDuration);
      remainingSnapshot.current = nextDuration;
      return;
    }

    if (!currentPomodoro) {
      setIsRunning(false);
      setMode(nextMode);
      setCurrentRound(nextRound);
      setRemainingSeconds(nextDuration);
      remainingSnapshot.current = nextDuration;
      return;
    }

    setIsRunning(false);
    setPomodoroPending(true);

    try {
      await cancelPomodoro(
        currentPomodoro.id,
        getPomodoroElapsed(currentPomodoro),
      );
      setActivePomodoro(null);
      setMode(nextMode);
      setCurrentRound(nextRound);
      setRemainingSeconds(nextDuration);
      remainingSnapshot.current = nextDuration;
      broadcastPomodoroChange();
    } catch (error) {
      remainingSnapshot.current = remainingSeconds;
      setIsRunning(wasRunning);
      setPomodoroError(getErrorMessage(error));
    } finally {
      setPomodoroPending(false);
    }
  }

  function handleRetryPomodoro() {
    setPomodoroError(null);
    setPomodoroLoadedForUser(null);
    setPomodoroReloadToken((current) => current + 1);
  }

  function handleSelectTask(id: string) {
    if (hasActiveTimerSession && id !== activeTaskId) return;
    setActiveTaskId(id);
    setMode("focus");
    setCurrentRound(1);
    setRemainingSeconds(timerDurations.focus);
    remainingSnapshot.current = timerDurations.focus;
    setIsRunning(false);

    if (window.matchMedia("(max-width: 980px)").matches) {
      window.requestAnimationFrame(() => {
        document.querySelector(".focus-column")?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "start",
        });
      });
    }
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
    if (hasActiveTimerSession && id !== activeTaskId) return;
    const task = allTasks.find((candidate) => candidate.id === id);
    if (task) setActiveListId(task.listId);
    handleSelectTask(id);
    setIsCalendarOpen(false);
  }

  async function handleAuthAction() {
    if (!supabaseConfigured || !authReady || authPending) return;

    setAuthError(null);
    setAuthPending(true);

    try {
      if (authUser) {
        if (currentPomodoro) {
          setIsRunning(false);
          const elapsedSeconds = getPomodoroElapsed(currentPomodoro);
          await cancelPomodoro(currentPomodoro.id, elapsedSeconds);
          setActivePomodoro(null);
          broadcastPomodoroChange();
        }
        await signOut();
      } else {
        setIsRunning(false);
        setGuestTimer(null);
        window.localStorage.removeItem(GUEST_TIMER_KEY);
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
        completedCount={completedCount}
        onAuthAction={handleAuthAction}
        totalCount={tasks.length}
      />

      <div className="workspace-frame">
        <ListRail
          activeListId={effectiveActiveListId}
          disabled={hasActiveTimerSession || todosLoading}
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
        <section className="dashboard-intro" aria-labelledby="dashboard-title">
          <div className="intro-copy">
            <p className="eyebrow">TODAY</p>
            <h1 id="dashboard-title">할 일과 집중 타이머</h1>
            <p>
              할 일을 고르고, 시간을 정한 뒤 바로 시작할 수 있습니다.
            </p>
          </div>

          <div className="intro-actions">
            <div
              className="daily-progress"
              aria-label={`오늘 할 일 ${progressPercent}% 완료`}
            >
              <span>오늘의 진행률</span>
              <strong>{progressPercent}%</strong>
              <div className="progress-track">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>
        </section>

        {migrationNotice && (
          <div className="install-preview" role="status">
            <div>
              <strong>게스트 데이터 이전 완료</strong>
              <span>{migrationNotice}</span>
            </div>
            <button type="button" onClick={() => setMigrationNotice(null)} aria-label="닫기">×</button>
          </div>
        )}

        {authError && (
          <div className="install-preview auth-error-preview" role="alert">
            <div>
              <strong>로그인하지 못했습니다</strong>
              <span>{authError}</span>
            </div>
            <button type="button" onClick={() => setAuthError(null)} aria-label="닫기">×</button>
          </div>
        )}

        <div className="product-grid">
          <TaskList
            tasks={tasks}
            listName={activeList?.name ?? "todo 리스트"}
            activeTaskId={activeTaskId}
            error={todosError}
            focusLocked={hasActiveTimerSession}
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
            onSelectTask={handleSelectTask}
          />

          <FocusTimer
            activeTask={activeTask}
            autoStartFocus={autoStartFocus}
            autoStartRest={autoStartRest}
            browserNotificationsEnabled={browserNotificationsEnabled}
            browserNotificationsSupported={browserNotificationsSupported}
            error={pomodoroError}
            hasActiveSession={hasActiveTimerSession}
            isPending={pomodoroPending || pomodoroLoading}
            mode={mode}
            notificationMessage={notificationMessage}
            remainingSeconds={remainingSeconds}
            repeatCount={repeatCount}
            soundEnabled={soundEnabled}
            currentRound={currentRound}
            totalSeconds={
              currentPomodoro?.planned_seconds ??
              guestTimer?.plannedSeconds ??
              timerDurations[mode]
            }
            todayCompletedSessions={todayCompletedSessions}
            todayFocusSeconds={todayFocusSeconds}
            isRunning={isRunning}
            onDurationChange={handleDurationChange}
            onAutoStartFocusChange={setAutoStartFocus}
            onAutoStartRestChange={setAutoStartRest}
            onBrowserNotificationsEnabledChange={
              handleBrowserNotificationsEnabledChange
            }
            onModeChange={handleModeChange}
            onRepeatCountChange={handleRepeatCountChange}
            onRetry={handleRetryPomodoro}
            onSkip={handleSkipTimer}
            onSoundEnabledChange={handleSoundEnabledChange}
            onToggleRunning={handleToggleTimer}
            onReset={handleResetTimer}
          />
        </div>
        </div>
      </div>

      <CalendarPanel
        activeTaskId={activeTaskId}
        activeListId={effectiveActiveListId}
        error={todosError}
        focusLocked={hasActiveTimerSession}
        focusHistory={focusHistory}
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
