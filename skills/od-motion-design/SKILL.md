---
name: od-motion-design
description: >-
  Create programmatic HTML/CSS/SVG/Canvas motion graphics, micro-interactions,
  and storyboarded animated explainers inside Open Design Studio.
---

# Open Design Motion & Micro-Interactions

用于制作可直接在 Studio 画布中播放、逐帧调校和导出的 HTML/CSS/SVG/Canvas 动态图形与交互动效（`type: "motion"`）。

## 上游参考规范

- [motion-design SKILL.md](../../resources/upstream/skills/motion-design/SKILL.md)
- [animate SKILL.md](../../resources/upstream/skills/animate/SKILL.md)
- [animation-discipline.md](../../resources/upstream/craft/animation-discipline.md)

## 核心原则

1. **绑定设计系统动效曲线**：先调用 `od_query_system(aspect="tokens", query="ease|dur")` 查出目标系统 `tokens.css` 中的 `--ease-*` 与 `--dur-*` 变量（若未声明，则使用克制的 `cubic-bezier(0.22, 1, 0.36, 1)` 与 180–360ms 时长），避免过度弹跳或廉价闪光。
2. **尊重无障碍**：必须包含 `@media (prefers-reduced-motion: reduce)` 降级样式，确保减少动效模式可用。
3. **可操控回放**：对于分镜演示型动效，在画面底部或角落提供简洁的「重播 / 暂停 / 进度条」控件，方便在 Studio 画布里反复评审。
4. 写完后直接调用单步 **`od_render(type="motion", ...)`**，一步完成版本保存、Linter 检查与右侧画布播放。
