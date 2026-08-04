/**
 * R6 regression guard — public demo credential exposure.
 *
 * Background: the unauthenticated /login page rendered a "Demo accounts —
 * click to fill" block listing four role accounts (including a platform
 * administrator) alongside their shared password in plain text. On the
 * production custom domain this is reachable by anyone with no
 * authentication, no tooling and no prior access — Vercel Standard Protection
 * exempts custom production domains, so deployment-level protection does not
 * cover this. See docs/rule-studio/30a-retained-risk-acceptance-register.md
 * §R6 and docs/deployed-comparison/01-deployment-identity.md.
 *
 * This test statically inspects the actual login source files rather than
 * rendering the component, because the repository has no component-render
 * test harness (no @testing-library/react, no jsdom). A source check is the
 * right tool here regardless: the defect was that credential material existed
 * in code that ships to an unauthenticated route, so asserting it is absent
 * from that source is a direct, low-dependency guard against reintroduction —
 * by this change or any future one.
 *
 * This test intentionally does NOT contain the literal removed password. It
 * asserts the login source contains no password-shaped literal, and no
 * quick-fill / demo-account affordance, at all.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const LOGIN_DIR = join(__dirname, "..", "..", "app", "(auth)", "login");

function loginSourceFiles(): { path: string; content: string }[] {
  return readdirSync(LOGIN_DIR)
    .filter((f) => /\.(t|j)sx?$/.test(f))
    .map((f) => {
      const path = join(LOGIN_DIR, f);
      return { path, content: readFileSync(path, "utf8") };
    });
}

test("login source renders no demo-account credential block", () => {
  const files = loginSourceFiles();
  assert.ok(files.length > 0, "expected to find login source files to inspect");

  for (const { path, content } of files) {
    assert.doesNotMatch(
      content,
      /demo accounts?\s*(—|-|:)?\s*click to fill/i,
      `${path} still renders a "demo accounts — click to fill" affordance`
    );
    assert.doesNotMatch(
      content,
      /quickFill/,
      `${path} still contains a quick-fill credential handler`
    );
    assert.doesNotMatch(
      content,
      /DEMO_ACCOUNTS/,
      `${path} still declares a DEMO_ACCOUNTS list`
    );
  }
});

test("login source contains no password-shaped literal", () => {
  const files = loginSourceFiles();

  // Matches "password: <literal>", "password=<literal>", or a password shown
  // next to a role/account label — the shape the exposed credential took.
  // Case-insensitive; deliberately broad rather than matching the specific
  // removed string, so a differently-worded reintroduction still fails.
  const passwordLiteralPattern =
    /password\s*[:=]\s*['"`<]?[A-Za-z0-9!@#$%^&*_-]{4,}/i;

  for (const { path, content } of files) {
    assert.doesNotMatch(
      content,
      passwordLiteralPattern,
      `${path} appears to contain a password literal rendered in source`
    );
  }
});

test("login page component does not thread a credential value as a prop", () => {
  const serverComponentPath = join(LOGIN_DIR, "page.tsx");
  const content = readFileSync(serverComponentPath, "utf8");
  // Deliberately narrow: `passwordUpdated` (a boolean "your password changed"
  // flag) is legitimate and must not trip this. What must never appear is a
  // credential VALUE being passed — e.g. `password={...}` or a literal.
  assert.doesNotMatch(
    content,
    /\bpassword\s*=\s*[{"'`]/i,
    `${serverComponentPath} appears to pass a password value as a prop — the server login route must not thread credential material`
  );
});
