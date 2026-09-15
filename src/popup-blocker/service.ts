import { STORAGE_KEY } from '../content/overlay/useChromeStorage'

const HOST_PERMISSION = '<all_urls>'
const BLOCKER_SCRIPT_IDS = ['cf-popup-main', 'cf-popup-isolated'] as const

const MAIN_SCRIPT = 'popup-blocker/inject/main.js'

/** Built by Extension.js from manifest content_scripts entry (exclude-only bundle). */
export const ISOLATED_SCRIPT = 'content_scripts/content-1.js'

const DEFAULT_SCOPE = ['*://*/*']

let activateBusy = false

async function readBlockPopupEnabled(): Promise<boolean> {
  const result = await chrome.storage.sync.get(STORAGE_KEY)
  return Boolean(result[STORAGE_KEY]?.blockPopup)
}

async function unregisterBlockerScripts() {
  await chrome.scripting
    .unregisterContentScripts({ ids: [...BLOCKER_SCRIPT_IDS] })
    .catch(() => {})
}

export async function hasBlockerHostPermission(): Promise<boolean> {
  return chrome.permissions.contains({ origins: [HOST_PERMISSION] })
}

export async function syncPopupBlockerFromStorage() {
  const enabled = await readBlockPopupEnabled()
  if (!enabled || !(await hasBlockerHostPermission())) {
    await unregisterBlockerScripts()
    return
  }

  await activatePopupBlocker()
}

export async function activatePopupBlocker() {
  if (activateBusy) return
  activateBusy = true

  try {
    await unregisterBlockerScripts()

    const enabled = await readBlockPopupEnabled()
    if (!enabled || !(await hasBlockerHostPermission())) return

    const props = {
      matches: DEFAULT_SCOPE,
      allFrames: true,
      matchOriginAsFallback: true,
      runAt: 'document_start' as const,
    }

    await chrome.scripting.registerContentScripts([
      {
        id: 'cf-popup-main',
        js: [MAIN_SCRIPT],
        world: 'MAIN',
        ...props,
      },
      {
        id: 'cf-popup-isolated',
        js: [ISOLATED_SCRIPT],
        world: 'ISOLATED',
        ...props,
      },
    ])
  } catch (error) {
    console.error('[popup-blocker] Registration failed:', error)
    await unregisterBlockerScripts()
  } finally {
    activateBusy = false
  }
}

export function initPopupBlocker() {
  chrome.runtime.onStartup.addListener(() => {
    void syncPopupBlockerFromStorage()
  })

  chrome.runtime.onInstalled.addListener(() => {
    void syncPopupBlockerFromStorage()
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[STORAGE_KEY]) {
      void syncPopupBlockerFromStorage()
    }
  })

  void syncPopupBlockerFromStorage()
}

export function handlePopupBlockerMessage(
  request: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean | undefined {
  const cmd = request.cmd as string | undefined

  if (cmd === 'blocked-popup-report' && sender.tab?.id) {
    const frameId = sender.frameId ?? 0
    const popupRequest = {
      ...(request.request as Record<string, unknown>),
      frameId,
    }

    void chrome.tabs
      .sendMessage(sender.tab.id, {
        cmd: 'blocked-popup-add',
        request: popupRequest,
      })
      .then(() => sendResponse(true))
      .catch(() => sendResponse(false))

    return true
  }

  if (cmd === 'popup-accepted') {
    const url = String(request.url ?? '')

    if (
      (url.startsWith('http') || url.startsWith('ftp')) &&
      request.sameContext !== true
    ) {
      void chrome.tabs.create({
        url,
        openerTabId: sender.tab?.id,
      })
      return undefined
    }

    if (sender.tab?.id) {
      void chrome.tabs.sendMessage(
        sender.tab.id,
        request,
        { frameId: request.frameId as number },
        () => {
          void chrome.runtime.lastError
        }
      )
    }
    return undefined
  }

  if (
    (cmd === 'popup-redirect' || cmd === 'open-tab') &&
    sender.tab?.id &&
    sender.tab.index !== undefined
  ) {
    const url = String(request.url ?? '')
    if (
      url.startsWith('http') ||
      url.startsWith('ftp') ||
      url === 'about:blank'
    ) {
      if (cmd === 'popup-redirect') {
        void chrome.tabs.update(sender.tab.id, { url })
      } else {
        void chrome.tabs.create({
          url,
          active: false,
          index: sender.tab.index + 1,
        })
      }
    }
    return undefined
  }

  if (cmd === 'run-records' && sender.tab?.id) {
    void chrome.scripting
      .executeScript({
        target: {
          tabId: sender.tab.id,
          frameIds: [sender.frameId as number],
        },
        world: 'MAIN',
        func: (records, href, args) => {
          if (records) {
            const opened = window.open(...args)
            for (const record of records) {
              let context: Window = opened as Window
              for (const name of record.tree) {
                context = context[name as keyof Window] as Window
              }
              const { method, args: methodArgs } = record.action
              if (method) {
                ;(
                  context as unknown as Record<string, (...a: unknown[]) => void>
                )[method as string](...(methodArgs as unknown[]))
              }
              const { prop, value } = record.action
              if (prop) {
                ;(context as unknown as Record<string, unknown>)[prop as string] =
                  value
              }
            }
          } else {
            const anchor = document.createElement('a')
            anchor.target = '_blank'
            anchor.href = href
            anchor.click()
          }
        },
        args: [request.records || false, request.url, request.args || []],
      })
      .finally(() => sendResponse(true))

    return true
  }

  return undefined
}
