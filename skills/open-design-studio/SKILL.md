---
name: open-design-studio
description: >-
  Master workflow skill for Open Design Studio v2. Use when the user asks to
  open Open Design Studio, activate or switch a design system, build prototypes,
  dashboards, slides, landing pages, or motion graphics, query exact component
  APIs/tokens, lint against anti-AI-slop rules, sync assets to a workspace, or
  export HTML/ZIP/PPTX.
---

# Open Design Studio v2 · AG 深度融合工作流

Open Design Studio 已通过 AG 规则、按需钩子与动态 `ds://` 资源深度接入对话流，核心链路压缩为 **查精简契约 → 按需精查 API → 单步 `od_render` 出图闭环 → 按需工程落地**。

## 极速工作流

1. **确认当前激活系统**：
   - 若上下文已注入 `[Active Design System]` 或挂载了 `ds://<id>/digest` 胶囊，直接采用该系统；若不确定可用 `od_list_design_systems`（或用户明确指定切换时调用 `od_set_active_system`）。
   - 若目标系统尚未安装，可从官方 150+ 目录按需拉取（`od_sync_upstream_system`）或导入本地包（`od_import_design_system`）。
2. **精准查规范（零幻觉）**：
   - 调用 `od_query_system(id, aspect, query)` 按需获取精确信息，不再整包盲读：
     - `aspect="component", query="Page,Entry,Button"`：获取真实组件 Props 签名与 JSX 用法；
     - `aspect="tokens"`：检索双主题语义变量；
     - `aspect="assets"`：检索可用 SVG Marks / Icons；
     - `aspect="rules"` 或 `"voice"`：读取禁忌清单与文案规范；
     - `aspect="boilerplate"`：直接拿可运行的 HTML5 起手骨架。
   - 按任务需要参考内置上游工艺准则：[anti-ai-slop.md](../../resources/upstream/craft/anti-ai-slop.md)、[typography-hierarchy.md](../../resources/upstream/craft/typography-hierarchy.md)、[color.md](../../resources/upstream/craft/color.md)、[accessibility-baseline.md](../../resources/upstream/craft/accessibility-baseline.md)。
3. **单步渲染、质检与实时预览（`od_render`）**：
   - 直接调用 **`od_render`**（传 `title`, `type`, `files` 或 `html` 或结构化 `slides`）：**一次调用**自动完成项目创建/版本递增、`/ds/<id>/tokens.css`（及按需 `bundle.js/css`）注入、确定性 Linter 体检与右侧 Studio 画布实时预览。
   - 若返回的 `lint.errors > 0`，立即依据报错修改并传入 `projectId` + `artifactId` 再次调用 `od_render` 叠代至 `passed: true`。
4. **工程落盘与本地代码体检**：
   - 需要落盘到真实项目或绑定项目默认系统时，调用 `od_sync_to_workspace(targetDir, mode="design-system"|"artifact")`。
   - 需要检查工作区已有前端代码时，调用 `od_lint_workspace(paths)`。
   - 需要文件交付时调用 `od_export_artifact` 导出 `.html`、`.zip` 或 `.pptx`。

## 专项子技能

- Web / App 原型与数据看板：`od-web-prototype`
- 16:9 演示文稿与 PPTX 导出：`od-slides-deck`
- 品牌提取与 `DESIGN.md` 生成：`od-brand-extractor`
- 动效设计与微交互分镜：`od-motion-design`
