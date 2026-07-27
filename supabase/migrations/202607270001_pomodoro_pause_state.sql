begin;

-- 실행 중인 구간의 시작점을 따로 저장해 일시정지 시간을 제외합니다.
alter table public.pomodoro_sessions
  add column last_resumed_at timestamptz;

update public.pomodoro_sessions
set last_resumed_at = started_at
where status = 'running';

alter table public.pomodoro_sessions
  drop constraint if exists pomodoro_sessions_status_check;

alter table public.pomodoro_sessions
  add constraint pomodoro_sessions_status_check
  check (status in ('running', 'paused', 'completed', 'cancelled'));

alter table public.pomodoro_sessions
  drop constraint if exists pomodoro_ended_state_check;

alter table public.pomodoro_sessions
  add constraint pomodoro_ended_state_check check (
    (
      status = 'running'
      and ended_at is null
      and last_resumed_at is not null
    )
    or (
      status = 'paused'
      and ended_at is null
      and last_resumed_at is null
    )
    or (
      status in ('completed', 'cancelled')
      and ended_at is not null
      and last_resumed_at is null
    )
  );

drop index if exists public.pomodoro_one_running_session_per_user_idx;

-- 일시정지된 세션도 활성 세션이므로 새 타이머와 중복되지 않게 합니다.
create unique index pomodoro_one_active_session_per_user_idx
  on public.pomodoro_sessions (user_id)
  where status in ('running', 'paused');

commit;
