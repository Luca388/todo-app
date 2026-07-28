import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

function getPagesBasePath() {
  const configuredBase = process.env.PAGES_BASE_PATH?.trim();
  if (configuredBase) {
    const withLeadingSlash = configuredBase.startsWith("/")
      ? configuredBase
      : `/${configuredBase}`;
    return withLeadingSlash.endsWith("/")
      ? withLeadingSlash
      : `${withLeadingSlash}/`;
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1);
  return process.env.GITHUB_ACTIONS === "true" && repositoryName
    ? `/${repositoryName}/`
    : "/";
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    fileEnv.NEXT_PUBLIC_SUPABASE_URL ??
    "";
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    fileEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "";

  return {
    root: path.resolve(process.cwd(), "github-pages"),
    base: getPagesBasePath(),
    publicDir: path.resolve(process.cwd(), "public"),
    plugins: [react()],
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY":
        JSON.stringify(supabasePublishableKey),
    },
    build: {
      outDir: path.resolve(process.cwd(), "dist-pages"),
      emptyOutDir: true,
    },
  };
});
