// Extensible per-system custom rule packs keyed by designSystemId
const SYSTEM_RULE_PACKS = {};

function stripRootBlocks(cssText = '') {
  return cssText.replace(/(?::root|\[data-theme\s*=\s*["'][^"']+["']\])\s*\{[^}]*\}/gi, ' ');
}

export function lintArtifact({
  html = '',
  css = '',
  code = '',
  designSystemId = '',
  type = 'prototype',
  isComponentCode = false,
}) {
  const issues = [];
  const combined = `${html}\n${css}\n${code}`;
  const isPureCode = Boolean(isComponentCode && !html.trim());

  const add = (severity, rule, message, hint) => {
    issues.push({ severity, rule, message, hint });
  };

  // 1. Structural & accessibility checks (HTML pages only)
  if (!isPureCode) {
    if (!/<!doctype\s+html>/i.test(html)) {
      add('warning', 'doc-doctype', '缺少 <!doctype html> 声明', '在 HTML 顶部添加 <!doctype html> 以避免怪异盒模型。');
    }
    if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
      add('warning', 'doc-viewport', '缺少响应式 viewport meta 标签', '添加 <meta name="viewport" content="width=device-width, initial-scale=1">。');
    }
    if (!/<html[^>]+lang=/i.test(html)) {
      add('info', 'doc-lang', '<html> 标签缺少 lang 属性', '建议声明 lang="zh-CN" 或对应语言以改善无障碍和字体回退。');
    }
  }

  const imgsWithoutAlt = [...`${html}\n${code}`.matchAll(/<img\b(?![^>]*\balt\s*=)[^>]*>/gi)];
  if (imgsWithoutAlt.length > 0) {
    add('warning', 'a11y-img-alt', `发现 ${imgsWithoutAlt.length} 个 <img> 缺少 alt 属性`, '装饰图请设 alt=""，内容图请写明替代描述。');
  }

  // 2. Universal Anti-AI-Slop checks
  const neonGradPatterns = [
    /linear-gradient\([^)]*(?:#6366f1|#8b5cf6|#a855f7|#ec4899|#3b82f6)/i,
    /from-(?:purple|indigo|violet|fuchsia)-/i,
  ];
  if (neonGradPatterns.some((re) => re.test(combined))) {
    add(
      'error',
      'anti-slop-neon-gradient',
      '检测到典型 AI 模板紫蓝霓虹渐变',
      '请改用当前设计系统 tokens.css 里的语义底色（如 --surface、--primary），避免通用紫蓝渐变。',
    );
  }

  const visibleText = (html || code)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  if (emojiRe.test(visibleText)) {
    add(
      'error',
      'anti-slop-emoji-chrome',
      '界面文本中混入了 Emoji 表情符号',
      '请用当前设计系统的线性 SVG 图标或等宽编号代替 Emoji。',
    );
  }

  const placeholderMatch = visibleText.match(/\b(lorem ipsum|acme corp|john doe|jane doe|coming soon)\b/i);
  if (placeholderMatch) {
    add(
      'warning',
      'anti-slop-placeholder-copy',
      `发现占位符假文案: "${placeholderMatch[0]}"`,
      '请替换为符合真实业务语境与单位的数据和文案。',
    );
  }

  // 3. Token compliance & raw hex outside :root check
  if (designSystemId) {
    const usesCssVars = /var\(--[a-z0-9_-]+\)/i.test(combined);
    const nonRootText = stripRootBlocks(combined);
    const hexOutsideRoot = new Set(nonRootText.match(/#[0-9a-f]{6}\b/gi) || []);
    if (!usesCssVars && hexOutsideRoot.size > 6) {
      add(
        'warning',
        'ds-tokens-binding',
        `已绑定设计系统 "${designSystemId}"，但代码未使用 var(--*) CSS 变量（发现 ${hexOutsideRoot.size} 个硬编码色值）`,
        `请引入 /ds/${designSystemId}/tokens.css 并使用语义变量（如 var(--surface)、var(--on-surface)、var(--primary)）。`,
      );
    } else if (hexOutsideRoot.size > 12) {
      add(
        'warning',
        'ds-raw-hex-excess',
        `:root 块外出现 ${hexOutsideRoot.size} 个不同裸 Hex 色值（上限 12 个）`,
        '请将界面颜色统一映射至当前设计系统的 CSS 语义变量。',
      );
    }
  }

  // 4. Optional system-specific rule pack extension
  const pack = SYSTEM_RULE_PACKS[designSystemId];
  if (typeof pack === 'function') {
    pack({ html, css, code, combined, visibleText, type, isComponentCode: isPureCode, add });
  }

  if (type === 'slides' && !isPureCode && !/od-slide|slide/i.test(html)) {
    add('info', 'slides-structure', '幻灯片产物建议包含显式分屏结构 (.od-slide)', '使用结构化 slides 数组创建可自动同时支持网页翻页和 PPTX 导出。');
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const info = issues.filter((i) => i.severity === 'info').length;
  const score = Math.max(0, 100 - errors * 20 - warnings * 8 - info * 2);

  return {
    score,
    passed: errors === 0,
    counts: { errors, warnings, info },
    issues,
  };
}
