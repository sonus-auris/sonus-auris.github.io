import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const interfaces = '231510f5d01046af657be42a5d4215be12622042';
const loader = 'deae23537d27aed94bdc2510649f99393379a617';
const digest = '93a44bbb96c751218e4c00d479e4c14358122a389acca16205b1e4d0dc5f9476';
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
async function filesBelow(directory) {
  const directoryPath = typeof directory === 'string' ? directory : fileURLToPath(directory);
  const results = [];
  for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
    const path = join(directoryPath, entry.name);
    if (entry.isDirectory()) results.push(...await filesBelow(path));
    else results.push(path);
  }
  return results;
}

test('Astro config registers the Sonus Auris loader', async () => {
  const config = await source('astro.config.mjs');
  assert.match(config, /oresWasmLoader/);
  assert.match(config, /appId:\s*['"]sonus-auris['"]/);
  assert.match(config, /data-account-action/);
});

test('bootstrap pins and verifies the shared releases', async () => {
  const client = await source('public/owls/marketing-loader.mjs');
  assert.match(client, new RegExp(interfaces));
  assert.match(client, new RegExp(loader));
  assert.match(client, new RegExp(digest));
  assert.match(client, /prepareOnIntent/);
  assert.doesNotMatch(client, /unsafe-eval/);
});

test('ordinary load never activates the probe', async () => {
  const client = await source('public/owls/marketing-loader.mjs');
  assert.equal([...client.matchAll(/coordinator\.activate\(/g)].length, 1);
  assert.match(client, /activateProbe:\s*\(\)\s*=>\s*coordinator\.activate/);
  assert.doesNotMatch(client, /addEventListener\(['"]click['"]/);
});

test('workflow builds and verifies the integration', async () => {
  const workflow = await source('.github/workflows/owls-loader.yml');
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run build/);
});

test('static build contains the page bootstrap', async () => {
  const files = await filesBelow(new URL('../dist/', import.meta.url));
  const output = (await Promise.all(files.filter((path) => ['.html', '.js', '.mjs'].includes(extname(path))).map((path) => readFile(path, 'utf8')))).join('\n');
  assert.match(output, /owls\/marketing-loader\.mjs/);
  assert.match(output, /ores\.wasm-loader\.marketing\.bootstrap\.v1/);
});
