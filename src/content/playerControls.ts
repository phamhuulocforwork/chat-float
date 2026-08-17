import {
  toggleWindowedFullscreen,
  updateWfsButtonState,
  WFS_BUTTON_ID,
} from './windowedFullscreen'
import { appendToHead } from './domReady'

const CHAT_BUTTON_ID = 'cf-chat-button'
const HIDE_CHAT_CLASS = 'cf-hide-native-chat'
const HIDE_CHAT_STYLE_ID = 'chat-float-hide-native-chat'

const SEL = {
  rightControls: '.ytp-right-controls',
  fullscreenButton: '.ytp-fullscreen-button',
}

const CHAT_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1"/></svg>'

const WFS_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="8" x="7" y="8" rx="1"/></svg>'

/**
 * Collapse native chat out of layout. Iframe stays loaded (display:none does not
 * unload same-origin frames) so all_frames scraping / overlay keep working.
 */
const HIDE_CHAT_CSS = `
html.${HIDE_CHAT_CLASS} ytd-watch-flexy {
  --ytd-watch-flexy-chat-max-height: 0px !important;
  --ytd-watch-flexy-panel-max-height: 0px !important;
}

html.${HIDE_CHAT_CLASS} ytd-watch-flexy #chat-container,
html.${HIDE_CHAT_CLASS} ytd-watch-flexy div.chat-container,
html.${HIDE_CHAT_CLASS} ytd-watch-flexy ytd-live-chat-frame#chat,
html.${HIDE_CHAT_CLASS} ytd-watch-flexy #chat,
html.${HIDE_CHAT_CLASS} ytd-watch-flexy #chatframe,
html.${HIDE_CHAT_CLASS} ytd-watch-flexy #panels-full-bleed-container,
html.${HIDE_CHAT_CLASS} ytd-watch-flexy #panel-container {
  display: none !important;
  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;
  height: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;
  flex: 0 0 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  overflow: hidden !important;
}
`.trim()

const COLLAPSE_PROPS: Array<[string, string]> = [
  ['display', 'none'],
  ['width', '0px'],
  ['min-width', '0px'],
  ['max-width', '0px'],
  ['height', '0px'],
  ['min-height', '0px'],
  ['max-height', '0px'],
  ['flex', '0 0 0'],
  ['margin', '0'],
  ['padding', '0'],
  ['border', 'none'],
  ['overflow', 'hidden'],
]

function parseSvg(str: string): Element {
  const doc = new DOMParser().parseFromString(str, 'text/html')
  const el = doc.body.firstElementChild
  if (!el) throw new Error('Failed to parse SVG')
  return document.importNode(el, true)
}

function injectHideChatStyles(): void {
  if (document.getElementById(HIDE_CHAT_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = HIDE_CHAT_STYLE_ID
  style.textContent = HIDE_CHAT_CSS
  appendToHead(style)
}

function setCollapsedInline(el: Element | null, collapsed: boolean): void {
  if (!(el instanceof HTMLElement)) return
  if (collapsed) {
    for (const [prop, value] of COLLAPSE_PROPS) {
      el.style.setProperty(prop, value, 'important')
    }
  } else {
    for (const [prop] of COLLAPSE_PROPS) {
      el.style.removeProperty(prop)
    }
  }
}

/** Beat YouTube inline layout styles that keep reserving chat height/width. */
function applyHideChatInline(hidden: boolean): void {
  const flexy = document.querySelector('ytd-watch-flexy')
  if (flexy instanceof HTMLElement) {
    if (hidden) {
      flexy.style.setProperty('--ytd-watch-flexy-chat-max-height', '0px', 'important')
      flexy.style.setProperty('--ytd-watch-flexy-panel-max-height', '0px', 'important')
    } else {
      flexy.style.removeProperty('--ytd-watch-flexy-chat-max-height')
      flexy.style.removeProperty('--ytd-watch-flexy-panel-max-height')
    }
  }

  const selectors = [
    'ytd-watch-flexy #chat-container',
    'ytd-watch-flexy div.chat-container',
    'ytd-watch-flexy ytd-live-chat-frame#chat',
    'ytd-watch-flexy #chat',
    'ytd-watch-flexy #chatframe',
    'ytd-watch-flexy #panels-full-bleed-container',
    'ytd-watch-flexy #panel-container',
  ]

  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => {
      setCollapsedInline(el, hidden)
    })
  }
}

function isAdShowing(): boolean {
  const player = document.querySelector('.html5-video-player')
  return player?.classList.contains('ad-showing') ?? false
}

function getChatElement(): Element | null {
  return (
    document.querySelector('ytd-live-chat-frame#chat') ||
    document.querySelector('#chat')
  )
}

function isChatAvailable(): boolean {
  return !!getChatElement()
}

function isNativeChatHidden(): boolean {
  return document.documentElement.classList.contains(HIDE_CHAT_CLASS)
}

function clickNativeChatToggle(): boolean {
  const chat = getChatElement()
  if (!chat) return false

  const nativeBtn =
    chat.querySelector('#show-hide-button button') ||
    chat.querySelector('#show-hide-button [role="button"]') ||
    chat.querySelector('ytd-toggle-button-renderer button') ||
    chat.querySelector('button[aria-label*="chat" i]')

  if (nativeBtn instanceof HTMLElement) {
    nativeBtn.click()
    return true
  }

  if (chat.hasAttribute('collapsed')) {
    chat.removeAttribute('collapsed')
    return true
  }

  return false
}

/** Expand YouTube chat if collapsed so #chatframe stays loaded for the overlay. */
function ensureChatExpanded(): void {
  const chat = getChatElement()
  if (!chat?.hasAttribute('collapsed')) return
  clickNativeChatToggle()
}

function setNativeChatHidden(hidden: boolean): void {
  injectHideChatStyles()
  if (hidden) {
    // Native collapse unloads the iframe — expand first, then hide with CSS/inline.
    ensureChatExpanded()
    document.documentElement.classList.add(HIDE_CHAT_CLASS)
  } else {
    ensureChatExpanded()
    document.documentElement.classList.remove(HIDE_CHAT_CLASS)
  }
  applyHideChatInline(hidden)
  window.dispatchEvent(new Event('resize'))
}

function toggleChat(): void {
  if (!getChatElement()) return
  setNativeChatHidden(!isNativeChatHidden())
}

function updateChatButtonState(): void {
  const btn = document.getElementById(CHAT_BUTTON_ID)
  if (!btn) return
  const hidden = isNativeChatHidden()
  btn.setAttribute('aria-pressed', hidden ? 'false' : 'true')
  btn.title = hidden ? 'Show chat' : 'Hide chat'
  btn.setAttribute('aria-label', btn.title)
}

function createButton(
  id: string,
  title: string,
  iconSvg: string,
  onClick: () => void
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.id = id
  btn.className = 'ytp-button'
  btn.type = 'button'
  btn.title = title
  btn.setAttribute('aria-label', title)
  btn.setAttribute('aria-pressed', 'false')
  btn.appendChild(parseSvg(iconSvg))
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return btn
}

/** Safely insert before an anchor; YouTube may reparent controls mid-frame. */
function insertBeforeAnchor(
  btn: HTMLElement,
  anchor: Element | null,
  fallback: Element
): void {
  const parent = anchor?.parentNode
  if (parent && parent.contains(anchor)) {
    try {
      parent.insertBefore(btn, anchor)
      return
    } catch {
      // DOM raced — fall through to append
    }
  }
  fallback.appendChild(btn)
}

function injectWfsButton(rightControls: Element): void {
  if (rightControls.querySelector(`#${WFS_BUTTON_ID}`)) return

  document.getElementById(WFS_BUTTON_ID)?.remove()

  const btn = createButton(
    WFS_BUTTON_ID,
    'Windowed fullscreen (Shift+F)',
    WFS_ICON_SVG,
    () => {
      toggleWindowedFullscreen()
      updateWfsButtonState()
    }
  )

  const anchor = rightControls.querySelector(SEL.fullscreenButton)
  insertBeforeAnchor(btn, anchor, rightControls)
  updateWfsButtonState()
}

function injectChatButton(rightControls: Element): void {
  const existing = rightControls.querySelector(`#${CHAT_BUTTON_ID}`)

  if (!isChatAvailable()) {
    existing?.remove()
    document.getElementById(CHAT_BUTTON_ID)?.remove()
    return
  }

  if (existing) return

  document.getElementById(CHAT_BUTTON_ID)?.remove()

  const btn = createButton(
    CHAT_BUTTON_ID,
    'Toggle chat',
    CHAT_ICON_SVG,
    () => {
      toggleChat()
      requestAnimationFrame(updateChatButtonState)
    }
  )

  const anchor =
    rightControls.querySelector(`#${WFS_BUTTON_ID}`) ||
    rightControls.querySelector(SEL.fullscreenButton)
  insertBeforeAnchor(btn, anchor, rightControls)
  updateChatButtonState()
}

function injectButtons(): void {
  if (isAdShowing()) return

  const rightControls = document.querySelector(SEL.rightControls)
  if (!rightControls) return

  try {
    injectWfsButton(rightControls)
    injectChatButton(rightControls)
  } catch (err) {
    console.warn('[ChatFloat] playerControls inject failed:', err)
  }
}

function isWatchPage(): boolean {
  const path = location.pathname
  return path.includes('/watch') || path.includes('/live')
}

export function initPlayerControls(): () => void {
  let pending = false

  const scheduleWork = () => {
    if (pending) return
    pending = true
    requestAnimationFrame(() => {
      pending = false
      injectButtons()
      if (isNativeChatHidden()) applyHideChatInline(true)
      updateChatButtonState()
      updateWfsButtonState()
    })
  }

  scheduleWork()

  const observer = new MutationObserver(scheduleWork)
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true })
  }

  const onNavigate = () => {
    if (isWatchPage()) scheduleWork()
  }
  window.addEventListener('yt-navigate-finish', onNavigate)

  return () => {
    observer.disconnect()
    window.removeEventListener('yt-navigate-finish', onNavigate)
    applyHideChatInline(false)
    document.documentElement.classList.remove(HIDE_CHAT_CLASS)
    document.getElementById(HIDE_CHAT_STYLE_ID)?.remove()
    document.getElementById(WFS_BUTTON_ID)?.remove()
    document.getElementById(CHAT_BUTTON_ID)?.remove()
  }
}
