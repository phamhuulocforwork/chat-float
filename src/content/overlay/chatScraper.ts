import { useState, useEffect, useRef, useCallback } from 'react'

const MAX_MESSAGES = 200
const POLL_INTERVAL = 3000
const MESSAGE_SELECTORS =
  'yt-live-chat-text-message-renderer, yt-live-chat-paid-message-renderer, yt-live-chat-membership-item-renderer, yt-live-chat-paid-sticker-renderer'

export interface ChatMessage {
  id: string
  text: string
  author: string
  timestamp: number
}

const seenIds = new Set<string>()
const messageStore = new Map<string, ChatMessage>()

function parseMessageElement(el: Element): ChatMessage | null {
  const textEl = el.querySelector('#message')
  const text = textEl?.textContent?.trim()
  if (!text) return null

  const authorEl = el.querySelector('#author-name')
  const author = authorEl?.textContent?.trim() || ''
  const id =
    el.id ||
    el.getAttribute('data-id') ||
    `hash-${author}-${text}`.slice(0, 120)

  return {
    id,
    text,
    author,
    timestamp: Date.now(),
  }
}

function scrapeFromDocument(doc: Document) {
  const messages: ChatMessage[] = []
  doc.querySelectorAll(MESSAGE_SELECTORS).forEach((el) => {
    const msg = parseMessageElement(el)
    if (msg) messages.push(msg)
  })
  return messages
}

function getChatIframeDoc() {
  const iframe = document.querySelector<HTMLIFrameElement>('#chatframe')
  if (!iframe) return null
  try {
    return iframe.contentDocument || iframe.contentWindow?.document || null
  } catch {
    return null
  }
}

function findChatItemsContainer(doc: Document) {
  return (
    doc.querySelector('#items') ||
    doc.querySelector('#item-scroller') ||
    doc.querySelector('yt-live-chat-item-list-renderer #items')
  )
}

function addMessages(incoming: ChatMessage[]) {
  const fresh: ChatMessage[] = []

  for (const msg of incoming) {
    if (seenIds.has(msg.id)) continue
    seenIds.add(msg.id)
    messageStore.set(msg.id, msg)
    fresh.push(msg)
  }

  if (messageStore.size > MAX_MESSAGES * 2) {
    const entries = [...messageStore.entries()]
    const toRemove = entries.slice(0, entries.length - MAX_MESSAGES)
    toRemove.forEach(([id]) => {
      messageStore.delete(id)
      seenIds.delete(id)
    })
  }

  return fresh
}

function observeChatDoc(doc: Document, onUpdate: (messages: ChatMessage[]) => void) {
  const container = findChatItemsContainer(doc)
  if (!container) return null

  const observer = new MutationObserver(() => {
    onUpdate(scrapeFromDocument(doc))
  })

  observer.observe(container, { childList: true, subtree: true })
  return observer
}

/** Runs inside the /live_chat iframe — forwards messages to parent watch page. */
export function initLiveChatBridge() {
  let observer: MutationObserver | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const forward = () => {
    const scraped = scrapeFromDocument(document)
    if (scraped.length === 0) return
    window.parent.postMessage(
      { source: 'chat-float', type: 'chatMessages', messages: scraped },
      '*'
    )
  }

  const setup = () => {
    const container = findChatItemsContainer(document)
    if (!container) return false

    forward()

    observer?.disconnect()
    observer = new MutationObserver(forward)
    observer.observe(container, { childList: true, subtree: true })
    return true
  }

  if (!setup()) {
    pollTimer = setInterval(() => {
      if (setup()) {
        clearInterval(pollTimer!)
        pollTimer = null
      }
    }, 500)
  }

  return () => {
    observer?.disconnect()
    if (pollTimer) clearInterval(pollTimer)
  }
}

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const observerRef = useRef<MutationObserver | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isVisibleRef = useRef(document.visibilityState !== 'hidden')
  const needsBaselineRef = useRef(true)

  const applyMessages = useCallback((incoming: ChatMessage[]) => {
    const fresh = addMessages(incoming)
    if (!isVisibleRef.current) return

    if (needsBaselineRef.current && incoming.length > 0) {
      needsBaselineRef.current = false
      return
    }

    if (fresh.length === 0) return

    setMessages((prev) => [...prev, ...fresh].slice(-MAX_MESSAGES))
  }, [])

  useEffect(() => {
    let isActive = true

    const pollIframe = () => {
      try {
        const doc = getChatIframeDoc()
        if (!doc) return

        const scraped = scrapeFromDocument(doc)
        if (scraped.length === 0) return
        if (needsBaselineRef.current && !findChatItemsContainer(doc)) return

        if (isActive) {
          applyMessages(scraped)
          setError(null)
        }
      } catch (err) {
        if (isActive) {
          console.warn(
            '[chatScraper] iframe poll failed:',
            err instanceof Error ? err.message : String(err)
          )
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    const setupIframeObserver = () => {
      const doc = getChatIframeDoc()
      if (!doc) return false

      observerRef.current?.disconnect()
      observerRef.current = observeChatDoc(doc, (scraped) => {
        if (isActive) {
          applyMessages(scraped)
          setError(null)
        }
      })
      if (!observerRef.current) return false

      addMessages(scrapeFromDocument(doc))
      needsBaselineRef.current = false
      return true
    }

    const onPostMessage = (event: MessageEvent) => {
      if (event.data?.source !== 'chat-float') return
      if (event.data?.type !== 'chatMessages') return
      if (!isActive) return
      applyMessages(event.data.messages as ChatMessage[])
      setError(null)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        isVisibleRef.current = false
        needsBaselineRef.current = true
        return
      }

      isVisibleRef.current = true
      if (!setupIframeObserver()) {
        needsBaselineRef.current = true
      }
    }

    window.addEventListener('message', onPostMessage)
    window.addEventListener('visibilitychange', onVisibilityChange)

    if (!setupIframeObserver()) {
      pollRef.current = setInterval(() => {
        pollIframe()
        setupIframeObserver()
      }, POLL_INTERVAL)
    }

    return () => {
      isActive = false
      window.removeEventListener('message', onPostMessage)
      window.removeEventListener('visibilitychange', onVisibilityChange)
      observerRef.current?.disconnect()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [applyMessages])

  return { messages, error }
}