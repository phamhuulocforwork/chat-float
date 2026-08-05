const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

if (!isFirefoxLike) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
}

const WINDOWED_PARAM = 'cf_windowed'

type WindowedFsMode = 'this-tab' | 'popup'

function isYouTubeWatchUrl(url: string) {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('youtube.com')) return false
    return (
      parsed.pathname.includes('/watch') || parsed.pathname.includes('/live')
    )
  } catch {
    return false
  }
}

function buildWindowedUrl(tabUrl: string) {
  const url = new URL(tabUrl)
  url.searchParams.set(WINDOWED_PARAM, '1')
  return url.toString()
}

async function toggleWindowedFullscreenThisTab(tab: chrome.tabs.Tab) {
  if (!tab?.id || !tab.url || !isYouTubeWatchUrl(tab.url)) {
    throw new Error('Active tab is not a YouTube watch/live page')
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_WINDOWED_FS' })
  } catch {
    // Content script may not be ready — reload with marker param
    await chrome.tabs.update(tab.id, { url: buildWindowedUrl(tab.url) })
  }
}

async function openWindowedFullscreenPopup(tab: chrome.tabs.Tab) {
  if (!tab?.url || !isYouTubeWatchUrl(tab.url)) {
    throw new Error('Active tab is not a YouTube watch/live page')
  }

  await chrome.windows.create({
    url: buildWindowedUrl(tab.url),
    type: 'popup',
    width: 960,
    height: 540,
  })

  if (tab.id !== undefined) {
    await chrome.tabs.remove(tab.id)
  }
}

async function runWindowedFullscreen(
  tab: chrome.tabs.Tab,
  mode: WindowedFsMode
) {
  if (mode === 'this-tab') {
    await toggleWindowedFullscreenThisTab(tab)
    return
  }
  await openWindowedFullscreenPopup(tab)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'OPEN_WINDOWED_FS') return

  const mode: WindowedFsMode =
    message.mode === 'this-tab' ? 'this-tab' : 'popup'

  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs[0]
    if (!tab) {
      sendResponse({ ok: false, error: 'No active tab' })
      return
    }

    runWindowedFullscreen(tab, mode)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.warn('[background] windowed fullscreen failed:', err)
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      })
  })

  return true
})
