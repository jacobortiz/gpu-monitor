import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { GpuReading } from '../types'
import {
  EMPTY_SNAPSHOT,
  NVIDIA_SMI_ARGS,
  bar,
  describeFailure,
  gib,
  loadColor,
  parseNvidiaSmi,
  shortName,
  sparkline,
  statusText,
  withError,
  withReading,
} from './gpu'

const PANE = 'gpu-monitor'
const TITLE = 'GPU'
const snapshot = atom({ plugin: 'gpu-monitor', key: 'snapshot' } as const, EMPTY_SNAPSHOT)

// Tool calls running right now whose name matches `watchTools`
let watchedCalls = 0
let isSampling = false

// Reads nvidia-smi once, but only while someone is looking: the pane is open or a watched tool runs
async function sample($: EngineInterface): Promise<void> {
  if (isSampling) return
  isSampling = true
  try {
    const isPaneUp = (await $.ui.panes()).some(pane => pane.id === PANE)
    if (!isPaneUp && watchedCalls === 0) return

    const now = await $.clock.now()
    let gpus: GpuReading[] | null = null
    let error: string | null = null
    try {
      const run = await $.process.run(['nvidia-smi', ...NVIDIA_SMI_ARGS], { timeoutMs: 10_000 })
      if (run.exitCode === 0) gpus = parseNvidiaSmi(run.stdout)
      else error = describeFailure(run.exitCode, run.stderr)
    } catch {
      error = describeFailure(null, '')
    }
    if (gpus !== null && gpus.length === 0) error = 'nvidia-smi reported no GPUs.'

    await update($, snapshot, prev =>
      error === null && gpus !== null ? withReading(prev, gpus, now) : withError(prev, error ?? '', now),
    )
    if (watchedCalls > 0 && gpus?.[0]) await $.ui.status(statusText(gpus[0]))
  } finally {
    isSampling = false
  }
}

export const register: Register = (on, options) => {
  const refreshMs = Math.max(1, Number(options.refreshSeconds ?? 2)) * 1000
  const autoOpen = options.autoOpen !== false
  const watch = String(options.watchTools ?? 'comfy').trim().toLowerCase()

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'gpu', description: 'Show live GPU utilization, VRAM, temperature and power' })
    $.clock.every(refreshMs, () => void sample($))

    return next(e)
  })

  on('command.run', { command: 'gpu' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    await sample($)

    return { text: 'GPU panel opened.' }
  })

  on('tool.call', async ($, e, next) => {
    if (watch === '' || !e.tool.toLowerCase().includes(watch)) return next(e)

    watchedCalls += 1
    if (autoOpen) await $.ui.open({ id: PANE, title: TITLE })
    void sample($)
    try {
      return await next(e)
    } finally {
      watchedCalls -= 1
      if (watchedCalls === 0) await $.ui.status(undefined)
    }
  }).catch(($, e, next) => next(e)) // only watches: never stands in the tool call's way

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const snap = await read($, snapshot)
    // Desktop panes draw wider glyphs than bodyColumns suggests, so stay well inside it:
    // each metric is a label/value line with its bar alone on the line below
    const columns = Math.max(24, e.props.bodyColumns ?? 40)
    const barWidth = Math.max(8, Math.min(20, columns - 6))
    const sparkWidth = Math.max(10, Math.min(24, columns - 6))

    if (snap.error !== null) {
      return (
        <Box flexDirection="column">
          <Text color="warning">{snap.error}</Text>
        </Box>
      )
    }
    if (snap.gpus.length === 0) {
      return <Text dimColor>Reading nvidia-smi…</Text>
    }

    return (
      <Box flexDirection="column" gap={1}>
        {snap.gpus.map((gpu, i) => {
          const memFraction = gpu.memUsedMiB !== null && gpu.memTotalMiB ? gpu.memUsedMiB / gpu.memTotalMiB : 0
          const memPercent = Math.round(memFraction * 100)
          return (
            <Box key={`gpu-${gpu.index}`} flexDirection="column">
              <Text weight="semibold">
                {snap.gpus.length > 1 ? `${gpu.index}: ` : ''}
                {shortName(gpu.name)}
              </Text>
              <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
                <Text>GPU</Text>
                <Text tabular>{gpu.utilPercent ?? '?'}%</Text>
              </Box>
              <Text mono color={loadColor(gpu.utilPercent)}>
                {bar((gpu.utilPercent ?? 0) / 100, barWidth)}
              </Text>
              <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
                <Text>VRAM</Text>
                <Text tabular>
                  {gib(gpu.memUsedMiB)} / {gib(gpu.memTotalMiB)} GB
                </Text>
              </Box>
              <Text mono color={loadColor(memPercent)}>
                {bar(memFraction, barWidth)}
              </Text>
              <Box marginTop={1}>
                <Text tabular dimColor>
                  {gpu.tempC !== null ? `${gpu.tempC}°C` : 'temp ?'}
                  {gpu.powerW !== null
                    ? ` · ${Math.round(gpu.powerW)}${gpu.powerLimitW !== null ? ` / ${Math.round(gpu.powerLimitW)}` : ''} W`
                    : ''}
                </Text>
              </Box>
              <Text mono color={loadColor(gpu.utilPercent)}>
                {sparkline(snap.history[i] ?? [], sparkWidth)}
              </Text>
            </Box>
          )
        })}
        <Text dimColor size="caption">
          Last {Math.round((refreshMs * Math.max(1, Math.min(sparkWidth, snap.history[0]?.length ?? 0))) / 1000)}s · every{' '}
          {refreshMs / 1000}s
        </Text>
      </Box>
    )
  })
}
