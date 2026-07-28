begin;

-- 앱에서 UUID를 보내지 않는 클라이언트도 안전하게 INSERT할 수 있도록
-- 실제 운영 테이블에서 누락될 수 있는 기본값을 복구합니다.
alter table public.todos
  alter column id set default gen_random_uuid();

alter table public.todo_lists
  alter column id set default gen_random_uuid();

alter table public.pomodoro_sessions
  alter column id set default gen_random_uuid();

commit;
