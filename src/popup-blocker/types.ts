export interface PolicyRequest {
  type: string
  href?: string
  target?: string
  download?: string
  tag?: string
  defaultPrevented?: boolean
  metaKey?: boolean
  button?: number
  isTrusted?: boolean
  args?: unknown[]
}

export interface PolicyOptions {
  useBlacklist?: boolean
  blacklist?: string[]
}

export interface PolicyResult {
  id: string
  href: string
  hostname: string
  sameContext: boolean
  block: boolean
}

export interface WindowRecord {
  id: string
  tree: string[]
  action: {
    method?: string
    args?: unknown[]
    prop?: string
    value?: unknown
  }
}

export interface BlockedPopupRequest {
  id: string
  href: string
  hostname: string
  type: string
  sameContext: boolean
  frameId: number
  count: number
}

export type BlockedPopupAction =
  | 'popup-denied'
  | 'popup-accepted'
  | 'open-tab'
  | 'popup-redirect'
