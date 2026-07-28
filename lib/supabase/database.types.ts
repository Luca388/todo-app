export type TodoLabel = "work" | "personal" | "health";
export type TodoRecurrence = "none" | "daily" | "weekly" | "monthly";
export type PomodoroMode = "focus" | "short_break" | "long_break";
export type PomodoroStatus =
  | "running"
  | "paused"
  | "completed"
  | "cancelled";

export type Database = {
  public: {
    Tables: {
      todo_lists: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          position?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      todos: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          label: TodoLabel;
          completed: boolean;
          completed_at: string | null;
          due_at: string | null;
          list_id: string;
          position: number;
          estimated_pomodoros: number;
          recurrence: TodoRecurrence;
          recurrence_spawned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          label?: TodoLabel;
          completed?: boolean;
          completed_at?: string | null;
          due_at?: string | null;
          list_id?: string;
          position?: number;
          estimated_pomodoros?: number;
          recurrence?: TodoRecurrence;
          recurrence_spawned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          label?: TodoLabel;
          completed?: boolean;
          completed_at?: string | null;
          due_at?: string | null;
          list_id?: string;
          position?: number;
          estimated_pomodoros?: number;
          recurrence?: TodoRecurrence;
          recurrence_spawned?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      pomodoro_sessions: {
        Row: {
          id: string;
          user_id: string;
          todo_id: string | null;
          mode: PomodoroMode;
          status: PomodoroStatus;
          planned_seconds: number;
          elapsed_seconds: number;
          started_at: string;
          last_resumed_at: string | null;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          todo_id?: string | null;
          mode?: PomodoroMode;
          status?: PomodoroStatus;
          planned_seconds: number;
          elapsed_seconds?: number;
          started_at?: string;
          last_resumed_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          todo_id?: string | null;
          status?: PomodoroStatus;
          elapsed_seconds?: number;
          last_resumed_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pomodoro_sessions_todo_id_fkey";
            columns: ["todo_id"];
            isOneToOne: false;
            referencedRelation: "todos";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      complete_recurring_todo: {
        Args: { target_todo_id: string };
        Returns: Database["public"]["Tables"]["todos"]["Row"][];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TodoRow = Database["public"]["Tables"]["todos"]["Row"];
export type TodoInsert = Database["public"]["Tables"]["todos"]["Insert"];
export type TodoUpdate = Database["public"]["Tables"]["todos"]["Update"];
export type TodoListRow =
  Database["public"]["Tables"]["todo_lists"]["Row"];
export type TodoListInsert =
  Database["public"]["Tables"]["todo_lists"]["Insert"];
export type TodoListUpdate =
  Database["public"]["Tables"]["todo_lists"]["Update"];

export type PomodoroSessionRow =
  Database["public"]["Tables"]["pomodoro_sessions"]["Row"];
export type PomodoroSessionInsert =
  Database["public"]["Tables"]["pomodoro_sessions"]["Insert"];
