begin;

-- 투두 한 건을 저장하는 핵심 테이블입니다.
-- user_id가 auth.users를 가리켜서 로그인 계정과 데이터 소유자를 연결합니다.
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  label text not null default 'personal' check (label in ('work', 'personal', 'health')),
  completed boolean not null default false,
  due_at timestamptz,
  position integer not null default 0 check (position >= 0),
  estimated_pomodoros smallint not null default 1 check (estimated_pomodoros between 1 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 포모도로의 시작, 완료, 취소 기록을 남깁니다.
-- 할 일을 지워도 집중 기록은 통계를 위해 남기고 todo_id만 null로 바뀝니다.
create table public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  todo_id uuid references public.todos(id) on delete set null,
  mode text not null default 'focus' check (mode in ('focus', 'short_break', 'long_break')),
  status text not null default 'running' check (status in ('running', 'completed', 'cancelled')),
  planned_seconds integer not null check (planned_seconds between 1 and 86400),
  elapsed_seconds integer not null default 0 check (elapsed_seconds between 0 and 86400),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pomodoro_ended_state_check check (
    (status = 'running' and ended_at is null)
    or (status in ('completed', 'cancelled') and ended_at is not null)
  )
);

-- 사용자별 조회가 빠르도록 소유자 컬럼에 인덱스를 둡니다.
create index todos_user_id_position_idx
  on public.todos (user_id, position, created_at);

create index todos_user_id_due_at_idx
  on public.todos (user_id, due_at)
  where due_at is not null;

create index pomodoro_sessions_user_id_started_at_idx
  on public.pomodoro_sessions (user_id, started_at desc);

-- 한 계정에서 동시에 여러 타이머가 실행되는 실수를 DB에서도 막습니다.
create unique index pomodoro_one_running_session_per_user_idx
  on public.pomodoro_sessions (user_id)
  where status = 'running';

-- 수정할 때 updated_at을 자동 갱신합니다.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger todos_set_updated_at
before update on public.todos
for each row execute function public.set_updated_at();

-- RLS(Row Level Security)를 켜면 아래 정책을 통과한 행만 API로 접근할 수 있습니다.
alter table public.todos enable row level security;
alter table public.todos force row level security;
alter table public.pomodoro_sessions enable row level security;
alter table public.pomodoro_sessions force row level security;

create policy "todos_select_own"
on public.todos
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "todos_insert_own"
on public.todos
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "todos_update_own"
on public.todos
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "todos_delete_own"
on public.todos
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "pomodoro_select_own"
on public.pomodoro_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "pomodoro_insert_own"
on public.pomodoro_sessions
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    todo_id is null
    or exists (
      select 1
      from public.todos
      where todos.id = pomodoro_sessions.todo_id
        and todos.user_id = (select auth.uid())
    )
  )
);

create policy "pomodoro_update_own"
on public.pomodoro_sessions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    todo_id is null
    or exists (
      select 1
      from public.todos
      where todos.id = pomodoro_sessions.todo_id
        and todos.user_id = (select auth.uid())
    )
  )
);

create policy "pomodoro_delete_own"
on public.pomodoro_sessions
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- 로그인하지 않은 요청은 테이블에 접근할 권한 자체가 없습니다.
revoke all on table public.todos from anon;
revoke all on table public.pomodoro_sessions from anon;

grant select, insert, update, delete on table public.todos to authenticated;
grant select, insert, update, delete on table public.pomodoro_sessions to authenticated;
grant all on table public.todos to service_role;
grant all on table public.pomodoro_sessions to service_role;

commit;
