import { createRoot, type Root } from 'react-dom/client'
import {
  STORAGE_KEY,
  type OverlaySettings,
} from '../../content/overlay/useChromeStorage'
import popupStyles from '../../action/styles.css?inline'
import { evaluatePolicy } from '../policy'
import {
  appendRecord,
  clearRecords,
  setWindowOpenArgs,
  takeRecords,
} from '../records'
import {
  getOrCreatePort,
  isPortEnabled,
  setPortEnabled,
} from '../port'
import type {
  BlockedPopupRequest,
  PolicyOptions,
  PolicyRequest,
  WindowRecord,
} from '../types'
import BlockedPopupApp from '../ui/BlockedPopupApp'

let policyOptions: PolicyOptions = {}

function toPolicyOptions(settings?: OverlaySettings): PolicyOptions {
  return {
    useBlacklist: Boolean(settings?.usePopupBlacklist),
    blacklist: (settings?.popupBlacklist ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  }
}

async function syncPolicyState(port: HTMLElement): Promise<boolean> {
  const result = await chrome.storage.sync.get(STORAGE_KEY)
  const settings = result[STORAGE_KEY] as OverlaySettings | undefined
  const enabled = Boolean(settings?.blockPopup)
  policyOptions = toPolicyOptions(settings)
  setPortEnabled(port, enabled)
  return enabled
}

function injectStyles(shadowRoot: ShadowRoot) {
  const style = document.createElement('style')
  style.textContent = popupStyles
  shadowRoot.appendChild(style)
}

function reportBlocked(
  result: ReturnType<typeof evaluatePolicy>,
  request: PolicyRequest
) {
  const payload: BlockedPopupRequest = {
    id: result.id,
    href: result.href,
    hostname: result.hostname,
    type: request.type,
    sameContext: result.sameContext,
    frameId: 0,
    count: 1,
  }

  if (window.top === window) {
    window.dispatchEvent(
      new CustomEvent('cf-blocked-popup-add', { detail: payload })
    )
    return
  }

  void chrome.runtime.sendMessage({
    cmd: 'blocked-popup-report',
    request: payload,
  })
}

function initPolicyBridge(port: HTMLElement) {
  const onPolicy = (event: Event) => {
    event.stopPropagation()
    if (event.target !== port || !isPortEnabled(port)) {
      port.setAttribute('block', 'false')
      return
    }

    const request = (event as CustomEvent<PolicyRequest>).detail
    const result = evaluatePolicy(request, policyOptions)
    port.setAttribute('eid', result.id)
    port.setAttribute('block', String(result.block))

    if (result.block) {
      if (result.sameContext && request.args) {
        setWindowOpenArgs(result.id, request.args)
      }
      reportBlocked(result, request)
    }
  }

  const onRecord = (event: Event) => {
    event.stopPropagation()
    appendRecord((event as CustomEvent<WindowRecord>).detail)
  }

  port.addEventListener('policy', onPolicy)
  port.addEventListener('record', onRecord)

  return () => {
    port.removeEventListener('policy', onPolicy)
    port.removeEventListener('record', onRecord)
  }
}

function initTopFrameUi(): () => void {
  if (window.top !== window) return () => {}

  const host = document.createElement('div')
  host.setAttribute('data-cf-popup-blocker-root', 'true')
  host.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:2147483646;'
  document.documentElement.append(host)

  const shadowRoot = host.attachShadow({ mode: 'open' })
  injectStyles(shadowRoot)

  const mountTarget = document.createElement('div')
  mountTarget.className = 'dark pointer-events-none'
  shadowRoot.appendChild(mountTarget)

  const root: Root = createRoot(mountTarget)
  root.render(<BlockedPopupApp />)

  return () => {
    root.unmount()
    host.remove()
  }
}

function initRuntimeMessages(port: HTMLElement) {
  const onMessage = (
    request: {
      cmd?: string
      id?: string
      url?: string
      request?: BlockedPopupRequest
    },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (value?: unknown) => void
  ) => {
    if (request.cmd === 'blocked-popup-add' && request.request) {
      if (window.top === window) {
        window.dispatchEvent(
          new CustomEvent('cf-blocked-popup-add', {
            detail: request.request as BlockedPopupRequest,
          })
        )
      }
      sendResponse(true)
      return true
    }

    if (request.cmd === 'popup-accepted' && request.id) {
      setPortEnabled(port, false)

      const records = takeRecords(request.id)
      void chrome.runtime.sendMessage(
        {
          cmd: 'run-records',
          url: request.url,
          records: records ? [...records] : false,
          args: records?.args ?? [],
        },
        () => {
          clearRecords(request.id)
          void syncPolicyState(port)
        }
      )
      sendResponse(true)
      return true
    }

    return undefined
  }

  chrome.runtime.onMessage.addListener(onMessage)
  return () => chrome.runtime.onMessage.removeListener(onMessage)
}

function initEnabledState(port: HTMLElement) {
  void syncPolicyState(port)

  const onStorage = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string
  ) => {
    if (area !== 'sync' || !changes[STORAGE_KEY]) return
    const next = changes[STORAGE_KEY].newValue as OverlaySettings | undefined
    policyOptions = toPolicyOptions(next)
    setPortEnabled(port, Boolean(next?.blockPopup))
  }

  chrome.storage.onChanged.addListener(onStorage)
  return () => chrome.storage.onChanged.removeListener(onStorage)
}

export default function initial() {
  const port = getOrCreatePort()
  const cleanupPolicy = initPolicyBridge(port)
  const cleanupUi = initTopFrameUi()
  const cleanupMessages = initRuntimeMessages(port)
  const cleanupEnabled = initEnabledState(port)

  return () => {
    cleanupPolicy()
    cleanupUi()
    cleanupMessages()
    cleanupEnabled()
    port.remove()
  }
}
