# Supabase 연결 안내

이 폴더는 투두와 포모도로 데이터를 저장할 Supabase 설정을 보관합니다.
프론트 화면은 이 스키마에 연결되어 있습니다.

## 1. Supabase 프로젝트 만들기

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인합니다.
2. **New project**를 선택합니다.
3. 프로젝트 이름, 데이터베이스 비밀번호, 가까운 리전을 선택합니다.

프로젝트 하나 안에 로그인(Auth), PostgreSQL 데이터베이스, API가 함께 생성됩니다. 별도의 Node 서버를 먼저 만들 필요가 없는 이유입니다.

## 2. 테이블과 보안 규칙 만들기

1. 왼쪽 메뉴에서 **SQL Editor**를 엽니다.
2. `migrations` 폴더의 SQL을 파일명 순서대로 실행합니다.
3. 이미 앞선 SQL을 실행했다면 새로 추가된 SQL만 이어서 실행합니다.

이 SQL은 다음 항목을 한 번에 만듭니다.

- `todos`: 사용자별 할 일
- `pomodoro_sessions`: 타이머 실행 기록
- `todo_lists`: 이름을 바꾸거나 추가·삭제할 수 있는 할 일 리스트
- `due_at`, `completed_at`: 캘린더 일정과 날짜별 완료 기록
- `recurrence`: 매일·매주·매월 반복 일정
- 인덱스: 사용자별 목록 조회 속도 개선
- RLS 정책: 다른 사용자의 행을 읽거나 바꾸지 못하게 차단

## 3. 프로젝트 주소와 공개 키 넣기

1. Supabase의 **Project Settings → API**를 엽니다.
2. Project URL과 Publishable key를 확인합니다.
3. 프로젝트 루트에 `.env.local` 파일을 만듭니다.
4. `.env.example`을 참고해 두 값을 입력합니다.

Publishable key는 브라우저에 포함되어도 되는 키입니다. 비밀번호 역할을 하는 Secret key 또는 `service_role` 키는 절대로 프론트 코드나 `.env.local`의 `NEXT_PUBLIC_` 항목에 넣지 않습니다.

## 4. Google 로그인 준비

1. Supabase에서 **Authentication → Providers → Google**을 엽니다.
2. Google Cloud Console에서 OAuth Client ID와 Client Secret을 만듭니다.
3. Supabase가 보여주는 Callback URL을 Google OAuth의 승인된 리디렉션 URI에 등록합니다.
4. Google Client ID와 Client Secret을 Supabase에 저장하고 Provider를 활성화합니다.
5. Supabase의 **Authentication → URL Configuration**에서 아래 주소를 등록합니다.

- 개발: `http://localhost:3000/**`
- 배포 후: 실제 서비스 주소와 `/**` 경로

## 5. 연결된 모듈

환경 변수가 준비되면 프론트 화면에서 다음 모듈을 연결합니다.

- `lib/supabase/auth.ts`: Google 로그인과 로그아웃
- `lib/supabase/todos.ts`: 할 일 조회·추가·수정·삭제
- `lib/supabase/pomodoro.ts`: 실행 중인 타이머와 완료 기록

로그인 전 임시 할 일과 리스트는 기기에 보관되고, 첫 로그인 때 계정으로 옮겨집니다.
