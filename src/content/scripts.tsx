import { createRoot } from 'react-dom/client'
import { whenDocumentReady } from './domReady'
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

function isWatchPage() {
  return (
    location.pathname.includes('/watch') || location.pathname.includes('/live')
  )
}

function initWatchPage() {
  let cleanupSidebar: (() => void) | null = null
  let cleanupWindowed: (() => void) | null = null
  let cleanupPlayerControls: (() => void) | null = null
  let cleanupOverlay: (() => void) | null = null
  let observer: MutationObserver | null = null
  let mountPoll: ReturnType<typeof setInterval> | null = null
  let modulesStarted = false

  const tryMount = () => {
    if (cleanupOverlay) return true
    cleanupOverlay = mountOverlay()
    return !!cleanupOverlay
  }

  const startMountPolling = () => {
    if (mountPoll || cleanupOverlay) return
    mountPoll = setInterval(() => {
      if (tryMount()) {
        clearInterval(mountPoll!)
        mountPoll = null
      }
    }, 500)
  }

  const attachPlayerObserver = () => {
    if (observer) return

    observer = new MutationObserver(() => {
      const player = findPlayer()
      if (player && !player.querySelector('[data-extension-root="true"]')) {
        cleanupOverlay?.()
        cleanupOverlay = null
        tryMount()
        if (!cleanupOverlay) startMountPolling()
      }
    })

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    })
  }

  const startWatchModules = () => {
    if (modulesStarted) return
    modulesStarted = true
    cleanupSidebar = hideYouTubeSidebar()
    cleanupWindowed = initWindowedFullscreen()
    cleanupPlayerControls = initPlayerControls()
    if (!tryMount()) startMountPolling()
    attachPlayerObserver()
  }

  const startWhenBodyReady = () => {
    whenDocumentReady(startWatchModules)
  }

  startWhenBodyReady()

  return () => {
    cleanupOverlay?.()
    cleanupSidebar?.()
    cleanupWindowed?.()
    cleanupPlayerControls?.()
    observer?.disconnect()
    if (mountPoll) clearInterval(mountPoll)
    modulesStarted = false
  }
}

function initTopFrameSpa() {
  let cleanupWatch: (() => void) | null = null

  const syncPage = () => {
    if (isWatchPage()) {
      if (!cleanupWatch) cleanupWatch = initWatchPage()
    } else if (cleanupWatch) {
      cleanupWatch()
      cleanupWatch = null
    }
  }

  syncPage()

  const onNavigate = () => syncPage()
  window.addEventListener('yt-navigate-finish', onNavigate)
  window.addEventListener('yt-page-data-updated', onNavigate)

  return () => {
    window.removeEventListener('yt-navigate-finish', onNavigate)
    window.removeEventListener('yt-page-data-updated', onNavigate)
    cleanupWatch?.()
    cleanupWatch = null
  }
}

/**
 * Extension.js content_script entrypoint. The framework calls this on
 * injection and calls the returned function on HMR/teardown to clean up.
 */
export default function initial() {
  if (location.pathname.startsWith('/live_chat')) {
    // yt-live-chat-app lives in this iframe document — apply hide CSS here too
    let cleanupHide: (() => void) | null = null
    let cleanupBridge: (() => void) | null = null

    whenDocumentReady(() => {
      cleanupHide = hideYouTubeSidebar()
      cleanupBridge = initLiveChatBridge()
    })

    return () => {
      cleanupBridge?.()
      cleanupHide?.()
    }
  }

  if (window !== window.top) {
    return () => {}
  }

  return initTopFrameSpa()
}
