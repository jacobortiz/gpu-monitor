# gpu-monitor

A live NVIDIA GPU panel for Claude Code. It shows utilization, VRAM, temperature and power draw, with a one-minute utilization history, so you can watch the GPU while Claude runs local AI work such as image generation with ComfyUI.

```
RTX 5080
GPU   ███████████████████░  97%
VRAM  █████████████████░░░  14.2 / 15.9 GB
71°C   331 / 360 W
▁▁▂▅▇████████████▇▇██████▆▂▁
Last 60s · every 2s
```

## Features

- **`/gpu`** opens the panel.
- **Opens by itself** while a watched tool runs (by default any tool with `comfy` in its name, e.g. the [comfy-mcp](https://github.com/Comfy-Org/comfy-mcp) tools), and shows a short status line such as `RTX 5080 97% · 14.2/15.9 GB · 71°C` until the tool finishes.
- Bars turn yellow above 60% and red above 85%.
- Shows every GPU on machines with more than one.
- Costs nothing when idle: `nvidia-smi` only runs while the panel is open or a watched tool is running.

## Requirements

- An NVIDIA GPU with its driver installed, so `nvidia-smi` is on your PATH. On other GPUs the panel says that no NVIDIA GPU was found.
- A Claude Code version with function-hook plugins (mods).

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install gpu-monitor --marketplace jacobortiz/gpu-monitor
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell:

```bash
claude plugin install gpu-monitor --marketplace jacobortiz/gpu-monitor
```

In the Claude desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `jacobortiz/gpu-monitor`, then **Add plugin**.

## Settings

Change these in `/config`:

| Setting | Default | What it does |
|---|---|---|
| Refresh interval (seconds) | `2` | How often `nvidia-smi` is read while the panel is open or a watched tool runs |
| Open during watched tools | on | Opens the panel when a watched tool starts |
| Watched tools | `comfy` | Case-insensitive text matched against tool names; empty watches nothing |

## Development

```bash
claude plugin validate .
claude plugin test .
```

To run it from this folder while editing, start Claude Code with `claude --plugin-dir <path to this folder>`.

The `nvidia-smi` parsing and formatting live in `hooks/gpu.ts`, and the hooks and panel in `hooks/register.tsx`. Tests are in `hooks/*.test.ts(x)`.

## License

MIT
