# Shared WebAssembly loader pilot

Sonus Auris participates in the `ores-wasm-loaders` marketing pilot. The Astro build injects one same-origin bootstrap module, but it does not start Flutter, Leptos, Dioxus, or product application code during ordinary page load.

Account and download links start fetch-only preparation after 150 ms of sustained pointer or keyboard intent. The prepared resource is an 8-byte public WebAssembly canary. The explicit `globalThis.__ORES_WASM_LOADER__.activateProbe()` diagnostic activates it; production navigation does not.

## Immutable inputs

- `owls-interfaces`: `231510f5d01046af657be42a5d4215be12622042`
- `owls-web-loader`: `deae23537d27aed94bdc2510649f99393379a617`
- canary SHA-256: `93a44bbb96c751218e4c00d479e4c14358122a389acca16205b1e4d0dc5f9476`

Before Astro builds or starts the development server, `scripts/materialize-owls.mjs` downloads the minimum runtime module graph from those exact Git commits. Every file is checked against its expected Git blob SHA-1; the canary is also checked against its declared SHA-256. A deterministic receipt is emitted at `public/owls/vendor/manifest.json`, and the generated vendor directory remains ignored by Git.

The browser imports only same-origin files under `/owls/vendor/`. The site's CSP continues to permit scripts only from itself and the existing SRI-pinned ORES Chat host. `connect-src 'self'` permits only local schema and canary reads required by the coordinator; no remote API, jsDelivr, or raw-GitHub browser connection is allowed. GitHub is contacted only by the build materializer, before deployment.

This pilot proves coordinator integration, verified intent preparation, cancellation, and strict origin boundaries. It does not claim that a running runtime survives full-page navigation or that different top-level sites share one universal browser cache.
