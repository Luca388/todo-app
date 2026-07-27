export type TodoLabel = "work" | "personal" | "health";
export type PomodoroMode = "focus" | "short_break" | "long_break";
export type PomodoroStatus = "running" | "completed" | "cancelled";

export type Database = {
  public: {
    Tables: {
      todos: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          label: TodoLabel;
          completed: boolean;
          due_at: string | null;
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
          due_at?: string | null;
          position?: number;
          estimated_pomodoros?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          label?: TodoLabel;
          completed?: boolean;
          due_at?: string | null;
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
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          todo_id?: string | null;
          status?: PomodoroStatus;
          elapsed_seconds?: number;
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

export type PomodoroSessionRow =
  Database["public"]["Tables"]["pomodoro_sessions"]["Row"];
export type PomodoroSessionInsert =
  Database["public"]["Tables"]["pomodoro_sessions"]["Insert"];
