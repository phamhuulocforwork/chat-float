# Popup blocker (Chat Float)

TypeScript/React implementation for blocking popups when **Block popup** is enabled in the extension popup.

- `inject/main.js` — MAIN-world hooks (`window.open`, links, forms). Must stay a classic script.
- `inject/isolated.tsx` — policy evaluation + React toast UI (Card/Button, shadow DOM).
- `policy.ts` — hostname allowlist and block heuristics.
- `service.ts` — background registration and action handlers.

MIT-licensed as part of Chat Float.
