begin;

alter table public.todos
  add column recurrence text not null default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  add column recurrence_spawned boolean not null default false;

create or replace function public.complete_recurring_todo(
  target_todo_id uuid
)
returns setof public.todos
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_todo public.todos%rowtype;
  next_todo public.todos%rowtype;
  next_due_at timestamptz;
  should_spawn boolean;
begin
  select *
  into current_todo
  from public.todos
  where id = target_todo_id
    and user_id = (select auth.uid())
    and completed = false
  for update;

  if not found then
    return;
  end if;

  should_spawn :=
    current_todo.recurrence <> 'none'
    and current_todo.due_at is not null
    and current_todo.recurrence_spawned = false;

  update public.todos
  set
    completed = true,
    completed_at = now(),
    recurrence_spawned = recurrence_spawned or should_spawn
  where id = current_todo.id
  returning * into current_todo;

  return next current_todo;

  if not should_spawn then
    return;
  end if;

  next_due_at := case current_todo.recurrence
    when 'daily' then current_todo.due_at + interval '1 day'
    when 'weekly' then current_todo.due_at + interval '7 days'
    when 'monthly' then current_todo.due_at + interval '1 month'
  end;

  insert into public.todos (
    user_id,
    title,
    label,
    completed,
    completed_at,
    due_at,
    list_id,
    position,
    estimated_pomodoros,
    recurrence,
    recurrence_spawned
  )
  values (
    current_todo.user_id,
    current_todo.title,
    current_todo.label,
    false,
    null,
    next_due_at,
    current_todo.list_id,
    (
      select coalesce(max(position), -1) + 1
      from public.todos
      where user_id = current_todo.user_id
        and list_id = current_todo.list_id
    ),
    current_todo.estimated_pomodoros,
    current_todo.recurrence,
    false
  )
  returning * into next_todo;

  return next next_todo;
end;
$$;

revoke all on function public.complete_recurring_todo(uuid) from public;
revoke all on function public.complete_recurring_todo(uuid) from anon;
grant execute on function public.complete_recurring_todo(uuid) to authenticated;
grant execute on function public.complete_recurring_todo(uuid) to service_role;

commit;
