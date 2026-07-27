import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Haru app and authentication entry points", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>하루 \| 투두와 포모도로<\/title>/);
  assert.match(html, /class="app-shell"/);
  assert.match(html, /오늘도 한 걸음씩\./);
  assert.match(html, /게스트 모드/);
  assert.match(html, /Google 로그인/);
  assert.match(html, /로그인 확인 중…/);
});

test("wires the Supabase auth lifecycle to desktop and mobile controls", async () => {
  const [app, sidebar] = await Promise.all([
    readFile(
      new URL("../app/components/TodoTimerApp.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/Sidebar.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(app, /getCurrentSession/);
  assert.match(app, /onAuthStateChange/);
  assert.match(app, /subscription\.unsubscribe\(\)/);
  assert.match(app, /await signInWithGoogle\(\)/);
  assert.match(app, /await signOut\(\)/);
  assert.match(app, /className="mobile-auth-button"/);
  assert.match(sidebar, /onClick=\{onAuthAction\}/);
  assert.match(sidebar, /disabled=\{authDisabled\}/);
});
