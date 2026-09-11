import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:https';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// OWLS admits HTTPS assets only. Serve the same production dist as the existing preview,
// but over genuine TLS; never relax producer URL validation to accommodate an HTTP fixture.
const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const types: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
let server: Server | undefined;
let temporary: string | undefined;
let origin: string;

// This exception is limited to this file's ephemeral self-signed test certificate.
// It neither changes the application's TLS settings nor bypasses its document CSP.
test.use({ ignoreHTTPSErrors: true });
test.beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'sonus-owls-https-'));
  const key = join(temporary, 'key.pem'), cert = join(temporary, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key,
    '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext',
    'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
  server = createServer({ key: await readFile(key), cert: await readFile(cert) }, (req, res) => {
    void (async () => {
      if (!['GET', 'HEAD'].includes(req.method ?? '')) { res.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'https://localhost').pathname);
      const path = resolve(dist, `.${pathname}`, pathname.endsWith('/') ? 'index.html' : '');
      if (!path.startsWith(resolve(dist) + sep)) { res.writeHead(404).end(); return; }
      const bytes = await readFile(path);
      res.writeHead(200, {
        'Content-Type': types[extname(path)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    })().catch(() => { if (!res.headersSent) res.writeHead(404); res.end(); });
  });
  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject);
    server!.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing HTTPS fixture address');
  origin = `https://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  if (temporary) await rm(temporary, { recursive: true });
});

async function observePreparation(page: Page) {
  await page.addInitScript(() => {
    Reflect.set(globalThis, '__owlsPreparedCount', 0);
    Reflect.set(globalThis, '__owlsErrors', []);
    Reflect.set(globalThis, '__owlsExecutionCalls', []);
    globalThis.addEventListener('ores-wasm-loader:prepared', () => {
      Reflect.set(globalThis, '__owlsPreparedCount', Reflect.get(globalThis, '__owlsPreparedCount') + 1);
    });
    globalThis.addEventListener('ores-wasm-loader:error', (event) => {
      Reflect.get(globalThis, '__owlsErrors').push((event as CustomEvent).detail);
    });
    for (const name of ['compile', 'compileStreaming', 'instantiate', 'instantiateStreaming']) {
      const original = Reflect.get(WebAssembly, name);
      if (typeof original !== 'function') continue;
      Reflect.set(WebAssembly, name, function (...args: unknown[]) {
        Reflect.get(globalThis, '__owlsExecutionCalls').push(name);
        return Reflect.apply(original, WebAssembly, args);
      });
    }
  });
  await page.goto(`${origin}/`);
  await page.waitForFunction(() => '__ORES_WASM_LOADER__' in globalThis || Reflect.get(globalThis, '__owlsErrors').length > 0);
  expect(await page.evaluate(() => Reflect.get(globalThis, '__owlsErrors'))).toEqual([]);
  expect(await page.evaluate(() => Reflect.get(globalThis, '__owlsPreparedCount'))).toBe(0);
}

async function expectFetchOnlyPreparation(page: Page) {
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, '__owlsPreparedCount'))).toBe(1);
  const observed = await page.evaluate(() => {
    const receipt = Reflect.get(globalThis, '__ORES_WASM_LOADER__').receipt();
    return {
      status: receipt?.status, bytes: receipt?.bytes,
      execution: Reflect.get(globalThis, '__owlsExecutionCalls'),
      errors: Reflect.get(globalThis, '__owlsErrors'),
    };
  });
  expect(observed).toEqual({ status: 'warmed', bytes: 8, execution: [], errors: [] });
}

test('retained account link can prepare after an Astro swap lifecycle', async ({ page }) => {
  await observePreparation(page);
  await page.evaluate(() => {
    document.dispatchEvent(new Event('astro:before-swap'));
    document.dispatchEvent(new Event('astro:page-load'));
  });
  await page.locator('a[data-account-action]').first().dispatchEvent('pointerdown', { pointerType: 'mouse' });
  await expectFetchOnlyPreparation(page);
});

test('repeated Astro page-load events do not duplicate preparation ownership', async ({ page }) => {
  await observePreparation(page);
  await page.evaluate(() => {
    document.dispatchEvent(new Event('astro:page-load'));
    document.dispatchEvent(new Event('astro:page-load'));
    document.dispatchEvent(new Event('astro:page-load'));
  });
  await page.locator('a[data-account-action]').first().dispatchEvent('pointerdown', { pointerType: 'mouse' });
  await expectFetchOnlyPreparation(page);
});
