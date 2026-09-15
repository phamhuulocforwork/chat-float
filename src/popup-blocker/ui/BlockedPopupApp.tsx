import { useCallback, useEffect, useState } from 'react'
import type {
  BlockedPopupAction,
  BlockedPopupRequest,
} from '../types'
import BlockedPopupToast from './BlockedPopupToast'

function requestKey(request: Pick<BlockedPopupRequest, 'href' | 'id'>) {
  return request.href && request.href !== 'about:blank'
    ? request.href
    : request.id
}

export default function BlockedPopupApp() {
  const [requests, setRequests] = useState<BlockedPopupRequest[]>([])

  const upsertRequest = useCallback((incoming: BlockedPopupRequest) => {
    setRequests((prev) => {
      const key = requestKey(incoming)
      const index = prev.findIndex((item) => requestKey(item) === key)
      if (index === -1) return [...prev, { ...incoming, count: 1 }]

      const next = [...prev]
      const current = next[index]
      next[index] = {
        ...current,
        ...incoming,
        count: current.count + 1,
      }
      return next
    })
  }, [])

  const removeRequest = useCallback((request: BlockedPopupRequest) => {
    setRequests((prev) =>
      prev.filter((item) => item.id !== request.id || item.href !== request.href)
    )
  }, [])

  useEffect(() => {
    const onAdd = (event: Event) => {
      const detail = (event as CustomEvent<BlockedPopupRequest>).detail
      if (detail) upsertRequest(detail)
    }

    window.addEventListener('cf-blocked-popup-add', onAdd)
    return () => window.removeEventListener('cf-blocked-popup-add', onAdd)
  }, [upsertRequest])

  useEffect(() => {
    const onMessage = (
      message: { cmd?: string; request?: BlockedPopupRequest },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (value?: unknown) => void
    ) => {
      if (message.cmd === 'blocked-popup-add' && message.request) {
        upsertRequest(message.request)
        sendResponse(true)
        return true
      }
      return undefined
    }

    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  }, [upsertRequest])

  const handleAction = useCallback(
    (action: BlockedPopupAction, request: BlockedPopupRequest) => {
      const url = request.href || 'about:blank'

      if (action === 'popup-denied') {
        removeRequest(request)
        return
      }

      void chrome.runtime.sendMessage({
        cmd: action,
        id: request.id,
        url,
        frameId: request.frameId,
        sameContext: request.sameContext,
      })

      removeRequest(request)
    },
    [removeRequest]
  )

  if (requests.length === 0) return null

  return (
    <div className="pointer-events-none fixed top-3 right-3 z-[2147483647] flex max-w-[calc(100vw-1.5rem)] flex-col gap-2">
      {requests.map((request) => (
        <div key={`${request.id}:${request.href}`} className="pointer-events-auto">
          <BlockedPopupToast
            request={request}
            onAction={handleAction}
            onDismiss={removeRequest}
          />
        </div>
      ))}
    </div>
  )
}
