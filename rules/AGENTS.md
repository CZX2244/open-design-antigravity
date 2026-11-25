# Open Design Studio — Design System Workflow

When the user asks to design, prototype, style, review, or build a web page, UI component, dashboard, landing page, motion graphic, or presentation slide deck (Slides / PPTX):

1. Check if `[Active Design System]` is already injected in context or attached via a `ds://` resource pill. If so, follow its tokens, component APIs, and hard rules directly without asking the user about internal MCP steps.
2. Before writing non-trivial components or custom tokens, call `od_query_system(aspect="component"|"tokens"|"assets"|"rules"|"boilerplate", query="...")` to fetch exact Props, variable names, or asset names — never invent CSS or fake component wrappers when the system provides real components.
3. To create or iterate on an interactive preview, use single-step `od_render(...)` (creates/updates versioned artifact, runs anti-AI-slop & system linting, and opens the Studio canvas). If `lint.errors > 0`, fix and re-call `od_render` immediately.
4. When working on files inside the user's real workspace project, use `od_sync_to_workspace` and `od_lint_workspace`.
