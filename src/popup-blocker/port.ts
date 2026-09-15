const PORT_ID = 'cf-popup-port'

export function getOrCreatePort(): HTMLElement {
  let port = document.getElementById(PORT_ID)
  if (port) {
    port.remove()
    return port
  }

  port = document.createElement('span')
  port.id = PORT_ID
  document.documentElement.append(port)
  return port
}

export function setPortEnabled(port: HTMLElement, enabled: boolean) {
  port.dataset.enabled = enabled ? 'true' : 'false'
}

export function isPortEnabled(port: HTMLElement): boolean {
  return port.dataset.enabled !== 'false'
}
