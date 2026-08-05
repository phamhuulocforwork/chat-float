declare module '*.module.css'

declare module '*.css?inline' {
  const content: string
  export default content
}

declare module '../images/icon.png' {
  const src: string
  export default src
}

export type { OverlaySettings, AnimSpeed } from './content/overlay/useChromeStorage'
export type { ChatMessage } from './content/overlay/chatScraper'
