import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const navSource = await readFile(
  new URL("../src/components/Nav.astro", import.meta.url),
  "utf8",
);
const footerSource = await readFile(
  new URL("../src/components/Footer.astro", import.meta.url),
  "utf8",
);
const layoutSource = await readFile(
  new URL("../src/layouts/Base.astro", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("marketing account actions terminate at the Sonus Auris Rust web server", () => {
  assert.match(navSource, /const APP_ORIGIN = "https:\/\/user\.sonusauris\.app";/);
  assert.match(navSource, /const LOGIN_URL = `\$\{APP_ORIGIN\}\/login`;/);
  assert.match(navSource, /const SIGNUP_URL = `\$\{APP_ORIGIN\}\/signup`;/);
  assert.match(navSource, /const DASHBOARD_URL = `\$\{APP_ORIGIN\}\/dashboard`;/);

  for (const action of ["login", "signup", "dashboard"]) {
    assert.match(navSource, new RegExp(`data-account-action="${action}"`));
  }
  assert.match(navSource, /role="group" aria-label="Account"/);
});

test("account navigation preserves download access and isolates every off-origin link", () => {
  assert.match(navSource, /class="download-action" href="#download">Get the app<\/a>/);
  const isolatedExternalLinks = navSource.match(/rel="noopener noreferrer"/g) ?? [];
  assert.equal(isolatedExternalLinks.length, 4);
});

test("the static marketing header contains no browser-side auth credentials", () => {
  assert.doesNotMatch(navSource, /SUPABASE_(?:SECRET|SERVICE_ROLE|ANON|PUBLISHABLE)_KEY/);
  assert.doesNotMatch(navSource, /AUTH_BROWSER_.*SECRET/);
  assert.doesNotMatch(navSource, /Bearer\s+[A-Za-z0-9._~-]+/);
});

test("ORES Chat is an integrity-pinned footer-only enhancement without React", () => {
  assert.match(footerSource, /<ores-chat-footer-link context-id="sonus-auris">/);
  assert.match(footerSource, /https:\/\/ores-chat\.github\.io\/chat\/\?context=sonus-auris/);
  assert.doesNotMatch(navSource, /<ores-chat-footer-link/);
  assert.match(layoutSource, /https:\/\/ores-chat\.github\.io\/components\/v1\/ores-chat-footer-link\.js/);
  assert.match(layoutSource, /integrity="sha256-PcjdZ659Rfs\/5n5kNR3v\/GK4dd0KTyHjh0gY7o\/Z\/kc="/);
  assert.doesNotMatch(
    JSON.stringify({ ...packageJson.dependencies, ...packageJson.devDependencies }),
    /"react(?:-dom)?"/i,
  );
});
