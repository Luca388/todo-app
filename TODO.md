# Haru App 작업 목록

투두와 포모도로를 결합한 설치형 웹앱을 만드는 것이 목표입니다.
현재는 핵심 기능과 Supabase 연동, 비공개 배포까지 구현된 상태입니다.

## 0. 현재 완료된 작업

- [x] 투두·포모도로 프론트엔드 시안 제작
- [x] 반응형 레이아웃과 기본 타이머 동작 구현
- [x] 프로젝트 `.gitignore` 정리
- [x] Supabase 브라우저 라이브러리 설치
- [x] `todos`와 `pomodoro_sessions` 데이터 구조 작성
- [x] 사용자별 데이터 접근을 제한하는 RLS 정책 작성
- [x] 로그인, 투두 CRUD, 포모도로 저장 모듈 작성

## 1. GitHub 저장소 준비

- [x] GitHub 원격 저장소 연결
- [x] 로컬 프로젝트를 Git 저장소로 초기화
- [x] 첫 커밋에 포함할 파일 범위 확인
- [x] 프론트엔드 프로토타입 커밋 생성
- [ ] 기본 브랜치를 GitHub에 푸시
- [x] `.env.local`, 빌드 결과, 로컬 캐시가 올라가지 않았는지 확인

추천 첫 커밋 메시지:

```text
feat: 투두·포모도로 프론트엔드 프로토타입 구현
```

## 2. Supabase 프로젝트 설정

- [ ] Supabase 무료 프로젝트 생성
- [ ] 프로젝트 리전을 가까운 지역으로 선택
- [ ] SQL Editor에서 초기 마이그레이션 실행
- [ ] `todos` 테이블 생성 확인
- [ ] `pomodoro_sessions` 테이블 생성 확인
- [ ] 각 테이블의 RLS 활성화 확인
- [ ] Project URL과 Publishable key 확인
- [ ] `.env.example`을 참고해 `.env.local` 작성

실행할 SQL:

```text
supabase/migrations/202607190001_initial_schema.sql
```

주의사항:

- Publishable key는 프론트엔드에서 사용할 수 있습니다.
- Secret key와 `service_role` 키는 프론트엔드에 넣지 않습니다.
- 실제 키가 들어 있는 `.env.local`은 GitHub에 올리지 않습니다.

## 3. 로그인 설정

- [ ] Supabase Authentication에서 Google Provider 활성화
- [ ] Google Cloud Console에서 OAuth Client 생성
- [ ] Supabase Callback URL을 Google 승인 리디렉션 URI에 등록
- [ ] 개발 주소를 Supabase Redirect URL에 등록
- [ ] 배포 주소를 Supabase Redirect URL에 등록
- [ ] Google 로그인과 로그아웃 동작 확인
- [ ] 새로고침 후에도 로그인 상태가 유지되는지 확인

개발 주소:

```text
http://localhost:3000/**
```

## 4. 백엔드 연결 확인

- [ ] 로그인 사용자로 투두 추가 테스트
- [ ] 투두 목록 조회 테스트
- [ ] 투두 수정과 완료 처리 테스트
- [ ] 투두 삭제 테스트
- [ ] 포모도로 시작 기록 저장 테스트
- [ ] 포모도로 완료와 취소 기록 테스트
- [ ] 동시에 타이머 두 개가 실행되지 않는지 확인
- [ ] 다른 사용자의 데이터에 접근할 수 없는지 확인

## 5. 프론트엔드 전면 개편

- [ ] 전체 화면 구조 확정
- [ ] 모바일 우선 레이아웃 설계
- [ ] 로그인 전과 로그인 후 화면 구분
- [ ] 오늘, 예정, 완료 화면 설계
- [ ] 투두 추가·수정·삭제 UI 재구성
- [ ] 할 일별 집중 시작 흐름 재구성
- [ ] 포모도로 타이머 UI 재구성
- [ ] 로딩, 빈 목록, 오류 상태 디자인
- [ ] 키보드와 모바일 터치 조작 확인

프론트 개편은 Supabase 데이터 구조와 로그인 흐름이 확인된 후 시작합니다.

## 6. 실제 데이터 연결

- [ ] 시안용 임시 데이터를 제거
- [ ] 로그인 사용자 투두를 Supabase에서 불러오기
- [ ] 투두 추가·수정·삭제를 Supabase와 연결
- [ ] 포모도로 시작·완료·취소를 Supabase와 연결
- [ ] 로그인 전 임시 데이터를 기기에 저장
- [ ] 첫 로그인 때 임시 데이터를 사용자 계정으로 이전
- [ ] 네트워크 오류 시 재시도와 안내 메시지 추가

## 7. PWA 설치 기능

- [ ] 웹 앱 이름과 아이콘 확정
- [ ] 192px, 512px, maskable 아이콘 제작
- [ ] Web App Manifest 추가
- [ ] Service Worker와 오프라인 캐시 추가
- [ ] Chromium용 앱 설치 버튼 연결
- [ ] iPhone용 `홈 화면에 추가` 안내 추가
- [ ] 설치 후 standalone 화면 확인
- [ ] 오프라인에서 기본 화면이 열리는지 확인

## 8. 배포

- [ ] 최종 프론트 구조가 GitHub Pages 정적 배포에 맞는지 확인
- [ ] 저장소 하위 경로에 맞게 base path 설정
- [ ] GitHub Actions 배포 작업 작성
- [ ] GitHub Pages 첫 배포
- [ ] Supabase Site URL과 Redirect URL에 실제 주소 반영
- [ ] 모바일과 데스크톱에서 배포 화면 확인

## 9. 출시 전 점검

- [ ] 로그인하지 않은 사용자의 접근 범위 확인
- [ ] 사용자별 데이터 분리 재확인
- [ ] 타이머 백그라운드 시간 계산 확인
- [ ] 잘못된 입력과 긴 제목 처리 확인
- [ ] 접근성 레이블과 포커스 이동 확인
- [ ] 개인정보 처리 안내 필요 여부 확인
- [ ] README에 실행 방법과 환경변수 설정 방법 작성

## 현재 우선순위

1. `202607280002_todo_recurrence.sql` Supabase 적용
2. 순서 변경과 반복 일정 실제 계정 테스트
3. GitHub 기본 브랜치 푸시
4. 모바일과 설치형 PWA 최종 점검
