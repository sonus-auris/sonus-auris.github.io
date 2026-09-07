import { test, expect } from '@playwright/test';

async function observePreparation(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForFunction(() => '__ORES_WASM_LOADER__' in globalThis);
  await page.evaluate(() => {
    Reflect.set(globalThis, '__owlsPreparedCount', 0);
    globalThis.addEventListener('ores-wasm-loader:prepared', () => {
      Reflect.set(globalThis, '__owlsPreparedCount', Reflect.get(globalThis, '__owlsPreparedCount') + 1);
    });
  });
}

test('retained account link can prepare after an Astro swap lifecycle', async ({ page }) => {
  await observePreparation(page);
  await page.evaluate(() => {
    document.dispatchEvent(new Event('astro:before-swap'));
    document.dispatchEvent(new Event('astro:page-load'));
  });
  await page.locator('a[data-account-action]').first().dispatchEvent('pointerdown', { pointerType: 'mouse' });
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, '__owlsPreparedCount'))).toBe(1);
  expect(await page.evaluate(() => Boolean(Reflect.get(globalThis, '__ORES_WASM_LOADER__').receipt()))).toBe(false);
});

test('repeated Astro page-load events do not duplicate preparation ownership', async ({ page }) => {
  await observePreparation(page);
  await page.evaluate(() => {
    document.dispatchEvent(new Event('astro:page-load'));
    document.dispatchEvent(new Event('astro:page-load'));
    document.dispatchEvent(new Event('astro:page-load'));
  });
  await page.locator('a[data-account-action]').first().dispatchEvent('pointerdown', { pointerType: 'mouse' });
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, '__owlsPreparedCount'))).toBe(1);
  expect(await page.evaluate(() => Boolean(Reflect.get(globalThis, '__ORES_WASM_LOADER__').receipt()))).toBe(false);
});
