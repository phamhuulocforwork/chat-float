# Release Notes / Change Log

## Version: v1.0.2

**Release Date:** 2026-09-15

---

## New Features

* Popup blocker: blocks popups and new tabs opened by `window.open`, `target="_blank"` links, and form submissions on every site, across all frames
* Blocked popup toast shows the target URL with **Allow** and **Dismiss** actions, remembers chained popup actions so an allowed popup opens correctly, auto-dismisses after 10 seconds, and counts repeated attempts
* Popup blocking is registered dynamically only while it is enabled and the optional `<all_urls>` host permission is granted
* Popup blacklist: an optional sub-option shown when Block popup is on — by default every site is protected, or enable **Use blacklist** to only block popups and redirects opened by pages whose hostname matches your list (regular expressions supported, one pattern per line, edited in a 4-row scrollable field)

## Improvements

* Firefox target upgraded to Manifest V3 with Gecko 128 as the minimum supported version

---

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