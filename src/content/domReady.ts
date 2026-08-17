/** True when both head and body exist (safe for style inject + DOM mount). */
export function isDocumentReady(): boolean {
  return !!(document.head && document.body)
}

/** Append a node to document.head, waiting if head does not exist yet. */
export function appendToHead(node: Node): void {
  if (document.head) {
    document.head.appendChild(node)
    return
  }

  const observer = new MutationObserver(() => {
    if (!document.head) return
    observer.disconnect()
    document.head.appendChild(node)
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}

/** Run callback once document.head and document.body are available. */
export function whenDocumentReady(callback: () => void): void {
  if (isDocumentReady()) {
    callback()
    return
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (isDocumentReady()) callback()
    })
    return
  }

  const observer = new MutationObserver(() => {
    if (!isDocumentReady()) return
    observer.disconnect()
    callback()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
