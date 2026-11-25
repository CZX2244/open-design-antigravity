---
name: od-slides-deck
description: >-
  Create 16:9 presentation slide decks in Open Design Studio with dual-track
  HTML preview + speaker notes and native editable PPTX export.
---

# Open Design Slides & PPTX Deck

用于创建支持 Studio 16:9 实时翻页预览、演讲者备注以及原生可编辑 `.pptx` 导出的演示文稿。

## 上游参考规范

- [slides SKILL.md](../../resources/upstream/skills/slides/SKILL.md)
- [frontend-slides SKILL.md](../../resources/upstream/skills/frontend-slides/SKILL.md)
- [pptx SKILL.md](../../resources/upstream/skills/pptx/SKILL.md)

## 双轨结构规范

直接调用单步 **`od_render`**，设置 `type: "slides"`，并优先传入结构化 `slides` 数组：

```json
[
  {
    "eyebrow": "SECTION 01 · CONTEXT",
    "title": "结论型标题：一页只讲清一件事",
    "body": "精炼导语（不超过两行）。",
    "metrics": [{ "label": "HUMIDITY", "value": "78", "unit": "%" }],
    "bullets": ["关键事实 1", "关键事实 2"],
    "notes": "给演讲者的口播备注与过渡提示。"
  }
]
```

- 传入 `slides` 后，服务端会自动结合当前激活设计系统的 `tokens.css` 生成交互式 16:9 网页预览（`index.html`）及 `slides.json` 并执行 Lint；用户点击 **导出 PPTX** 或调用 `od_export_artifact(format="pptx")` 时，将自动编译为带完整色板与演讲者备注的可编辑 PowerPoint 文件。
- 如果需要更复杂的自定义 HTML 排版，可同时传入 `html` / `files` 与 `slides` 数组，实现网页精细呈现 + PPTX 结构化导出双全。
