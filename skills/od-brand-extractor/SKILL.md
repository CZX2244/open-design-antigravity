---
name: od-brand-extractor
description: >-
  Extract or synthesize a portable Open Design (od-design-system-project/v1)
  design system package (manifest.json, DESIGN.md, tokens.css) from a website,
  screenshot, codebase, or brand brief and import it into Open Design Studio.
---

# Open Design Brand & System Extractor

用于从现有网站、截图、前端代码库或设计文档中提炼标准 **`od-design-system-project/v1`** 设计系统包并注册到 Open Design Studio。

## 上游参考规范

- [brand-extract SKILL.md](../../resources/upstream/skills/brand-extract/SKILL.md)
- [design-md SKILL.md](../../resources/upstream/skills/design-md/SKILL.md)
- [color.md](../../resources/upstream/craft/color.md) & [typography.md](../../resources/upstream/craft/typography.md)

## 标准导出目录结构

将提炼出的设计系统写入临时文件夹（如 `<scratch>/ds-staging/<slug>/`），确保包含以下三个文件：

1. `manifest.json`：
   ```json
   {
     "schemaVersion": "od-design-system-project/v1",
     "id": "<slug>",
     "name": "<Human Readable Name>",
     "category": "<Category>",
     "description": "<One-sentence summary>",
     "source": { "type": "extracted", "origin": "<url or repo>" },
     "files": { "design": "DESIGN.md", "tokens": "tokens.css" }
   }
   ```
2. `DESIGN.md`：包含视觉立意、色彩契约与对比度说明、字体排印阶梯、圆角/线宽/留白规范以及禁止清单。
3. `tokens.css`：包含 `:root, [data-theme="light"]` 与 `[data-theme="dark"]` 语义变量（`--surface`、`--surface-1`、`--surface-card`、`--on-surface`、`--on-surface-muted`、`--outline`、`--primary`、`--on-primary`、`--signature`、`--frame`、`--on-frame`、`--font-display`、`--font-sans`、`--font-mono`）。

生成完毕后，调用 `od_import_design_system(sourcePath="<dir>", id="<slug>")` 导入 Studio，并按需调用 `od_set_active_system(id="<slug>")` 设为激活系统，再打开 `open_studio(tab="systems")` 供用户预览。
