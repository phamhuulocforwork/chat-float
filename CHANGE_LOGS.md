# Release Notes / Change Log

## Version: v1.0.1

**Release Date:** 2026-08-17

---

## Bug Fixes

* Content script injects on all `youtube.com` pages and initializes on `yt-navigate-finish`, so the overlay works on first open without reloading the tab when navigating from the homepage, search, or other SPA routes
* Overlay mount observer attaches to `document.documentElement` and waits for `document.body` at `document_start`, fixing cold-load failures when YouTube replaces the DOM
* Style injection waits for `document.head` at `document_start`, fixing `TypeError: Cannot read properties of null (reading 'appendChild')` on first load

---

## Version: v1.0.0

**Release Date:** 2026-08-06

---

## New Features

* YouTube live chat danmaku overlay on watch and live pages
* Popup settings for overlay toggle, animation speed, opacity, and text color
* Full-bleed option to hide native YouTube chat panels
* Windowed fullscreen controls for the current tab or a popup window
* Multi-browser release packaging for Chrome, Firefox, and Edge