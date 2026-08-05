import { useState, useEffect, useCallback, useRef } from 'react'

export type AnimSpeed = 'fast' | 'normal' | 'slow'

const VALID_ANIM_SPEEDS: AnimSpeed[] = ['fast', 'normal', 'slow']

export function normalizeAnimSpeed(value: unknown): AnimSpeed {
  if (typeof value === 'string') {
    const lower = value.toLowerCase() as AnimSpeed
    if (VALID_ANIM_SPEEDS.includes(lower)) return lower
  }
  return 'normal'
}

function normalizeSettings(
  stored: Partial<OverlaySettings> | undefined
): OverlaySettings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    animSpeed: normalizeAnimSpeed(stored?.animSpeed),
  }
}

export interface OverlaySettings {
  enabled: boolean
  opacity: number
  autoShow: boolean
  maxMessages: number
  animSpeed: AnimSpeed
  fontSize: number
  textColor: string
  hidePanelsFullBleed: boolean
}

export const DEFAULT_SETTINGS: OverlaySettings = {
  enabled: true,
  opacity: 0.95,
  autoShow: true,
  maxMessages: 200,
  animSpeed: 'normal',
  fontSize: 16,
  textColor: '#ffffff',
  hidePanelsFullBleed: true,
}

export const STORAGE_KEY = 'chat-float-overlay-settings'

const SAVE_DEBOUNCE_MS = 150

export function useChromeStorage(): [
  OverlaySettings,
  (patch: Partial<OverlaySettings>) => void,
  boolean,
] {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const userEditedRef = useRef(false)
  const pendingSaveRef = useRef<OverlaySettings | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushSave = useCallback((next: OverlaySettings) => {
    try {
      chrome.storage.sync.set({ [STORAGE_KEY]: next })
    } catch (err) {
      console.warn(
        '[useChromeStorage] Failed to save settings:',
        err instanceof Error ? err.message : String(err)
      )
    }
  }, [])

  useEffect(() => {
    const load = () => {
      try {
        chrome.storage.sync.get([STORAGE_KEY], (result) => {
          if (!userEditedRef.current && result[STORAGE_KEY]) {
            setSettings(normalizeSettings(result[STORAGE_KEY]))
          }
          setLoaded(true)
        })
      } catch (err) {
        console.warn(
          '[useChromeStorage] Failed to read settings:',
          err instanceof Error ? err.message : String(err)
        )
        setLoaded(true)
      }
    }

    load()

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== 'sync' || !changes[STORAGE_KEY]) return
      const next = changes[STORAGE_KEY].newValue as OverlaySettings | undefined
      if (next) {
        setSettings((prev) => ({ ...prev, ...normalizeSettings(next) }))
      }
    }

    try {
      chrome.storage.onChanged.addListener(onChanged)
      return () => chrome.storage.onChanged.removeListener(onChanged)
    } catch {
      return undefined
    }
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      if (pendingSaveRef.current) {
        flushSave(pendingSaveRef.current)
      }
    }
  }, [flushSave])

  const updateSettings = useCallback(
    (patch: Partial<OverlaySettings>) => {
      userEditedRef.current = true

      setSettings((prev) => {
        const newSettings = { ...prev, ...patch }
        pendingSaveRef.current = newSettings

        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
        }

        saveTimerRef.current = setTimeout(() => {
          if (pendingSaveRef.current) {
            flushSave(pendingSaveRef.current)
          }
        }, SAVE_DEBOUNCE_MS)

        return newSettings
      })
    },
    [flushSave]
  )

  return [settings, updateSettings, loaded]
}
