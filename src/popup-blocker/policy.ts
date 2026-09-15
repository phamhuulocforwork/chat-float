import type { PolicyOptions, PolicyRequest, PolicyResult } from './types'

export const POPUP_HOST_ALLOWLIST = [
  'google.com',
  'bing.com',
  't.co',
  'twitter.com',
  'disqus.com',
  'login.yahoo.com',
  'mail.google.com',
  'doubleclick.net',
] as const

const ACCEPTED_PROTOCOLS = ['magnet:'] as const

function hasPopupTarget(target?: string): boolean {
  if (!target) return false

  const base = target.toLowerCase()
  if (!base || base === '_self' || base === '_top') return false

  if (typeof window[base as keyof Window] === 'object') return false

  try {
    if (typeof parent[base as keyof Window] === 'object') return false
  } catch {
    // cross-origin
  }

  try {
    if (document.querySelector(`[name="${base}"]`)) return false
  } catch {
    // ignore
  }

  try {
    if (parent.document.querySelector(`[name="${base}"]`)) return false
  } catch {
    // cross-origin
  }

  return true
}

function hostnameMatchesAllowlist(hostname: string): boolean {
  return POPUP_HOST_ALLOWLIST.some(
    (allowed) =>
      allowed === hostname ||
      hostname.endsWith('.' + allowed) ||
      allowed.endsWith('.' + hostname)
  )
}

function hostnameMatchesBlacklist(
  hostname: string,
  patterns: string[]
): boolean {
  const host = hostname.toLowerCase()

  return patterns.some((pattern) => {
    const trimmed = pattern.trim()
    if (!trimmed) return false

    try {
      return new RegExp(trimmed, 'i').test(host)
    } catch {
      return host.includes(trimmed.toLowerCase())
    }
  })
}

function resolveOpenerHost(): string {
  let scope: Window = window

  for (;;) {
    try {
      const host = scope.location.hostname
      if (host) return host
    } catch {
      return ''
    }

    if (scope === scope.parent) return ''
    scope = scope.parent
  }
}

function resolveHref(href?: string): { href: string; hostname: string } {
  if (!href) return { href: '', hostname: '' }

  let resolved = href
  if (!href.includes(':')) {
    const anchor = document.createElement('a')
    anchor.href = href
    resolved = anchor.href
  }

  try {
    const url = new URL(resolved)
    return { href: resolved, hostname: url.hostname }
  } catch {
    return { href: resolved, hostname: '' }
  }
}

export function evaluatePolicy(
  request: PolicyRequest,
  options: PolicyOptions = {}
): PolicyResult {
  const target = document.activeElement ?? document.documentElement
  const { type } = request
  let href = request.href ?? ''
  let block = true
  let sameContext = false

  if (type === 'element.click') {
    const element =
      'closest' in target
        ? ((target as Element).closest('[target]') ??
          (target as Element).closest('a'))
        : null
    href = href || (element ? ((element as HTMLAnchorElement).href || (element as HTMLFormElement).action) : '')
    block = Boolean(element) || Boolean(href)
  }

  if (type === 'window.open') {
    sameContext = true
  } else {
    block = block && hasPopupTarget(request.target)
  }

  if (request.metaKey && request.isTrusted === false) block = true
  if ('button' in request && request.button !== 0 && request.isTrusted === false) {
    block = true
  }
  if (request.defaultPrevented || (request.metaKey && request.isTrusted)) {
    block = false
  }
  if (request.tag === 'A' && request.download) block = false

  let hostname = ''
  if (block) {
    const resolved = resolveHref(href)
    href = resolved.href
    hostname = resolved.hostname

    if (options.useBlacklist) {
      block = hostnameMatchesBlacklist(
        resolveOpenerHost(),
        options.blacklist ?? []
      )
    } else if (hostname) {
      try {
        const url = new URL(href)
        if (
          ACCEPTED_PROTOCOLS.includes(
            url.protocol as (typeof ACCEPTED_PROTOCOLS)[number]
          )
        ) {
          block = false
        }
        if (hostnameMatchesAllowlist(hostname)) block = false
      } catch {
        // keep block decision
      }
    }
  }

  const elementWithId = target as HTMLElement
  if (!href || href.startsWith('about:')) {
    elementWithId.dataset.cfPpbid =
      elementWithId.dataset.cfPpbid || String(Math.random())
  }

  const id = elementWithId.dataset.cfPpbid || String(Math.random())

  return { id, href, hostname, sameContext, block }
}
