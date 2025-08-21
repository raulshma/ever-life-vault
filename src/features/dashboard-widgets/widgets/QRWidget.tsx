import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { QrCode, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import QRCode from 'qrcode'
import { QRScanner } from '@/components/QRScanner'

type QRConfig = {
  size?: number
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
}

export default function QRWidget({ config, onConfigChange }: WidgetProps<QRConfig>) {
  const size = typeof config?.size === 'number' ? Math.max(128, Math.min(1024, config.size)) : 256
  const ecl = (config?.errorCorrectionLevel || 'M') as 'L' | 'M' | 'Q' | 'H'

  const [text, setText] = React.useState('')
  const [dataUrl, setDataUrl] = React.useState<string | null>(null)
  const [openScan, setOpenScan] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)

  const generate = React.useCallback(async () => {
    const content = text.trim()
    if (!content) { setDataUrl(null); return }
    setGenerating(true)
    try {
      const url = await QRCode.toDataURL(content, { errorCorrectionLevel: ecl, margin: 1, width: size })
      setDataUrl(url)
    } catch {
      setDataUrl(null)
    } finally {
      setGenerating(false)
    }
  }, [text, ecl, size])

  React.useEffect(() => { void generate() }, [generate])

  const copy = async () => { if (text) { try { await navigator.clipboard.writeText(text) } catch (error) { console.error('Failed to copy text:', error) } } }
  const copyImage = async () => { if (dataUrl) { try { await navigator.clipboard.writeText(dataUrl) } catch (error) { console.error('Failed to copy image:', error) } } }

  const download = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'qr.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const onScanned = (decoded: string) => {
    setText(decoded)
    setOpenScan(false)
  }

  return (
    <WidgetShell
      title="QR"
      actions={
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Scan" onClick={() => setOpenScan(true)}>
                <QrCode className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Scan</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Download" onClick={download} disabled={!dataUrl}>
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download</TooltipContent>
          </Tooltip>
        </div>
      }
    >
      <div className="space-y-3">
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text or URL to encode" />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Size</span>
            <Input type="number" className="w-24" min={128} max={1024} value={size}
              onChange={(e) => onConfigChange({ ...config, size: Number(e.target.value) })} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">ECC</span>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={ecl}
              onChange={(e) => onConfigChange({ ...config, errorCorrectionLevel: e.target.value as 'L' | 'M' | 'Q' | 'H' })}
            >
              <option value="L">L</option>
              <option value="M">M</option>
              <option value="Q">Q</option>
              <option value="H">H</option>
            </select>
          </div>
          <Button size="sm" onClick={generate} disabled={generating}>{generating ? 'Generating…' : 'Generate'}</Button>
          <Button size="sm" variant="outline" onClick={copy}>Copy text</Button>
          <Button size="sm" variant="ghost" onClick={copyImage} disabled={!dataUrl}>Copy image</Button>
        </div>

        <div className="flex items-center justify-center">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="QR code" width={size} height={size} className="rounded-md border" />
          ) : (
            <div className="text-sm text-muted-foreground">Enter text to generate a QR code.</div>
          )}
        </div>
      </div>

      <QRScanner
        open={openScan}
        onOpenChange={setOpenScan}
        onItemFound={(item) => onScanned(item.qr_code_data || '')}
        ui={{ showTorch: true, showFocusSlider: true, requireStableResult: true }}
        decode={{ throttleMs: 150, timeoutMs: 0, facingMode: 'environment' }}
      />
    </WidgetShell>
  )
}


