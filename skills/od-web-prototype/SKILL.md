---
name: od-web-prototype
description: >-
  Build interactive web/mobile prototypes, landing pages, and data dashboards
  inside Open Design Studio following upstream craft rules (anti-AI-slop,
  typography hierarchy, state coverage, and design system token contracts).
---

# Open Design Web Prototype & Dashboard

用于制作高完成度的交互原型（`prototype`）、品牌落地页（`landing`）、数据看板（`dashboard`）或组件试样（`component`）。

## 必读上游工艺参考

按任务类型读取插件内置的 Open Design 上游工艺规范与参考实现：
- [anti-ai-slop.md](../../resources/upstream/craft/anti-ai-slop.md) — 反 AI 模板化硬性规范
- [state-coverage.md](../../resources/upstream/craft/state-coverage.md) — 悬停/聚焦/加载/空态/错态全状态覆盖
- [laws-of-ux.md](../../resources/upstream/craft/laws-of-ux.md) — 交互与认知负荷约束
- [frontend-design SKILL.md](../../resources/upstream/skills/frontend-design/SKILL.md)（上游参考）

## 工程约束

1. 优先复用上下文中的 `[Active Design System]`；编写具体组件前调用 `od_query_system(aspect="component"|"tokens"|"boilerplate")` 获取精确 Props 与语义变量，HTML 中直接引用 `/ds/<id>/tokens.css`（及系统自带组件包）。
2. 保证 `<!doctype html>`、`<html lang="zh-CN">`、`<meta name="viewport">` 齐全；图片含 `alt`；绝不在 UI 控件或指标卡片中使用 Emoji 充当图标。
3. 所有数据与文案必须真实具体（带单位、状态与时间戳），严禁 `Lorem ipsum` 或紫蓝霓虹渐变。
4. 写完后直接调用单步 **`od_render`** 完成建项/版本递增、Lint 体检与画布预览；若 `lint.errors > 0` 立即修订并再次调用 `od_render`。若需写入本地工程目录，调用 `od_sync_to_workspace`。
