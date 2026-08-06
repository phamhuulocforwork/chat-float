# Chat Overlay Backlog Design

## Problem

When YouTube pauses or delays live-chat DOM updates while the tab is hidden, the
next mutation causes the scraper to scan the whole chat DOM. Every message not
yet in the module-level dedupe store is then sent to `ChatFeed` together, which
creates an unpleasant barrage. The same behavior occurs when the overlay is
opened directly on a live page whose iframe already contains chat history.

## Goal

Ignore chat messages that already exist when the overlay starts or resumes.
Animate only messages observed after the current DOM has been established as a
baseline. A newly observed message must still appear once after resume.

## Non-goals

- Do not replay or throttle historical chat.
- Do not change the animation layout, lane selection, or speed behavior.
- Do not add dependencies or introduce a new queue abstraction.
- Do not change `ChatFeed.tsx` unless implementation evidence proves the scraper
  contract cannot provide deltas directly.

## Root Cause

`src/content/overlay/chatScraper.ts` currently uses `scrapeFromDocument` to
collect the entire iframe DOM and calls `addMessages`. The hook then publishes
`getStoredMessages()`, which contains both the new messages and all retained
history. `ChatFeed` identifies messages by IDs, so a batch released after a
hidden-tab period is interpreted as a large set of new animation events.

The direct-live case has an additional timing issue: the scraper's first DOM
poll populates the store after `ChatFeed` has mounted, so the initial DOM batch
is treated as animation input rather than initialization data.

## Design

### Scraper contract

Keep `seenIds` and `messageStore` as the bounded dedupe store. Change the
internal `addMessages` result from a boolean to the list of messages newly
inserted into the store. Add a baseline operation that inserts scraped
messages but intentionally discards the returned delta.

`useChatMessages` publishes only deltas to its React state. The state is a
bounded event buffer for the animation consumer, while `messageStore` remains
responsible for dedupe. This prevents historical messages from being included
in the first published state update.

### Startup lifecycle

When the iframe document and chat container become available:

1. Attach the observer.
2. Seed all messages currently in the document into the dedupe store.
3. Do not update the animation state for the seed.
4. Publish only deltas from later observer callbacks.

If the parent cannot access the iframe document, the first `chatMessages`
`postMessage` batch is treated as the baseline fallback. Later bridge batches
publish only their new deltas.

### Visibility lifecycle

Register a `visibilitychange` listener in `useChatMessages`.

- While hidden, scraped messages are inserted into the dedupe store but are not
  published to React state.
- On the hidden-to-visible transition, seed the current iframe DOM before
  publishing any later delta.
- If the iframe cannot be read, keep a baseline-needed flag so the first bridge
  batch after resume is discarded as initialization data.

The existing observer, polling, bridge, and cleanup paths remain in place. The
visibility state only changes whether a delta is emitted; it does not stop
dedupe or observation.

### Consumer behavior

`ChatFeed.tsx` remains an animation consumer. It receives only live deltas and
does not need heuristics such as dropping the first batch or detecting large
batches. Its existing ID tracking continues to protect against rerenders and
duplicate React inputs.

## Error Handling

Retain the existing iframe access `try/catch`, warning, and error state. An
unavailable iframe is a retryable initialization condition, not a reason to
emit potentially historical bridge data. Cleanup must remove the new
`visibilitychange` listener along with the existing observer, timer, and
message listener.

## Verification

Run `npm run build`.

Manually verify the following on a YouTube live page:

1. Open a live page whose chat iframe already contains messages. No existing
   messages animate during initialization.
2. Leave the page in another tab while chat accumulates, then return. The
   accumulated messages do not animate as a burst.
3. Send or wait for a message after returning. It animates exactly once.
4. Exercise a page where the parent uses the iframe bridge fallback. The first
   bridge batch is ignored and later messages animate once.
5. Allow the iframe/container to be recreated. The current DOM is reseeded
   without replaying its history.

## Expected File Impact

- Modify: `src/content/overlay/chatScraper.ts`
- Do not modify: `src/content/overlay/ChatFeed.tsx`, unless a contract mismatch
  is found during implementation.
