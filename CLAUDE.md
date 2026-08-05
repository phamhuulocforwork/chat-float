# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser extension built with [Extension.js](https://extension.js.org) v4 (MV3). The extension adds a sidebar panel to the browser with a simple page. It supports Chrome, Firefox, and Edge.

## Key Files

| File | Purpose |
|------|---------|
| `src/manifest.json` | Extension manifest (MV3 for Chromium, MV2 for Firefox) |
| `src/background.js` | Service worker / background script — opens sidebar on toolbar click |
| `src/content/ContentApp.js` | Content script UI — floating pill button injected into pages |
| `src/content/scripts.js` | Content script entrypoint — mounts ContentApp in shadow DOM |
| `src/sidebar/SidebarApp.js` | Sidebar page UI — rendered inside the side panel |
| `src/sidebar/index.html` | Sidebar HTML shell |
| `extension.config.js` | Extension.js config (browser profiles, CI flags) |

## Architecture

The extension uses Extension.js zero-config build system (Rspack under the hood). Three execution contexts:

1. **Background** (`background.js`) — service worker on Chromium, background script on Firefox. Handles toolbar/sidebar action clicks and cross-origin messaging.
2. **Content scripts** (`content/scripts.js` + `ContentApp.js`) — injected into all URLs, mounts a shadow-DOM widget with a floating pill button. Uses `chrome.runtime.sendMessage` / `browser.runtime.sendMessage` to communicate with the background.
3. **Sidebar** (`sidebar/`) — HTML page loaded into the browser side panel. Self-contained with its own styles.

## Commands

```bash
npm run dev          # Development mode (launches fresh browser profile)
npm run dev -- --browser=firefox   # Target specific browser
npm run start        # Alternative dev command
npm run build        # Production build (Chrome default)
npm run build:firefox
npm run build:edge
npm run preview      # Preview production build
```

## Development Notes

- Uses ES modules (`"type": "module"` in package.json)
- The `extension` package (`^4.0.26`) is the sole dev dependency — it provides the CLI, build, and dev server
- HMR is built-in during `npm run dev`; content script teardown is handled by the returned cleanup function from the content script entrypoint
- No additional dependencies are needed — the JavaScript template ships bare
