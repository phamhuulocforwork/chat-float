import { useChatMessages } from './chatScraper'
import { useChromeStorage } from './useChromeStorage'
import ChatFeed from './ChatFeed'

export default function OverlayApp() {
  const [settings] = useChromeStorage()
  const { messages } = useChatMessages()

  const isLivePage =
    location.pathname.includes('/live') || location.pathname.includes('/watch')

  if (!settings.enabled || !isLivePage) {
    return null
  }

  return (
    <div
      className="cf-danmaku-wrapper"
      style={{ opacity: settings.opacity }}
    >
      <ChatFeed
        messages={messages.slice(-settings.maxMessages)}
        animSpeed={settings.animSpeed}
        fontSize={settings.fontSize}
        textColor={settings.textColor}
      />
    </div>
  )
}
