import {
  ColorPicker,
  ColorPickerAlphaSlider,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerEyeDropper,
  ColorPickerFormatSelect,
  ColorPickerHueSlider,
  ColorPickerInput,
  ColorPickerSwatch,
  ColorPickerTrigger,
} from '@/components/ui/color-picker'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from '@/components/ui/button-group'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { normalizeTextColor } from '@/lib/normalize-color'
import { Monitor, Rabbit, Snail, SquareArrowOutUpRight, Turtle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useChromeStorage } from '../content/overlay/useChromeStorage'
import type { AnimSpeed } from '../content/overlay/useChromeStorage'

const SPEED_OPTIONS: {
  value: AnimSpeed
  label: string
  icon: LucideIcon
}[] = [
  { value: 'fast', label: 'Fast', icon: Rabbit },
  { value: 'normal', label: 'Normal', icon: Turtle },
  { value: 'slow', label: 'Slow', icon: Snail },
]

function openWindowedFullscreen(mode: 'this-tab' | 'popup') {
  try {
    chrome.runtime.sendMessage({ type: 'OPEN_WINDOWED_FS', mode })
  } catch (err) {
    console.warn('[PopupApp] Failed to open windowed fullscreen:', err)
  }
}

export default function PopupApp() {
  const [settings, setSettings, loaded] = useChromeStorage()

  return (
    <TooltipProvider delayDuration={300}>
      <div className="popup-shell">
        <Card className="w-full min-w-80 max-w-80">
          <CardHeader>
            <CardTitle>Chat Float</CardTitle>
            <CardDescription>YouTube live danmaku overlay</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="popup-field popup-field-row">
              <Label>Windowed fullscreen</Label>
              <ButtonGroup variant="outline">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 rounded-none border-0 px-2 shadow-none hover:bg-muted"
                      aria-label="Apply windowed fullscreen to this tab"
                      onClick={() => openWindowedFullscreen('this-tab')}
                    >
                      <Monitor className="size-3.5" />
                      This tab
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Shift+F</TooltipContent>
                </Tooltip>
                <ButtonGroupSeparator />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-none border-0 shadow-none hover:bg-muted"
                      aria-label="Open windowed fullscreen in popup"
                      onClick={() => openWindowedFullscreen('popup')}
                    >
                      <SquareArrowOutUpRight className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Open popup window</TooltipContent>
                </Tooltip>
              </ButtonGroup>
            </div>

            <div className="popup-field popup-field-row">
              <Label htmlFor="enabled">Show overlay</Label>
              <Switch
                id="enabled"
                size="sm"
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ enabled: checked })}
              />
            </div>

            <div className="popup-field popup-field-row">
              <Label htmlFor="animSpeed">Speed</Label>
              <ToggleGroup
                id="animSpeed"
                type="single"
                variant="outline"
                spacing={0}
                value={settings.animSpeed}
                defaultValue="normal"
                onValueChange={(value) => {
                  if (value) setSettings({ animSpeed: value as AnimSpeed })
                }}
              >
                {SPEED_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <ToggleGroupItem key={value} value={value} aria-label={label}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex size-full items-center justify-center">
                          <Icon className="size-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{label}</TooltipContent>
                    </Tooltip>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="popup-field">
              <div className="popup-field-row">
                <Label htmlFor="opacity">Opacity</Label>
                <span className="popup-value">
                  {settings.opacity.toFixed(2)}
                </span>
              </div>
              <Slider
                id="opacity"
                min={0.3}
                max={1}
                step={0.05}
                value={[settings.opacity]}
                onValueChange={([value]) => setSettings({ opacity: value })}
              />
            </div>

            <div className="popup-field">
              <div className="popup-field-row">
                <Label htmlFor="fontSize">Font size</Label>
                <span className="popup-value">{settings.fontSize}px</span>
              </div>
              <Slider
                id="fontSize"
                min={12}
                max={28}
                step={1}
                value={[settings.fontSize]}
                onValueChange={([value]) => setSettings({ fontSize: value })}
              />
            </div>

            <div className="popup-field popup-field-row">
              <Label htmlFor="textColor">Text color</Label>
              {loaded ? (
                <ColorPicker
                  defaultFormat="hex"
                  value={settings.textColor}
                  onValueChange={(value) =>
                    setSettings({ textColor: normalizeTextColor(value) })
                  }
                >
                  <ColorPickerTrigger asChild>
                    <ColorPickerSwatch />
                  </ColorPickerTrigger>
                  <ColorPickerContent
                    className="popup-color-picker-content"
                    side="top"
                    align="end"
                  >
                    <ColorPickerArea />
                    <div className="flex items-center gap-2">
                      <ColorPickerEyeDropper />
                      <div className="flex flex-1 flex-col gap-2">
                        <ColorPickerHueSlider />
                        <ColorPickerAlphaSlider />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ColorPickerFormatSelect />
                      <ColorPickerInput />
                    </div>
                  </ColorPickerContent>
                </ColorPicker>
              ) : (
                <div className="size-8 rounded-md border border-input bg-muted" />
              )}
            </div>

            <div className="popup-field popup-field-row">
              <Label htmlFor="hidePanelsFullBleed">
                Hide live chat (full screen)
              </Label>
              <Switch
                id="hidePanelsFullBleed"
                size="sm"
                checked={settings.hidePanelsFullBleed}
                onCheckedChange={(checked) =>
                  setSettings({ hidePanelsFullBleed: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
