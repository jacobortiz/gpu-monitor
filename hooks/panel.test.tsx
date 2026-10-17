import { expect, test } from 'claude-code/testing'

const SMI = '0, NVIDIA GeForce RTX 5080, 97, 14540, 16303, 71, 331.42, 360.00\r\n'

const PANE = {
  component: 'Pane',
  requestId: 'gpu-monitor',
  props: {
    title: 'GPU',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

// What the person typing /gpu sends
const GPU_COMMAND = {
  command: 'gpu',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
} as const

// Stands in for the surface: the pane opens placed and is listed as open
const OPEN_PANE = [{ id: 'gpu-monitor', title: 'GPU', isShown: true, isFocused: false, isPlaced: true }]

test('/gpu opens the panel and draws the reading on each surface', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: OPEN_PANE }))
  on('clock.now', () => ({ value: 1_000 }))
  on('process.run', () => ({
    value: { exitCode: 0, stdout: SMI, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))

  const ran = await $.command.run(GPU_COMMAND)
  expect(ran.text).toBe('GPU panel opened.')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'gpu-monitor', surface, ...PANE })
    expect(await ui.find({ type: 'Text', text: /RTX 5080/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /97%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /14\.2 \/ 15\.9 GB/ })).toBeDefined()
    await ui.unmount()
  }
})

test('says so when nvidia-smi is missing', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: OPEN_PANE }))
  on('clock.now', () => ({ value: 1_000 }))
  on('process.run', () => ({ deny: 'ENOENT: nvidia-smi' }))

  await $.command.run(GPU_COMMAND)
  const ui = await $.ui.mount({ plugin: 'gpu-monitor', surface: 'desktop', ...PANE })
  expect(await ui.find({ type: 'Text', text: /nvidia-smi was not found/ })).toBeDefined()
  await ui.unmount()
})
