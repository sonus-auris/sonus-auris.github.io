# Shared WebAssembly loader pilot

Sonus Auris participates in the `ores-wasm-loaders` marketing pilot. The Astro build loads the shared coordinator and independent `owls-interfaces` contract, but it does not start Flutter, Leptos, Dioxus, or product code during ordinary page load.

Account and download links start fetch-only preparation after 150 ms of sustained pointer or keyboard intent. The prepared resource is an 8-byte public WebAssembly canary. The explicit `globalThis.__ORES_WASM_LOADER__.activateProbe()` diagnostic activates it; production navigation does not.

Pinned inputs:

- `owls-interfaces`: `b0e687c88b652d25964c041e2fdd0222f512fddd`
- `owls-web-loader`: `3b92396e34ffd0ba6411261957e47dd62cf3b4a4`
- SHA-256: `93a44bbb96c751218e4c00d479e4c14358122a389acca16205b1e4d0dc5f9476`

Requests are credentialless. No account state, cookies, form contents, tokens, or private endpoints are sent. The pilot proves coordinator integration and verified intent preparation; it does not claim that a running runtime survives navigation or that different top-level sites share one universal browser cache.
