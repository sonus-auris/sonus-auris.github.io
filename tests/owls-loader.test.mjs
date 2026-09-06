import { access, readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const interfaces = '231510f5d01046af657be42a5d4215be12622042';
const loader = 'deae23537d27aed94bdc2510649f99393379a617';
const digest = '93a44bbb96c751218e4c00d479e4c14358122a389acca16205b1e4d0dc5f9476';
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
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

test('bootstrap pins verified releases and uses only same-origin runtime assets', async () => {
  const client = await source('public/owls/marketing-loader.mjs');
  for (const value of [interfaces, loader, digest]) {
    assert.match(client, new RegExp(value));
  }
  assert.match(client, /prepareOnIntent/);
  assert.match(client, /\.\/vendor\/owls-web-loader\//);
  assert.match(client, /\.\/vendor\/owls-interfaces\/index\.mjs/);
  assert.doesNotMatch(client, /cdn\.jsdelivr\.net|raw\.githubusercontent\.com/);
  assert.doesNotMatch(client, /credentials\s*:/);
  assert.doesNotMatch(client, /unsafe-eval/);
});

test('build materializes exact upstream blobs before Astro runs', async () => {
  const packageJson = JSON.parse(await source('package.json'));
  assert.equal(packageJson.scripts['owls:materialize'], 'node scripts/materialize-owls.mjs');
  assert.equal(packageJson.scripts.build, 'npm run owls:materialize && astro build');
  const materializer = await source('scripts/materialize-owls.mjs');
  assert.match(materializer, new RegExp(interfaces));
  assert.match(materializer, new RegExp(loader));
  assert.match(materializer, /gitBlobSha/);
  assert.match(materializer, new RegExp(digest));
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
  assert.match(workflow, /node --test tests\/owls-loader\.test\.mjs/);
});

test('static build contains the bootstrap and verified same-origin runtime', async () => {
  const dist = join(repositoryRoot, 'dist');
  const files = await filesBelow(dist);
  const output = (await Promise.all(files
    .filter((path) => ['.html', '.js', '.mjs'].includes(extname(path)))
    .map((path) => readFile(path, 'utf8')))).join('\n');
  assert.match(output, /owls\/marketing-loader\.mjs/);
  assert.match(output, /ores\.wasm-loader\.marketing\.bootstrap\.v1/);

  const vendor = join(dist, 'owls', 'vendor');
  await Promise.all([
    access(join(vendor, 'owls-interfaces', 'index.mjs')),
    access(join(vendor, 'owls-interfaces', 'schemas', 'release.schema.json')),
    access(join(vendor, 'owls-web-loader', 'src', 'coordinator.mjs')),
    access(join(vendor, 'owls-web-loader', 'fixtures', 'empty.wasm')),
  ]);
  const manifest = JSON.parse(await readFile(join(vendor, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.sources.map(({ repo, commit }) => ({ repo, commit })), [
    { repo: 'owls-interfaces', commit: interfaces },
    { repo: 'owls-web-loader', commit: loader },
  ]);
  assert.equal(
    manifest.files.find((file) => file.path === 'fixtures/empty.wasm')?.sha256,
    digest,
  );
});
