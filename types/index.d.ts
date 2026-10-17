/** One GPU as nvidia-smi reports it; null where it reports [N/A]. */
export type GpuReading = {
  index: number
  name: string
  utilPercent: number | null
  memUsedMiB: number | null
  memTotalMiB: number | null
  tempC: number | null
  powerW: number | null
  powerLimitW: number | null
}

export type GpuSnapshot = {
  gpus: GpuReading[]
  /** Utilization samples per GPU index, oldest first. */
  history: number[][]
  /** Why there is no reading (no nvidia-smi, no NVIDIA GPU), or null. */
  error: string | null
  /** When the last reading was taken (ms since epoch); 0 before the first. */
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    'gpu-monitor': { snapshot: GpuSnapshot }
  }
}
