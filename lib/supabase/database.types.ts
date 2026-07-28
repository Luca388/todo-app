export type TodoLabel = "work" | "personal" | "health";
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
      habits: {
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
      habit_completions: {
        Row: {
          habit_id: string;
          user_id: string;
          completed_on: string;
          created_at: string;
        };
        Insert: {
          habit_id: string;
          user_id?: string;
          completed_on: string;
          created_at?: string;
        };
        Update: {
          completed_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
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
    Functions: Record<string, never>;
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
export type HabitRow = Database["public"]["Tables"]["habits"]["Row"];
export type HabitInsert = Database["public"]["Tables"]["habits"]["Insert"];
export type HabitCompletionRow =
  Database["public"]["Tables"]["habit_completions"]["Row"];
export type HabitCompletionInsert =
  Database["public"]["Tables"]["habit_completions"]["Insert"];

export type PomodoroSessionRow =
  Database["public"]["Tables"]["pomodoro_sessions"]["Row"];
export type PomodoroSessionInsert =
  Database["public"]["Tables"]["pomodoro_sessions"]["Insert"];
