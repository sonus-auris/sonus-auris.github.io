// Own one intent-listener disposer per currently selected element, not per element lifetime.
export function createIntentRegistry({ root, selector, install, onError = () => {} }) {
  if (!root || typeof root.querySelectorAll !== 'function' || typeof install !== 'function') {
    throw new TypeError('An intent registry requires a queryable root and installer');
  }
  const entries = new Map();
  let generation = 0;
  let refreshing = false;
  let clearing = false;
  const report = (error) => {
    try { void Promise.resolve(onError(error)).catch(() => {}); } catch { /* isolated reporting */ }
  };
  const dispose = (entry) => {
    const cleanup = entry.cleanup;
    entry.cleanup = undefined;
    try { cleanup?.(); } catch (error) { report(error); }
  };
  const clear = () => {
    if (clearing) return;
    clearing = true;
    generation += 1;
    const pending = [...entries.values()];
    entries.clear();
    try { for (const entry of pending) dispose(entry); } finally { clearing = false; }
  };
  const refresh = () => {
    if (refreshing || clearing) return;
    refreshing = true;
    const started = generation;
    try {
      const selected = new Set([...root.querySelectorAll(selector)].filter(element => element.isConnected !== false));
      for (const [element, entry] of entries) {
        if (selected.has(element)) continue;
        entries.delete(element);
        dispose(entry);
      }
      for (const element of selected) {
        if (started !== generation) break;
        if (entries.has(element)) continue;
        const entry = {};
        entries.set(element, entry); // Reserve before calling a possibly reentrant installer.
        try {
          entry.cleanup = install(element);
          if (typeof entry.cleanup !== 'function') throw new TypeError('Intent installer must return a disposer');
          if (started !== generation || entries.get(element) !== entry) dispose(entry);
        } catch (error) {
          if (entries.get(element) === entry) entries.delete(element);
          report(error);
        }
      }
    } finally { refreshing = false; }
  };
  return Object.freeze({ refresh, clear });
}
