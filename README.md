# 하루

[앱 열기](https://luca388.github.io/todo-app/)

개인적으로 사용하려고 만든 할 일 관리 앱입니다.
로그인하지 않으면 데이터가 현재 브라우저에 저장되고, Google로 로그인하면
Supabase 계정에 동기화됩니다.

## 로컬에서 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

기본 개발 주소는 `http://localhost:3000`입니다.

`.env.local`에 Supabase 프로젝트의 URL과 Publishable key를 입력합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

`service_role` 키와 Secret key는 프론트 환경변수에 넣으면 안 됩니다.

## Supabase 설정

설정 방법은 [`supabase/SETUP.md`](supabase/SETUP.md)를 참고하세요.

새 Supabase 프로젝트에서는 SQL Editor를 열고 `supabase/migrations`의
파일을 이름순으로 실행합니다. Google 로그인을 사용하려면 Authentication에서
Google Provider와 Redirect URL도 설정해야 합니다.

## 확인

```bash
npm test
npm run lint
```

GitHub Pages용 정적 빌드만 확인하려면 다음 명령을 사용합니다.

```bash
PAGES_BASE_PATH=/todo-app/ npm run build:pages
```

## GitHub Pages 배포

저장소에서 다음 항목을 한 번 설정합니다.

1. **Settings → Secrets and variables → Actions → Variables**에 다음
   Repository variable을 추가합니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
2. **Settings → Pages → Build and deployment → Source**를
   **GitHub Actions**로 선택합니다.
3. Supabase의 **Authentication → URL Configuration → Redirect URLs**에
   `https://luca388.github.io/todo-app/**`를 추가합니다.

이후 `main` 브랜치에 푸시하면 GitHub Actions가 자동으로 배포합니다.

## 개발 노트

코딩 공부와 실사용을 겸해 Codex와 대화하면서 만든 바이브 코딩 프로젝트입니다.
직접 사용하며 필요한 기능을 계속 추가하고 있습니다.
