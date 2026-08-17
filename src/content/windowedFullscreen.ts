import { appendToHead } from './domReady'

const WINDOWED_CLASS = 'cf-windowed-fs'
const WINDOWED_PARAM = 'cf_windowed'
const STYLE_ID = 'chat-float-windowed-fs-styles'
const WFS_BUTTON_ID = 'cf-wfs-button'

const SEL = {
  rightControls: '.ytp-right-controls',
  fullscreenButton: '.ytp-fullscreen-button',
  sizeButton: '.ytp-size-button',
  watchContainer:
    'ytd-watch-flexy, ytd-watch-grid, ytd-watch, #player',
}

let initialTheaterState: boolean | null = null

function getWatchContainer(): Element | null {
  return document.querySelector(SEL.watchContainer)
}

function isInTheaterMode(): boolean {
  const container = getWatchContainer()
  return container?.hasAttribute('theater') ?? false
}

function clickTheaterButton(): boolean {
  const btn = document.querySelector(SEL.sizeButton) as HTMLElement | null
  if (!btn) return false
  btn.click()
  return true
}

function ensureTheaterMode(retries = 15): void {
  if (isInTheaterMode()) return
  if (retries <= 0) return
  if (clickTheaterButton()) {
    requestAnimationFrame(() => ensureTheaterMode(retries - 1))
  }
}

export function isWindowedFullscreen(): boolean {
  return document.documentElement.classList.contains(WINDOWED_CLASS)
}

function notifyResize(): void {
  window.dispatchEvent(new Event('resize'))
}

function updateWfsButtonState(): void {
  const btn = document.querySelector(`#${WFS_BUTTON_ID}`)
  if (!btn) return
  btn.setAttribute('aria-pressed', isWindowedFullscreen() ? 'true' : 'false')
}

function setWindowedFullscreen(on: boolean): void {
  if (on) {
    initialTheaterState = isInTheaterMode()
    if (!initialTheaterState) ensureTheaterMode()
    window.scrollTo(0, 0)
  } else if (initialTheaterState === false && isInTheaterMode()) {
    clickTheaterButton()
    initialTheaterState = null
  }

  document.documentElement.classList.toggle(WINDOWED_CLASS, on)
  updateWfsButtonState()
  notifyResize()
}

export function toggleWindowedFullscreen(): void {
  setWindowedFullscreen(!isWindowedFullscreen())
}

function stripWindowedParam(): void {
  const url = new URL(location.href)
  if (!url.searchParams.has(WINDOWED_PARAM)) return
  url.searchParams.delete(WINDOWED_PARAM)
  history.replaceState(history.state, '', url.toString())
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.matches('input, textarea, [contenteditable="true"]')
}

function matchesShiftF(e: KeyboardEvent): boolean {
  return e.key === 'F' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey
}

const WINDOWED_CSS = `
html.${WINDOWED_CLASS} body {
  overflow-y: hidden !important;
  overflow-x: hidden !important;
}

html.${WINDOWED_CLASS} #full-bleed-container,
html.${WINDOWED_CLASS} ytd-app ytd-watch #player.ytd-watch,
html.${WINDOWED_CLASS} ytd-app ytd-watch-grid #player.ytd-watch-grid,
html.${WINDOWED_CLASS} ytd-app ytd-watch-flexy #player.ytd-watch-flexy,
html.${WINDOWED_CLASS} ytd-app ytd-watch-flexy #player-container-outer,
html.${WINDOWED_CLASS} ytd-app ytd-watch-flexy #player-container-inner,
html.${WINDOWED_CLASS} ytd-app ytd-watch-flexy #player-container,
html.${WINDOWED_CLASS} ytd-app ytd-watch-flexy #player,
html.${WINDOWED_CLASS} ytd-app ytd-watch-flexy #player-theater-container {
  height: 100vh !important;
  max-height: 100vh !important;
}

html.${WINDOWED_CLASS} #movie_player:not(.miniplayer) {
  height: 100vh !important;
  width: 100% !important;
}

html.${WINDOWED_CLASS} .html5-video-player {
  z-index: 1000 !important;
}

html.${WINDOWED_CLASS} ytd-page-manager,
html.${WINDOWED_CLASS} ytd-watch-flexy {
  margin-top: 0 !important;
}

html.${WINDOWED_CLASS} #masthead-container,
html.${WINDOWED_CLASS} ytd-masthead {
  display: none !important;
}

html.${WINDOWED_CLASS} ytd-watch-flexy #secondary,
html.${WINDOWED_CLASS} ytd-watch-flexy #related,
html.${WINDOWED_CLASS} ytd-watch-flexy #below,
html.${WINDOWED_CLASS} ytd-watch-flexy #comments,
html.${WINDOWED_CLASS} ytd-watch-flexy ytd-comments,
html.${WINDOWED_CLASS} ytd-watch-flexy #panels-full-bleed-container,
html.${WINDOWED_CLASS} ytd-watch-flexy #chat-container,
html.${WINDOWED_CLASS} ytd-watch-flexy ytd-live-chat-frame#chat {
  display: none !important;
}

html.${WINDOWED_CLASS} ytd-watch-flexy #columns {
  display: block !important;
}

html.${WINDOWED_CLASS} ytd-watch-flexy #primary {
  width: 100% !important;
  max-width: none !important;
  margin-right: 0 !important;
  padding-right: 0 !important;
  box-sizing: border-box !important;
}

html.${WINDOWED_CLASS} .ytp-popup,
html.${WINDOWED_CLASS} .ytp-settings-menu,
html.${WINDOWED_CLASS} .ytp-panel,
html.${WINDOWED_CLASS} .ytp-contextmenu {
  z-index: 99999 !important;
}
`.trim()

function injectStyles(): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    appendToHead(style)
  }
  // Always refresh — HMR / old builds may leave sticky-chat rules in place.
  style.textContent = WINDOWED_CSS
}

function isWatchPage(): boolean {
  const path = location.pathname
  return path.includes('/watch') || path.includes('/live')
}

export function initWindowedFullscreen(): () => void {
  injectStyles()

  const url = new URL(location.href)
  if (url.searchParams.get(WINDOWED_PARAM) === '1') {
    stripWindowedParam()
    requestAnimationFrame(() => setWindowedFullscreen(true))
  }

  const onMessage = (
    message: { type?: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    if (message?.type === 'APPLY_WINDOWED_FS') {
      setWindowedFullscreen(true)
      sendResponse({ ok: true })
      return true
    }
    if (message?.type === 'TOGGLE_WINDOWED_FS') {
      toggleWindowedFullscreen()
      sendResponse({ ok: true, active: isWindowedFullscreen() })
      return true
    }
    return false
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (isEditableTarget(e.target)) return

    if (matchesShiftF(e)) {
      e.preventDefault()
      e.stopImmediatePropagation()
      toggleWindowedFullscreen()
      return
    }

    if (e.key === 'Escape' && isWindowedFullscreen()) {
      e.preventDefault()
      e.stopImmediatePropagation()
      setWindowedFullscreen(false)
    }
  }

  const onNavigate = () => {
    if (!isWatchPage() && isWindowedFullscreen()) {
      setWindowedFullscreen(false)
    }
  }

  chrome.runtime.onMessage.addListener(onMessage)
  document.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('yt-navigate-finish', onNavigate)

  return () => {
    chrome.runtime.onMessage.removeListener(onMessage)
    document.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('yt-navigate-finish', onNavigate)
    setWindowedFullscreen(false)
    document.getElementById(STYLE_ID)?.remove()
  }
}

export { WFS_BUTTON_ID, updateWfsButtonState }
