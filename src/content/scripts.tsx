import { createRoot } from 'react-dom/client'
import { hideYouTubeSidebar } from './hideYouTubeSidebar'
import OverlayApp from './overlay/OverlayApp'
import { initLiveChatBridge } from './overlay/chatScraper'
import { initPlayerControls } from './playerControls'
import { initWindowedFullscreen } from './windowedFullscreen'
import overlayCss from './index.css?inline'

console.log('[ChatFloat] Chat overlay loaded!', location.pathname)

function injectStyles(shadowRoot: ShadowRoot) {
  const style = document.createElement('style')
  style.textContent = overlayCss
  shadowRoot.appendChild(style)
}

function findPlayer() {
  return (
    document.querySelector('#movie_player') ||
    document.querySelector('#ytd-player .html5-video-player') ||
    document.querySelector('.html5-video-player')
  )
}

function mountOverlay() {
  const player = findPlayer()
  if (!player) return null

  if (player.querySelector('[data-extension-root="true"]')) return null

  const computed = getComputedStyle(player)
  if (computed.position === 'static') {
    ;(player as HTMLElement).style.position = 'relative'
  }

  const rootDiv = document.createElement('div')
  rootDiv.setAttribute('data-extension-root', 'true')
  rootDiv.style.cssText =
    'position:absolute;inset:0;pointer-events:none;z-index:9999;'
  player.appendChild(rootDiv)

  const shadowRoot = rootDiv.attachShadow({ mode: 'open' })
  injectStyles(shadowRoot)

  const appContainer = document.createElement('div')
  appContainer.id = 'chat-float-overlay'
  appContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;'
  shadowRoot.appendChild(appContainer)

  const root = createRoot(appContainer)
  root.render(<OverlayApp />)

  return () => {
    root.unmount()
    rootDiv.remove()
  }
}

function initWatchPage() {
  const cleanupSidebar = hideYouTubeSidebar()
  const cleanupWindowed = initWindowedFullscreen()
  const cleanupPlayerControls = initPlayerControls()
  let cleanupOverlay: (() => void) | null = null
  let observer: MutationObserver | null = null
  let mountPoll: ReturnType<typeof setInterval> | null = null

  const tryMount = () => {
    if (cleanupOverlay) return true
    cleanupOverlay = mountOverlay()
    return !!cleanupOverlay
  }

  if (!tryMount()) {
    mountPoll = setInterval(() => {
      if (tryMount()) {
        clearInterval(mountPoll!)
        mountPoll = null
      }
    }, 500)
  }

  observer = new MutationObserver(() => {
    const player = findPlayer()
    if (player && !player.querySelector('[data-extension-root="true"]')) {
      cleanupOverlay?.()
      cleanupOverlay = null
      tryMount()
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    cleanupOverlay?.()
    cleanupSidebar?.()
    cleanupWindowed?.()
    cleanupPlayerControls?.()
    observer?.disconnect()
    if (mountPoll) clearInterval(mountPoll)
  }
}

function isWatchPage() {
  return (
    location.pathname.includes('/watch') || location.pathname.includes('/live')
  )
}

/**
 * Extension.js content_script entrypoint. The framework calls this on
 * injection and calls the returned function on HMR/teardown to clean up.
 */
export default function initial() {
  if (location.pathname.startsWith('/live_chat')) {
    // yt-live-chat-app lives in this iframe document — apply hide CSS here too
    const cleanupHide = hideYouTubeSidebar()
    const cleanupBridge = initLiveChatBridge()
    return () => {
      cleanupBridge?.()
      cleanupHide?.()
    }
  }

  if (window !== window.top) {
    return () => {}
  }

  if (isWatchPage()) {
    return initWatchPage()
  }

  return () => {}
}
