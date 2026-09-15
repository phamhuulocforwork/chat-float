import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { BlockedPopupAction, BlockedPopupRequest } from '../types'

const AUTO_DISMISS_MS = 10_000

interface BlockedPopupToastProps {
  request: BlockedPopupRequest
  onAction: (action: BlockedPopupAction, request: BlockedPopupRequest) => void
  onDismiss: (request: BlockedPopupRequest) => void
}

function truncateUrl(url: string, max = 72) {
  if (!url || url === 'about:blank') return 'about:blank'
  if (url.length <= max) return url
  return `${url.slice(0, max - 1)}…`
}

export default function BlockedPopupToast({
  request,
  onAction,
  onDismiss,
}: BlockedPopupToastProps) {
  const label = truncateUrl(request.href || request.id)

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(request), AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [request, onDismiss])

  return (
    <Card className="relative w-80 border-border/80 shadow-lg">
      {request.count > 1 ? (
        <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
          {request.count}
        </span>
      ) : null}
      <CardHeader className="gap-1 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">Popup blocked</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label="Dismiss"
            onClick={() => onDismiss(request)}
          >
            <X className="size-4" />
          </Button>
        </div>
        <CardDescription className="break-all text-xs" title={request.href}>
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pt-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => onAction('popup-denied', request)}
        >
          Deny
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8"
          onClick={() => onAction('popup-accepted', request)}
        >
          Allow
        </Button>
        {request.href.startsWith('http') || request.href.startsWith('ftp') ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => onAction('open-tab', request)}
            >
              Tab
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => onAction('popup-redirect', request)}
            >
              Redirect
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
