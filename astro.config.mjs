// @ts-check
import { defineConfig } from 'astro/config';
import { oresWasmLoader } from './integrations/ores-wasm-loader.mjs';

const requestedPort = Number.parseInt(process.env.SONUS_AURIS_SITE_PORT ?? '', 10);
const port = Number.isInteger(requestedPort) && requestedPort >= 1 && requestedPort <= 65_535
  ? requestedPort
  : 4321;

const productionSite = 'https://sonusauris.app';
const requestedSite = process.env.SONUS_AURIS_SITE_URL?.trim();
const requestedBase = process.env.SONUS_AURIS_SITE_BASE?.trim();

export default defineConfig({
  site: requestedSite || productionSite,
  base: requestedBase || '/',
  server: {
    port,
    host: process.env.SONUS_AURIS_SITE_HOST ?? true,
  },
  integrations: [
    oresWasmLoader({
      appId: 'sonus-auris',
      triggerSelector: 'a[data-account-action],a[href="#download"]',
    }),
  ],
});
