"use client";

import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./client";
import { AuthRequiredError } from "./errors";

export async function signInWithGoogle(redirectTo?: string) {
  const client = getSupabaseBrowserClient();
  const fallbackRedirect =
    typeof window === "undefined"
      ? undefined
      : `${window.location.origin}${window.location.pathname}`;

  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo ?? fallbackRedirect,
    },
  });

  if (error) throw error;
}

export async function signOut() {
  const { error } = await getSupabaseBrowserClient().auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } =
    await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await getSupabaseBrowserClient().auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthRequiredError();
  return user;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const { data } = getSupabaseBrowserClient().auth.onAuthStateChange(callback);
  return data.subscription;
}
