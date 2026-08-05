export function normalizeTextColor(value: string): string {
  const trimmed = value.trim()

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase()
  }

  const shortHex = trimmed.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/)
  if (shortHex) {
    const [, r, g, b] = shortHex
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i
  )
  if (rgbMatch) {
    const toHex = (n: number) => n.toString(16).padStart(2, '0')
    return `#${toHex(Number(rgbMatch[1]))}${toHex(Number(rgbMatch[2]))}${toHex(Number(rgbMatch[3]))}`
  }

  return trimmed
}
