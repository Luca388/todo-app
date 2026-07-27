begin;

create table public.todo_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index todo_lists_user_id_position_idx
  on public.todo_lists (user_id, position, created_at);

create trigger todo_lists_set_updated_at
before update on public.todo_lists
for each row execute function public.set_updated_at();

alter table public.todos
  add column list_id uuid references public.todo_lists(id) on delete cascade,
  add column completed_at timestamptz;

insert into public.todo_lists (user_id, name, position)
select distinct user_id, 'todo 리스트', 0
from public.todos;

update public.todos as todo
set list_id = list.id
from public.todo_lists as list
where list.user_id = todo.user_id
  and list.name = 'todo 리스트'
  and todo.list_id is null;

update public.todos
set completed_at = updated_at
where completed = true
  and completed_at is null;

alter table public.todos
  alter column list_id set not null;

create index todos_user_id_list_id_position_idx
  on public.todos (user_id, list_id, position, created_at);

alter table public.todo_lists enable row level security;
alter table public.todo_lists force row level security;

create policy "todo_lists_select_own"
on public.todo_lists
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "todo_lists_insert_own"
on public.todo_lists
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "todo_lists_update_own"
on public.todo_lists
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "todo_lists_delete_own"
on public.todo_lists
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy "todos_insert_own" on public.todos;
drop policy "todos_update_own" on public.todos;

create policy "todos_insert_own"
on public.todos
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.todo_lists
    where todo_lists.id = todos.list_id
      and todo_lists.user_id = (select auth.uid())
  )
);

create policy "todos_update_own"
on public.todos
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.todo_lists
    where todo_lists.id = todos.list_id
      and todo_lists.user_id = (select auth.uid())
  )
);

revoke all on table public.todo_lists from anon;
grant select, insert, update, delete on table public.todo_lists to authenticated;
grant all on table public.todo_lists to service_role;

commit;
