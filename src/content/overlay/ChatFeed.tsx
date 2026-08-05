import { useState, useEffect, useRef, useCallback } from 'react'
import type { ChatMessage } from './chatScraper'
import type { AnimSpeed } from './useChromeStorage'

const MAX_CONCURRENT = 40
const LANE_COUNT = 12
const SPEED_DURATION: Record<AnimSpeed, number> = {
  fast: 6,
  normal: 10,
  slow: 14,
}
const LANE_POOL_RATIO = 0.45

interface Barrage {
  key: string
  text: string
  top: number
  duration: number
  travel: number
}

function pickLane(laneLastUsed: Record<number, number>) {
  const now = Date.now()
  const candidates = Array.from({ length: LANE_COUNT }, (_, lane) => ({
    lane,
    last: laneLastUsed[lane] || 0,
  }))

  candidates.sort((a, b) => a.last - b.last)

  const poolSize = Math.max(3, Math.ceil(LANE_COUNT * LANE_POOL_RATIO))
  const pool = candidates.slice(0, poolSize)
  const chosen = pool[Math.floor(Math.random() * pool.length)]

  laneLastUsed[chosen.lane] = now
  return chosen.lane
}

function laneTop(lane: number, laneHeight: number, stageHeight: number) {
  const base = lane * laneHeight + laneHeight * 0.15
  const jitter = (Math.random() - 0.5) * laneHeight * 0.55
  const maxTop = Math.max(0, stageHeight - laneHeight)
  return Math.min(maxTop, Math.max(0, base + jitter))
}

interface ChatFeedProps {
  messages: ChatMessage[]
  animSpeed: AnimSpeed
  fontSize: number
  textColor: string
}

export default function ChatFeed({
  messages,
  animSpeed,
  fontSize,
  textColor,
}: ChatFeedProps) {
  const [barrages, setBarrages] = useState<Barrage[]>([])
  const seenRef = useRef(new Set<string>())
  const initializedRef = useRef(false)
  const laneLastUsedRef = useRef<Record<number, number>>({})
  const stageRef = useRef<HTMLDivElement>(null)
  const barrageKeyRef = useRef(0)

  useEffect(() => {
    if (!initializedRef.current) {
      messages.forEach((m) => seenRef.current.add(m.id))
      initializedRef.current = true
      return
    }

    const stage = stageRef.current
    const stageHeight = stage?.offsetHeight || 400
    const stageWidth = stage?.offsetWidth || 640
    const duration = SPEED_DURATION[animSpeed] || SPEED_DURATION.normal
    const laneHeight = stageHeight / LANE_COUNT

    const newMessages = messages.filter((m) => !seenRef.current.has(m.id))
    if (newMessages.length === 0) return

    setBarrages((prev) => {
      let next = [...prev]

      for (const msg of newMessages) {
        seenRef.current.add(msg.id)
        if (next.length >= MAX_CONCURRENT) {
          next.shift()
        }

        const lane = pickLane(laneLastUsedRef.current)
        const top = laneTop(lane, laneHeight, stageHeight)

        next.push({
          key: `${msg.id}-${barrageKeyRef.current++}`,
          text: msg.text,
          top,
          duration,
          travel: stageWidth + 100,
        })
      }

      return next
    })
  }, [messages, animSpeed])

  const handleAnimationEnd = useCallback((key: string) => {
    setBarrages((prev) => prev.filter((b) => b.key !== key))
  }, [])

  return (
    <div ref={stageRef} className="cf-danmaku-stage">
      {barrages.map((b) => (
        <div
          key={b.key}
          className="cf-danmaku-item"
          style={{
            top: `${b.top}px`,
            fontSize: `${fontSize}px`,
            color: textColor,
            animationDuration: `${b.duration}s`,
            '--cf-travel': `${b.travel}px`,
          }}
          onAnimationEnd={() => handleAnimationEnd(b.key)}
        >
          {b.text}
        </div>
      ))}
    </div>
  )
}
