import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIntentRegistry } from '../public/owls/intent-registry.mjs';

function fixture() {
  const a = { isConnected: true }, b = { isConnected: true };
  let selected = [a, b];
  const calls = [], errors = [];
  const options = {
    root: { querySelectorAll: () => selected }, selector: 'a[data-account-action]',
    install(element) {
      const call = { element, releases: 0 }; calls.push(call);
      return () => { call.releases += 1; };
    },
    onError: error => errors.push(error),
  };
  return { a, b, calls, errors, options, select: value => { selected = value; } };
}

test('repeated page-load refreshes install each current element once', () => {
  const f = fixture(); const registry = createIntentRegistry(f.options);
  registry.refresh(); registry.refresh();
  assert.equal(f.calls.length, 2);
  registry.clear(); assert.ok(f.calls.every(call => call.releases === 1));
});

test('before-swap cleanup permits reinstalling the same retained elements', () => {
  const f = fixture(); const registry = createIntentRegistry(f.options);
  registry.refresh(); registry.clear(); registry.refresh();
  assert.equal(f.calls.length, 4);
  assert.deepEqual(f.calls.map(call => call.releases), [1, 1, 0, 0]);
  registry.clear(); assert.ok(f.calls.every(call => call.releases === 1));
});

test('cleanup remains idempotent across repeated swap/dispose events', () => {
  const f = fixture(); const registry = createIntentRegistry(f.options);
  registry.refresh(); registry.clear(); registry.clear();
  assert.deepEqual(f.calls.map(call => call.releases), [1, 1]);
});

test('refresh drops disconnected elements instead of retaining their listeners', () => {
  const f = fixture(); const registry = createIntentRegistry(f.options);
  registry.refresh(); f.a.isConnected = false; registry.refresh();
  assert.deepEqual(f.calls.map(call => call.releases), [1, 0]);
  f.a.isConnected = true; registry.refresh();
  assert.equal(f.calls.length, 3); registry.clear();
});

test('an element which no longer matches the selector releases ownership', () => {
  const f = fixture(); const registry = createIntentRegistry(f.options);
  registry.refresh(); f.select([f.b]); registry.refresh();
  assert.deepEqual(f.calls.map(call => call.releases), [1, 0]); registry.clear();
});

test('teardown reentered during installation releases the returned disposer once', () => {
  const f = fixture(); let registry;
  registry = createIntentRegistry({ ...f.options, install(element) {
    registry.clear(); return f.options.install(element);
  } });
  registry.refresh();
  assert.equal(f.calls.length, 1, 'teardown cancels the rest of this installation generation');
  assert.equal(f.calls[0].releases, 1); registry.clear();
  assert.equal(f.calls[0].releases, 1);
});

test('recursive refresh cannot install duplicate ownership', () => {
  const f = fixture(); let registry;
  registry = createIntentRegistry({ ...f.options, install(element) {
    registry.refresh(); return f.options.install(element);
  } });
  registry.refresh(); assert.equal(f.calls.length, 2); registry.clear();
});

test('one failing installer or disposer cannot strand another element', () => {
  const f = fixture();
  const registry = createIntentRegistry({ ...f.options, install(element) {
    if (element === f.a) throw new Error('installer failed');
    return () => { throw new Error('disposer failed'); };
  } });
  registry.refresh(); registry.clear(); registry.clear();
  assert.deepEqual(f.errors.map(error => error.message), ['installer failed', 'disposer failed']);
});

test('reentrant refresh during cleanup cannot reacquire listeners', () => {
  const f = fixture(); let registry;
  registry = createIntentRegistry({ ...f.options, install(element) {
    const dispose = f.options.install(element);
    return () => { dispose(); registry.refresh(); };
  } });
  registry.refresh(); registry.clear();
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls.every(call => call.releases === 1));
});

test('rejected diagnostic sinks do not become unhandled rejections', async () => {
  const f = fixture();
  const registry = createIntentRegistry({ ...f.options,
    install() { throw new Error('installer failure'); },
    onError: async () => { throw new Error('diagnostic sink failure'); },
  });
  registry.refresh(); registry.clear();
  await new Promise(resolve => setImmediate(resolve));
});
