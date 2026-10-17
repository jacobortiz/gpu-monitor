import type { GpuReading, GpuSnapshot } from '../types'

export const QUERY_FIELDS = [
  'index',
  'name',
  'utilization.gpu',
  'memory.used',
  'memory.total',
  'temperature.gpu',
  'power.draw',
  'power.limit',
] as const

export const NVIDIA_SMI_ARGS = [
  `--query-gpu=${QUERY_FIELDS.join(',')}`,
  '--format=csv,noheader,nounits',
]

export const HISTORY_LENGTH = 60

export const EMPTY_SNAPSHOT: GpuSnapshot = { gpus: [], history: [], error: null, at: 0 }

const num = (text: string | undefined): number | null => {
  const value = Number.parseFloat((text ?? '').trim())
  return Number.isFinite(value) ? value : null
}

/** Parses `nvidia-smi --query-gpu=... --format=csv,noheader,nounits` output. */
export function parseNvidiaSmi(stdout: string): GpuReading[] {
  return stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map((line, row) => {
      const cells = line.split(',').map(cell => cell.trim())
      return {
        index: num(cells[0]) ?? row,
        name: cells[1] ?? `GPU ${row}`,
        utilPercent: num(cells[2]),
        memUsedMiB: num(cells[3]),
        memTotalMiB: num(cells[4]),
        tempC: num(cells[5]),
        powerW: num(cells[6]),
        powerLimitW: num(cells[7]),
      }
    })
}

/** Adds a reading to the snapshot, keeping the last HISTORY_LENGTH samples per GPU. */
export function withReading(prev: GpuSnapshot, gpus: GpuReading[], at: number): GpuSnapshot {
  const history = gpus.map((gpu, i) =>
    [...(prev.history[i] ?? []), gpu.utilPercent ?? 0].slice(-HISTORY_LENGTH),
  )
  return { gpus, history, error: null, at }
}

export const withError = (prev: GpuSnapshot, error: string, at: number): GpuSnapshot => ({
  ...prev,
  gpus: [],
  error,
  at,
})

const SPARKS = '▁▂▃▄▅▆▇█'

export function sparkline(samples: number[], width: number): string {
  return samples
    .slice(-width)
    .map(v => SPARKS[Math.min(SPARKS.length - 1, Math.max(0, Math.round((v / 100) * (SPARKS.length - 1))))])
    .join('')
}

export function bar(fraction: number, width: number): string {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

/** success below 60%, warning below 85%, error above. */
export function loadColor(percent: number | null): 'success' | 'warning' | 'error' | undefined {
  if (percent === null) return undefined
  if (percent < 60) return 'success'
  if (percent < 85) return 'warning'
  return 'error'
}

export const gib = (mib: number | null): string => (mib === null ? '?' : (mib / 1024).toFixed(1))

export const shortName = (name: string): string =>
  name.replace(/^NVIDIA\s+/i, '').replace(/^GeForce\s+/i, '')

/** One line for the status bar, e.g. "RTX 5080 97% · 14.2/15.9 GB · 71°C". */
export function statusText(gpu: GpuReading): string {
  const parts = [`${shortName(gpu.name)} ${gpu.utilPercent ?? '?'}%`]
  if (gpu.memTotalMiB !== null) parts.push(`${gib(gpu.memUsedMiB)}/${gib(gpu.memTotalMiB)} GB`)
  if (gpu.tempC !== null) parts.push(`${gpu.tempC}°C`)
  return parts.join(' · ')
}

/** The error text for a failed nvidia-smi run. */
export function describeFailure(exitCode: number | null, stderr: string): string {
  if (exitCode === null) return 'nvidia-smi was not found. This panel needs an NVIDIA GPU and its driver.'
  const detail = stderr.trim().split(/\r?\n/)[0]
  return `nvidia-smi failed (exit ${exitCode})${detail ? `: ${detail}` : ''}`
}
