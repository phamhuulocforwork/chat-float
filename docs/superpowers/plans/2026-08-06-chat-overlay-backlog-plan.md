# Chat Overlay Backlog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent historical YouTube live-chat DOM messages from being animated when the overlay starts or resumes after a hidden tab, while preserving one-time animation for messages observed afterward.

**Architecture:** Keep deduplication in `src/content/overlay/chatScraper.ts`, but make `addMessages` return only newly inserted messages. Seed the dedupe store without publishing during startup and after visibility changes; publish only live deltas through a bounded React event buffer. `ChatFeed.tsx` remains unchanged.

**Tech Stack:** TypeScript, React 19 hooks, browser `MutationObserver`, Page Visibility API, Extension.js build.

## Global Constraints

- Modify only `src/content/overlay/chatScraper.ts`.
- Do not add dependencies, a queue abstraction, or a new test framework.
- Do not change `ChatFeed.tsx`, animation CSS, settings, or the iframe bridge message shape.
- Treat the existing DOM and the first bridge batch after initialization or resume as baseline data, never as animation input.
- Preserve existing deduplication, bounded storage, iframe retry, error logging, and cleanup behavior.
- Verify the final source with `npm run build` and the browser scenarios listed in Task 2.

## File Map

- Modify: `src/content/overlay/chatScraper.ts:65-218` for delta collection, baseline seeding, visibility gating, and event-buffer publication.
- Verify without modification: `src/content/overlay/ChatFeed.tsx:53-131` to confirm it still receives only live deltas.

---

### Task 1: Make Chat Scraper Emit Live Deltas

**Files:**
- Modify: `src/content/overlay/chatScraper.ts:65-218`
- Test: Manual browser reproduction and TypeScript/Extension.js build; this repository has no automated test runner.

**Interfaces:**
- Consumes: Existing `ChatMessage[]` batches from iframe polling, `MutationObserver`, and `postMessage`.
- Produces: `useChatMessages()` returns a bounded sequence of newly observed `ChatMessage` deltas; startup and resume baselines do not enter that sequence.

- [ ] **Step 1: Reproduce the current failure before editing**

  Open a YouTube `/live` page with chat history already present and observe that the existing history animates together. Then move the page to another tab, allow chat to accumulate, return to the page, and observe the accumulated messages arriving as a burst. Record these two cases as the regression checks for the implementation.

- [ ] **Step 2: Change the dedupe result from a boolean to a delta list**

  Replace the `addMessages` implementation at lines 65-82 with this behavior:

  ```ts
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
  ```

  Remove `getStoredMessages`; no consumer should publish the entire retained store after a mutation.

- [ ] **Step 3: Pass scraped input to the observer callback**

  In `observeChatDoc`, keep the same observer options but stop doing deduplication and store snapshot construction inside the observer. The callback should receive the scraped batch directly:

  ```ts
  const observer = new MutationObserver(() => {
    onUpdate(scrapeFromDocument(doc))
  })
  ```

  This leaves one dedupe/publish decision in `useChatMessages` for observer, polling, and bridge input.

- [ ] **Step 4: Add baseline and visibility state to `useChatMessages`**

  Add refs inside the hook before the effect:

  ```ts
  const isVisibleRef = useRef(document.visibilityState !== 'hidden')
  const needsBaselineRef = useRef(true)
  ```

  Replace the current `applyMessages` callback with a delta publisher that always inserts incoming messages into the dedupe store, suppresses hidden-tab input, discards the first visible batch when a baseline is needed, and appends only fresh deltas to React state:

  ```ts
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
  ```

  Keep `setError` in the existing callers so scraper errors and successful input continue to update the hook's error state as before.

- [ ] **Step 5: Seed the startup DOM before publishing observer data**

  Update `setupIframeObserver` so it disconnects the previous observer, attaches a new observer whose callback calls `applyMessages(scraped)`, and then seeds the current document without publishing:

  ```ts
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
  ```

  Remove the old `pollIframe()` call from inside `setupIframeObserver`; otherwise initialization would publish the same DOM through the old polling path before it is seeded.

- [ ] **Step 6: Gate retry polling and bridge input during initialization**

  Keep `pollIframe` for the existing retry interval, but do not treat a document without a chat container as initialized. Route a readable, container-backed batch through `applyMessages`; leave the baseline flag set while the container is unavailable:

  ```ts
  const doc = getChatIframeDoc()
  if (!doc) return

  const scraped = scrapeFromDocument(doc)
  if (scraped.length === 0) return
  if (needsBaselineRef.current && !findChatItemsContainer(doc)) return

  applyMessages(scraped)
  setError(null)
  ```

  Keep this logic inside the existing `try/catch` so iframe access failures retain the current warning and error state. `setupIframeObserver` still performs the authoritative seed once the container exists.

  Keep the existing `onPostMessage` validation and call `applyMessages` for valid batches. A first bridge batch while visible and `needsBaselineRef.current` is true will be stored and discarded by the callback; a bridge batch while hidden will be stored and suppressed without clearing the baseline flag.

- [ ] **Step 7: Handle hidden-to-visible transitions and cleanup**

  Add one `visibilitychange` listener inside the hook effect:

  ```ts
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
  ```

  Register it with `window.addEventListener('visibilitychange', onVisibilityChange)` and remove it in the existing cleanup block. Keep the current message listener, observer disconnect, poll cancellation, and `isActive` guard.

- [ ] **Step 8: Run the build check**

  Run:

  ```bash
  npm run build
  ```

  Expected: the Extension.js production build completes successfully with no TypeScript or bundling errors.

### Task 2: Verify Backlog Suppression and Live Chat Behavior

**Files:**
- Verify: `src/content/overlay/chatScraper.ts`
- Verify: `src/content/overlay/ChatFeed.tsx`

**Interfaces:**
- Consumes: The delta stream produced by Task 1.
- Produces: Evidence that historical messages are suppressed and post-resume messages animate exactly once.

- [ ] **Step 1: Verify direct-live startup**

  Open a YouTube live URL whose chat iframe already contains multiple messages. Expected: the overlay mounts without animating any existing messages.

- [ ] **Step 2: Verify hidden-tab resume**

  Leave the live page in another browser tab while chat accumulates, then return. Expected: no accumulated message burst appears. The current DOM is treated as baseline.

- [ ] **Step 3: Verify post-resume live input**

  Wait for or send a chat message after returning to the tab. Expected: the new message animates once, and duplicate observer/bridge notifications do not create a second animation.

- [ ] **Step 4: Verify bridge fallback and iframe recreation**

  Exercise initialization where the parent cannot immediately access `#chatframe`, and allow the iframe or chat container to be recreated. Expected: the first available batch is discarded as baseline, the observer is reattached, and later messages animate once.

- [ ] **Step 5: Run the final build again**

  Run:

  ```bash
  npm run build
  ```

  Expected: PASS, with the generated extension bundle containing the updated scraper and no build errors.

- [ ] **Step 6: Commit the focused change**

  ```bash
  git add src/content/overlay/chatScraper.ts
  git commit -m "fix: ignore stale live chat backlog"
  ```
