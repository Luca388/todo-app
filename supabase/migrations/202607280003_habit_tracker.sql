-- 사용자별 습관과 날짜별 완료 체크를 저장합니다.
begin;

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index habits_user_id_position_idx
  on public.habits (user_id, position, created_at);

create trigger habits_set_updated_at
before update on public.habits
for each row execute function public.set_updated_at();

create table public.habit_completions (
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  completed_on date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, completed_on)
);

create index habit_completions_user_id_date_idx
  on public.habit_completions (user_id, completed_on);

alter table public.habits enable row level security;
alter table public.habits force row level security;
alter table public.habit_completions enable row level security;
alter table public.habit_completions force row level security;

create policy "habits_select_own"
on public.habits
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "habits_insert_own"
on public.habits
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "habits_update_own"
on public.habits
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "habits_delete_own"
on public.habits
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "habit_completions_select_own"
on public.habit_completions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "habit_completions_insert_own"
on public.habit_completions
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.habits
    where habits.id = habit_completions.habit_id
      and habits.user_id = (select auth.uid())
  )
);

create policy "habit_completions_update_own"
on public.habit_completions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.habits
    where habits.id = habit_completions.habit_id
      and habits.user_id = (select auth.uid())
  )
);

create policy "habit_completions_delete_own"
on public.habit_completions
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.habits from anon;
revoke all on table public.habit_completions from anon;
grant select, insert, update, delete on table public.habits to authenticated;
grant select, insert, update, delete on table public.habit_completions to authenticated;
grant all on table public.habits to service_role;
grant all on table public.habit_completions to service_role;

commit;
