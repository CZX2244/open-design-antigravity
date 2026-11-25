# Open Design Studio for Antigravity

An Antigravity-native plugin that brings [Open Design (`nexu-io/open-design`)](https://github.com/nexu-io/open-design) into your daily AI engineering workflow — with **zero-friction design system activation**, **single-step rendering**, **dual-standard precision**, and **real workspace integration**.

## Key Features

- **Dual-Standard Design System Hub**:
  - Supports both **Open Design v1** (`manifest.json` + `DESIGN.md` + `tokens.css`) and **Claude Design v3** (`manifestVersion: 3` + `api/*.md` + React/CSS `bundle.*`).
  - Ships with curated built-in design systems, automatic discovery for sibling Antigravity design-system plugins, local folder/`.zip` import, and on-demand sync from **150+ upstream design systems**.
- **Seamless Antigravity Integration**:
  - **Active Design System & Context Pills**: Select a global default system or bind a repository via `.agents/design-system.json`. Click **Attach to Chat** to mount `ds://<id>/digest` directly into the Antigravity composer via `updateModelContext`.
  - **Smart `PreInvocation` Hook (`auto` / `always` / `manual`)**: In `auto` mode, injects a compact (< 2.8 KB) pre-compiled contract once per conversation **only** when UI/prototype/slides intent is detected — zero token overhead on backend tasks.
  - **Precision Query (`od_query_system`)**: Retrieve exact component Props, semantic tokens, SVG asset names, rules, or starter HTML boilerplate on demand.
- **Single-Step `od_render` & Visual Element Picker**:
  - One tool call creates/increments versioned artifacts (`v1 -> v2 -> ...`), injects `tokens.css` / runtime scripts, runs deterministic Anti-AI-Slop linting, and refreshes the interactive preview canvas (`127.0.0.1` authenticated loopback server).
  - Toggle **Pick Element** on any preview to click DOM elements directly and send structured revision requests straight to chat via `app.sendMessage()`.
- **Workspace Sync & Source Linting**:
  - `od_sync_to_workspace`: Installs design system tokens/components or renders artifacts straight into your project folder and writes `.agents/design-system.json`.
  - `od_lint_workspace`: Audits `.html`, `.css`, `.tsx`, `.jsx`, and `.vue` files in real repositories against Anti-AI-Slop and design-system token rules.
- **Local Export**: Export self-contained `.html`, project `.zip`, editable 16:9 `.pptx` (with speaker notes), or portable `od-design-system-project/v1` `.zip`.

## Installation

1. Clone or copy this repository into your Antigravity global plugins directory:
   ```bash
   git clone https://github.com/CZX2244/open-design-antigravity.git ~/.gemini/config/plugins/open-design
   cd ~/.gemini/config/plugins/open-design
   npm install
   npm run build
   ```
2. Antigravity discovers the plugin automatically (including `mcp_config.json`, `hooks.json`, `rules/AGENTS.md`, and the 5 skills under `skills/`).

## Architecture Overview

| Component | Path | Responsibility |
| --- | --- | --- |
| **MCP Server & Preview Host** | `bin/server.mjs` | Tools (`od_render`, `od_query_system`, `od_set_active_system`, etc.), `ds://` resources, and loopback preview server |
| **Dual-Standard Compiler** | `bin/lib/compiler.mjs` | Compiles `od-v1` & `claude-v3` into cached specs, component Props indexes, and compact < 2.8 KB digests |
| **State Manager** | `bin/lib/state.mjs` | Global `state.json`, workspace `.agents/design-system.json` resolution, and hook deduplication |
| **Workspace Bridge** | `bin/lib/workspace.mjs` | `od_sync_to_workspace` & `od_lint_workspace` |
| **Linter & Exporter** | `bin/lib/linter.mjs`, `exporter.mjs` | Anti-AI-Slop checks and HTML/ZIP/PPTX export |
| **AG Rules & Hook** | `rules/AGENTS.md`, `hooks.json`, `scripts/pre-invocation-hook.mjs` | Lightweight routing rule and conditional per-session digest injection |
| **Native Studio UI** | `src/studio-client.ts`, `scripts/build-studio.mjs` | Host-themed MCP App UI (`ui://open-design/app.html`) |

## Bundled Skills

- `open-design-studio` — Master workflow controller
- `od-web-prototype` — Interactive prototypes, dashboards, and landing pages
- `od-slides-deck` — 16:9 slide decks with HTML preview and `.pptx` export
- `od-brand-extractor` — Extract `od-design-system-project/v1` systems from sites/codebases
- `od-motion-design` — Programmatic HTML/CSS/SVG/Canvas motion graphics

## Development & Verification

```bash
npm run build   # Bundles src/studio-client.ts into dist/app.html
npm test        # Runs end-to-end MCP, hook, compiler, render, workspace & export tests
```

## Acknowledgements

Craft rules, skills, and the upstream design system catalog are synced from [nexu-io/open-design](https://github.com/nexu-io/open-design).

## License

MIT
