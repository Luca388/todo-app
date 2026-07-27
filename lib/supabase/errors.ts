export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase 연결 정보가 없습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 설정해 주세요.",
    );
    this.name = "SupabaseNotConfiguredError";
  }
}

export class AuthRequiredError extends Error {
  constructor() {
    super("로그인이 필요한 기능입니다.");
    this.name = "AuthRequiredError";
  }
}
