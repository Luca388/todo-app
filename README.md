# 하루

할 일, 일정, 포모도로 집중 기록을 한 화면에서 관리하는 한국어 PWA입니다.
로그인 전에는 브라우저에 저장하고, Google로 로그인하면 Supabase 계정에
할 일과 집중 기록을 동기화합니다.

## 주요 기능

- 여러 개의 할 일 리스트 생성, 이름 변경, 삭제
- 전체·미완료·완료 필터와 완료 항목 하단 정렬
- 드래그 또는 위·아래 버튼을 이용한 할 일 순서 변경
- 오늘 날짜가 기본으로 지정되는 빠른 할 일 추가
- 월간 일정에서 날짜별 할 일, 완료 작업, 집중 시간 확인
- 매일·매주·매월 반복 일정
- 집중·휴식 타이머, 반복 횟수, 건너뛰기, 자동 시작
- 브라우저 알림과 완료 소리
- 오늘과 최근 집중 기록
- Google 로그인 및 사용자별 Supabase RLS 데이터 분리
- 설치 가능한 오프라인 PWA

## 기술 구성

- React, TypeScript, Vinext, Vite
- Supabase Auth, PostgreSQL, Row Level Security
- Cloudflare Worker 호환 빌드
- Service Worker와 Web App Manifest

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

기본 개발 주소는 `http://localhost:3000`입니다.

`.env.local`에는 Supabase Dashboard의 Project URL과 Publishable key를
입력합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Publishable key는 브라우저용 공개 키입니다. `service_role` 키나 다른
Secret key는 이 프로젝트의 프론트 환경변수에 넣지 마세요.

## Supabase 설정

자세한 절차는 [`supabase/SETUP.md`](supabase/SETUP.md)에 있습니다.

새 프로젝트에서는 Supabase SQL Editor에서
`supabase/migrations`의 SQL 파일을 파일명 순서대로 실행합니다. 기존
프로젝트에서는 아직 실행하지 않은 최신 마이그레이션만 적용합니다.

반복 일정에는 다음 파일까지 적용되어 있어야 합니다.

```text
supabase/migrations/202607280002_todo_recurrence.sql
```

Google 로그인은 Supabase Authentication에서 Provider와 Redirect URL을
별도로 설정해야 합니다.

## 검증 명령

```bash
npm test
npm run lint
npm run build
```

`npm test`는 프로덕션 빌드와 핵심 기능 연결 검사를 함께 실행합니다.

## 데이터와 보안

- 로그인 전 데이터는 브라우저의 로컬 저장소에만 보관됩니다.
- 로그인하면 게스트 할 일과 집중 기록을 계정으로 한 번 이전합니다.
- 로그인 데이터는 모든 테이블의 RLS 정책으로 사용자별 분리됩니다.
- `.env.local`, 로컬 로그, 빌드 결과와 배포용 압축파일은 Git에서
  제외됩니다.
