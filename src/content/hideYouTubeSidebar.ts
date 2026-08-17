import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  type OverlaySettings,
} from './overlay/useChromeStorage'
import { appendToHead } from './domReady'

const STYLE_ID = 'chat-float-hide-native-sidebar'

type HideSettingKey = 'hidePanelsFullBleed'

const HIDE_RULES: Record<HideSettingKey, string> = {
  hidePanelsFullBleed: `
    ytd-watch-flexy[fullscreen] #panels-full-bleed-container {
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      width: 0 !important;
      min-width: 0 !important;
      max-width: 0 !important;
      overflow: hidden !important;
      flex: 0 0 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
    }
  `,
}

function buildCss(settings: Partial<OverlaySettings>) {
  return (Object.keys(HIDE_RULES) as HideSettingKey[])
    .filter((key) => settings[key])
    .map((key) => HIDE_RULES[key].trim())
    .join('\n\n')
}

function applyHideStyles(settings: Partial<OverlaySettings>) {
  let style = document.getElementById(STYLE_ID)
  const css = buildCss(settings)

  if (!css) {
    style?.remove()
    return
  }

  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    appendToHead(style)
  }

  style.textContent = css
}

function readSettings(callback: (settings: OverlaySettings) => void) {
  try {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      callback({ ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY] ?? {}) })
    })
  } catch (err) {
    console.warn(
      '[hideYouTubeSidebar] Failed to read settings:',
      err instanceof Error ? err.message : String(err)
    )
    callback(DEFAULT_SETTINGS)
  }
}

export function hideYouTubeSidebar() {
  const onChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string
  ) => {
    if (area !== 'sync' || !changes[STORAGE_KEY]) return
    applyHideStyles({
      ...DEFAULT_SETTINGS,
      ...(changes[STORAGE_KEY].newValue ?? {}),
    })
  }

  readSettings(applyHideStyles)

  try {
    chrome.storage.onChanged.addListener(onChanged)
  } catch (err) {
    console.warn(
      '[hideYouTubeSidebar] Failed to listen for settings:',
      err instanceof Error ? err.message : String(err)
    )
  }

  return () => {
    try {
      chrome.storage.onChanged.removeListener(onChanged)
    } catch {
      // ignore
    }
    document.getElementById(STYLE_ID)?.remove()
  }
}
