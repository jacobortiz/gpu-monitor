import { expect, test } from 'claude-code/testing'

import {
  EMPTY_SNAPSHOT,
  HISTORY_LENGTH,
  bar,
  describeFailure,
  loadColor,
  parseNvidiaSmi,
  sparkline,
  statusText,
  withError,
  withReading,
} from './gpu'

const ONE_GPU = '0, NVIDIA GeForce RTX 5080, 97, 14540, 16303, 71, 331.42, 360.00\r\n'
const TWO_GPUS = '0, NVIDIA GeForce RTX 5080, 12, 2048, 16303, 45, [N/A], [N/A]\n1, NVIDIA RTX A2000, 0, 300, 6138, 38, 9.5, 70.00\n'

test('parses one GPU from nvidia-smi csv', () => {
  expect(parseNvidiaSmi(ONE_GPU)).toEqual([
    {
      index: 0,
      name: 'NVIDIA GeForce RTX 5080',
      utilPercent: 97,
      memUsedMiB: 14540,
      memTotalMiB: 16303,
      tempC: 71,
      powerW: 331.42,
      powerLimitW: 360,
    },
  ])
})

test('parses several GPUs and reads [N/A] as null', () => {
  const gpus = parseNvidiaSmi(TWO_GPUS)
  expect(gpus.length).toBe(2)
  expect(gpus[0]?.powerW).toBe(null)
  expect(gpus[0]?.powerLimitW).toBe(null)
  expect(gpus[1]?.name).toBe('NVIDIA RTX A2000')
  expect(gpus[1]?.powerW).toBe(9.5)
})

test('empty output parses to no GPUs', () => {
  expect(parseNvidiaSmi('\r\n')).toEqual([])
})

test('history keeps the last samples per GPU', () => {
  let snap = EMPTY_SNAPSHOT
  for (let i = 0; i < HISTORY_LENGTH + 5; i += 1) {
    snap = withReading(snap, parseNvidiaSmi(ONE_GPU), i)
  }
  expect(snap.history[0]?.length).toBe(HISTORY_LENGTH)
  expect(snap.at).toBe(HISTORY_LENGTH + 4)
  expect(snap.error).toBe(null)
})

test('an error clears the GPUs but keeps the history', () => {
  const snap = withError(withReading(EMPTY_SNAPSHOT, parseNvidiaSmi(ONE_GPU), 1), 'gone', 2)
  expect(snap.gpus).toEqual([])
  expect(snap.history[0]).toEqual([97])
  expect(snap.error).toBe('gone')
})

test('formats bars, sparklines, colors and the status line', () => {
  expect(bar(0.5, 10)).toBe('█████░░░░░')
  expect(bar(2, 4)).toBe('████')
  expect(sparkline([0, 50, 100], 10)).toBe('▁▅█')
  expect(sparkline([0, 0, 0, 100], 2)).toBe('▁█')
  expect(loadColor(10)).toBe('success')
  expect(loadColor(70)).toBe('warning')
  expect(loadColor(95)).toBe('error')
  expect(loadColor(null)).toBe(undefined)
  const [rtx] = parseNvidiaSmi(ONE_GPU)
  if (rtx === undefined) throw new Error('no GPU parsed')
  expect(statusText(rtx)).toBe('RTX 5080 97% · 14.2/15.9 GB · 71°C')
})

test('explains a missing nvidia-smi', () => {
  expect(describeFailure(null, '')).toContain('not found')
  expect(describeFailure(9, 'NVIDIA-SMI has failed\nmore')).toBe('nvidia-smi failed (exit 9): NVIDIA-SMI has failed')
})
