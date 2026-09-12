import { expect, test as base } from "@playwright/test";

/**
 * Every public route the site builds. `routes.spec.ts` cross-checks this list
 * against the generated `dist/` tree, so a new page cannot be added without
 * also being covered here.
 */
export const ROUTES = [
  "/",
  "/privacy/",
  "/account-deletion/",
  "/support/",
] as const;

export type Route = (typeof ROUTES)[number];

export const PAGE_TITLES: Record<Route, string> = {
  "/": "Sonus Auris — A Dashcam for Audio",
  "/privacy/": "Privacy Policy — Sonus Auris",
  "/account-deletion/": "Delete your account and data — Sonus Auris",
  "/support/": "Support — Sonus Auris",
};

export const MOBILE_VIEWPORT = { width: 390, height: 844 };
export const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const OPTIONAL_ORES_CHAT_COMPONENT_URL =
  "https://ores-chat.github.io/components/v1/ores-chat-footer-link.js";

/**
 * Auto-applied fixture that fails any test whose page logged a console error,
 * threw an uncaught exception, failed a request, or reached an unexpected
 * off-origin resource.
 *
 * The sole exception is the exact, integrity-pinned ORES Chat enhancement.
 * Its light-DOM footer anchor remains usable while the distribution PR is not
 * deployed. Every other third-party resource or failure remains a defect.
 */
export const test = base.extend<{ pageProblems: string[] }>({
  pageProblems: [
    async ({ page, baseURL }, use) => {
      const problems: string[] = [];
      const origin = new URL(baseURL ?? "http://127.0.0.1:4321").origin;

      page.on("console", (message) => {
        const isOptionalBundle404 =
          message.location().url === OPTIONAL_ORES_CHAT_COMPONENT_URL &&
          message.text().startsWith("Failed to load resource:");
        if (message.type() === "error" && !isOptionalBundle404) {
          problems.push(`console.error: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => {
        problems.push(`pageerror: ${error.message}`);
      });
      page.on("requestfailed", (request) => {
        if (request.url() === OPTIONAL_ORES_CHAT_COMPONENT_URL) return;
        problems.push(
          `requestfailed: ${request.url()} (${request.failure()?.errorText})`,
        );
      });
      page.on("request", (request) => {
        const url = request.url();
        if (!url.startsWith("http")) return;
        if (url === OPTIONAL_ORES_CHAT_COMPONENT_URL) return;
        if (new URL(url).origin !== origin) {
          problems.push(`off-origin request: ${url}`);
        }
      });

      await use(problems);

      expect(
        problems,
        "page logged errors, failed requests, or requested a third-party origin",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
