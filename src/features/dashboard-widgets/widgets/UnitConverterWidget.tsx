import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowLeftRight, Copy } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Category = 'length' | 'mass' | 'temperature' | 'speed' | 'area' | 'volume'

type UnitConverterConfig = {
  category?: Category
  from?: string
  to?: string
  precision?: number
}

type UnitDef = {
  // For linear conversions: valueInBase = factor * value + offset
  factor?: number
  offset?: number
}

const lengthUnits: Record<string, UnitDef> = {
  m: { factor: 1 },
  km: { factor: 1000 },
  cm: { factor: 0.01 },
  mm: { factor: 0.001 },
  mi: { factor: 1609.344 },
  ft: { factor: 0.3048 },
  in: { factor: 0.0254 },
}

const massUnits: Record<string, UnitDef> = {
  kg: { factor: 1 },
  g: { factor: 0.001 },
  lb: { factor: 0.45359237 },
  oz: { factor: 0.028349523125 },
}

const speedUnits: Record<string, UnitDef> = {
  'm/s': { factor: 1 },
  'km/h': { factor: 1000 / 3600 },
  mph: { factor: 1609.344 / 3600 },
  knot: { factor: 1852 / 3600 },
}

const areaUnits: Record<string, UnitDef> = {
  'm²': { factor: 1 },
  'km²': { factor: 1_000_000 },
  'ft²': { factor: 0.09290304 },
  'in²': { factor: 0.00064516 },
  acre: { factor: 4046.8564224 },
}

const volumeUnits: Record<string, UnitDef> = {
  L: { factor: 1 },
  mL: { factor: 0.001 },
  'm³': { factor: 1000 },
  'ft³': { factor: 28.316846592 },
  gal: { factor: 3.785411784 }, // US gallon
  pt: { factor: 0.473176473 }, // US pint
}

const categories: Record<Category, { units: Record<string, UnitDef>; base: string }> = {
  length: { units: lengthUnits, base: 'm' },
  mass: { units: massUnits, base: 'kg' },
  speed: { units: speedUnits, base: 'm/s' },
  area: { units: areaUnits, base: 'm²' },
  volume: { units: volumeUnits, base: 'L' },
  temperature: { units: {}, base: 'C' },
}

function convertTemperature(value: number, from: string, to: string): number {
  let celsius: number
  switch (from) {
    case 'C': celsius = value; break
    case 'F': celsius = (value - 32) * (5 / 9); break
    case 'K': celsius = value - 273.15; break
    default: celsius = value
  }
  switch (to) {
    case 'C': return celsius
    case 'F': return (celsius * 9) / 5 + 32
    case 'K': return celsius + 273.15
    default: return celsius
  }
}

const temperatureUnits = ['C', 'F', 'K']

function convertLinear(value: number, units: Record<string, UnitDef>, from: string, to: string): number {
  const f = units[from]
  const t = units[to]
  if (!f || !t) return value
  const base = (f.factor ?? 1) * value + (f.offset ?? 0)
  const result = (base - (t.offset ?? 0)) / (t.factor ?? 1)
  return result
}

export default function UnitConverterWidget({ config, onConfigChange }: WidgetProps<UnitConverterConfig>) {
  const category: Category = (config?.category as Category) || 'length'
  const precision = typeof config?.precision === 'number' ? Math.max(0, Math.min(10, config.precision)) : 2
  const from = config?.from || (category === 'temperature' ? 'C' : categories[category].base)
  const to = config?.to || (category === 'temperature' ? 'F' : Object.keys(categories[category].units)[0])

  const [input, setInput] = React.useState('1')
  const numeric = Number(input)
  const isValid = !isNaN(numeric)

  const unitList = category === 'temperature' ? temperatureUnits : Object.keys(categories[category].units)

  const output = React.useMemo(() => {
    if (!isValid) return ''
    const value = numeric
    let result: number
    if (category === 'temperature') {
      result = convertTemperature(value, from, to)
    } else {
      result = convertLinear(value, categories[category].units, from, to)
    }
    return result.toFixed(precision)
  }, [category, numeric, isValid, from, to, precision])

  const setCategory = (c: Category) => {
    const defaults: UnitConverterConfig = { category: c, precision }
    if (c === 'temperature') defaults.from = 'C', defaults.to = 'F'
    else {
      const units = Object.keys(categories[c].units)
      defaults.from = units[0]
      defaults.to = units[1] || units[0]
    }
    onConfigChange({ ...config, ...defaults })
  }

  const swap = () => {
    onConfigChange({ ...config, from: to, to: from })
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(output) } catch {}
  }

  return (
    <WidgetShell title="Unit Converter" actions={
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="outline" aria-label="Swap" onClick={swap}>
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Swap</TooltipContent>
      </Tooltip>
    }>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-40">
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="length">Length</SelectItem>
                <SelectItem value="mass">Mass</SelectItem>
                <SelectItem value="temperature">Temperature</SelectItem>
                <SelectItem value="speed">Speed</SelectItem>
                <SelectItem value="area">Area</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-28">
            <Select value={from} onValueChange={(v) => onConfigChange({ ...config, from: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {unitList.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28">
            <Select value={to} onValueChange={(v) => onConfigChange({ ...config, to: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {unitList.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <Input type="number" value={precision} min={0} max={10} onChange={(e) => onConfigChange({ ...config, precision: Number(e.target.value) })} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="flex-1 flex items-center gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} className="font-mono" />
            <div className="text-muted-foreground">{from}</div>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <Input value={output} readOnly className="font-mono" />
            <div className="text-muted-foreground">{to}</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" aria-label="Copy" onClick={copy}>
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </WidgetShell>
  )
}


