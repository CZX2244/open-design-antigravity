import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getDataDir, getDesignSystem } from './registry.mjs';

function getCompiledCachePath(id) {
  const dir = join(getDataDir(), 'compiled');
  mkdirSync(dir, { recursive: true });
  return join(dir, `${id}.json`);
}

function getSourceMtimeMs(ds) {
  const candidates = [
    join(ds.rootDir, 'manifest.json'),
    join(ds.rootDir, 'tokens.css'),
    join(ds.rootDir, 'DESIGN.md'),
    join(ds.rootDir, 'README.md'),
    join(ds.rootDir, 'api', 'tokens.md'),
  ];
  let maxMtime = 0;
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        maxMtime = Math.max(maxMtime, statSync(p).mtimeMs);
      } catch {
        // ignore
      }
    }
  }
  return maxMtime;
}

function parseTokensFromApiMd(mdText = '') {
  const tokens = [];
  let currentGroup = 'General';
  for (const line of mdText.split(/\r?\n/)) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      currentGroup = h2[1].trim();
      continue;
    }
    const row = line.match(/^\|\s*`(--[a-z0-9_-]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/i);
    if (row) {
      tokens.push({
        name: row[1].trim(),
        light: row[2].trim(),
        dark: row[3].trim(),
        group: currentGroup,
        usage: row[4].trim(),
      });
      continue;
    }
    const row3 = line.match(/^\|\s*`(--[a-z0-9_-]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/i);
    if (row3 && !/^token$/i.test(row3[1])) {
      tokens.push({
        name: row3[1].trim(),
        light: row3[2].trim(),
        dark: '',
        group: currentGroup,
        usage: row3[3].trim(),
      });
    }
  }
  return tokens;
}

function parseTokensFromCss(tokensCss = '') {
  const map = new Map();
  let mode = 'light';
  let currentGroup = 'Tokens';

  const darkIdx = tokensCss.indexOf('[data-theme="dark"]');
  const parseBlock = (block, targetMode) => {
    let grp = 'Tokens';
    for (const line of block.split(/\r?\n/)) {
      const commentHeading = line.match(/\/\*\s*[─\-]*\s*([A-Za-z0-9 &/()_-]{3,40})/);
      if (commentHeading && !commentHeading[1].includes('───')) {
        grp = commentHeading[1].trim();
      }
      const m = line.match(/^\s*(--[a-z0-9_-]+)\s*:\s*([^;]+);(?:\s*\/\*\s*(.*?)\s*\*\/)?/i);
      if (m) {
        const name = m[1].trim();
        const val = m[2].trim();
        const usage = (m[3] || '').trim();
        const prev = map.get(name) || { name, light: '', dark: '', group: grp || currentGroup, usage: '' };
        if (targetMode === 'dark') {
          prev.dark = val;
        } else {
          prev.light = val;
          if (usage && !prev.usage) prev.usage = usage;
          if (grp && prev.group === 'Tokens') prev.group = grp;
        }
        map.set(name, prev);
      }
    }
  };

  if (darkIdx >= 0) {
    parseBlock(tokensCss.slice(0, darkIdx), 'light');
    parseBlock(tokensCss.slice(darkIdx), 'dark');
  } else {
    parseBlock(tokensCss, mode);
  }
  return [...map.values()];
}

function mergeTokens(primary, secondary) {
  const map = new Map();
  for (const t of secondary) map.set(t.name, { ...t });
  for (const t of primary) {
    const prev = map.get(t.name) || {};
    map.set(t.name, {
      name: t.name,
      light: t.light || prev.light || '',
      dark: t.dark || prev.dark || '',
      group: t.group || prev.group || 'Tokens',
      usage: t.usage || prev.usage || '',
    });
  }
  return [...map.values()];
}

function splitMarkdownSections(md = '') {
  const sections = {};
  let current = 'Overview';
  let buf = [];
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      if (buf.length > 0) sections[current] = buf.join('\n').trim();
      current = m[1].trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0) sections[current] = buf.join('\n').trim();
  return sections;
}

function extractBulletsFromMarkdown(md = '') {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)/);
    if (m) {
      const cleaned = m[1].replace(/\*\*/g, '').replace(/`/g, '').trim();
      if (cleaned.length >= 6) out.push(cleaned);
    }
  }
  return out;
}

function parseClaudeV3(ds) {
  const manifestPath = join(ds.rootDir, 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  const namespace = manifest.namespace || null;

  const apiTokensPath = join(ds.rootDir, 'api', 'tokens.md');
  const apiTokens = existsSync(apiTokensPath) ? parseTokensFromApiMd(readFileSync(apiTokensPath, 'utf8')) : [];
  const cssTokens = parseTokensFromCss(ds.tokensCss || '');
  const tokens = mergeTokens(apiTokens, cssTokens);

  const components = [];
  const componentDetails = {};
  const dtsPath = join(ds.rootDir, 'components', 'index.d.ts');
  const dtsContent = existsSync(dtsPath) ? readFileSync(dtsPath, 'utf8') : '';

  const manifestComps = Array.isArray(manifest.components) ? manifest.components : [];
  for (const c of manifestComps) {
    const apiMdPath = join(ds.rootDir, 'api', 'components', `${c.name}.md`);
    const readmeMdPath = join(ds.rootDir, 'components', c.name, 'README.md');
    const apiDoc = existsSync(apiMdPath)
      ? readFileSync(apiMdPath, 'utf8')
      : existsSync(readmeMdPath)
        ? readFileSync(readmeMdPath, 'utf8')
        : '';

    const dtsMatch = dtsContent.match(new RegExp(`export\\s+interface\\s+${c.name}Props[\\s\\S]*?\\n\\}`, 'm'));
    components.push({
      name: c.name,
      group: c.group || 'Components',
      summary: c.summary || '',
    });
    componentDetails[c.name] = {
      name: c.name,
      group: c.group || 'Components',
      summary: c.summary || '',
      apiDoc,
      dts: dtsMatch ? dtsMatch[0] : '',
    };
  }

  // Fallback: if manifest.components was empty, scan api/components
  if (components.length === 0 && existsSync(join(ds.rootDir, 'api', 'components'))) {
    for (const file of readdirSync(join(ds.rootDir, 'api', 'components'))) {
      if (!file.endsWith('.md')) continue;
      const name = file.replace(/\.md$/, '');
      const apiDoc = readFileSync(join(ds.rootDir, 'api', 'components', file), 'utf8');
      components.push({ name, group: 'Components', summary: '' });
      componentDetails[name] = { name, group: 'Components', summary: '', apiDoc, dts: '' };
    }
  }

  const assetGroups = [];
  for (const ag of manifest.assetGroups || []) {
    const files = (ag.order || (ag.files || []).map((f) => f.path.split('/').pop())).filter(Boolean);
    const apiAssetPath = join(ds.rootDir, 'api', 'assets', `${ag.name}.md`);
    assetGroups.push({
      name: ag.name,
      count: files.length,
      files,
      apiDoc: existsSync(apiAssetPath) ? readFileSync(apiAssetPath, 'utf8') : '',
    });
  }

  const docsMap = {};
  for (const docName of ['README.md', ...(ds.extraDocs || [])]) {
    const p = join(ds.rootDir, docName);
    if (existsSync(p)) docsMap[docName] = readFileSync(p, 'utf8');
  }

  const sections = splitMarkdownSections(ds.docContent || '');
  const hardRules = [];
  for (const [heading, content] of Object.entries(sections)) {
    if (/规则|禁止|规范|rule|forbid|don't/i.test(heading)) {
      for (const b of extractBulletsFromMarkdown(content)) {
        if (hardRules.length < 10) hardRules.push(b);
      }
    }
  }

  const headLines = [];
  if (ds.hasTokensCss) headLines.push(`<link rel="stylesheet" href="/ds/${ds.id}/tokens.css">`);
  if (existsSync(join(ds.rootDir, 'components', 'bundle.css'))) {
    headLines.push(`<link rel="stylesheet" href="/ds/${ds.id}/components/bundle.css">`);
  }
  for (const lib of manifest.libraries || []) {
    if (lib.file && existsSync(join(ds.rootDir, lib.file))) {
      headLines.push(`<script src="/ds/${ds.id}/${lib.file.replace(/^\/+/, '')}"></script>`);
    }
  }
  if (existsSync(join(ds.rootDir, 'components', 'bundle.js'))) {
    headLines.push(`<script src="/ds/${ds.id}/components/bundle.js"></script>`);
  }

  return {
    namespace,
    libraries: manifest.libraries || [],
    tokens,
    components,
    componentDetails,
    assetGroups,
    docsMap,
    sections,
    hardRules,
    runtimeHeadSnippet: headLines.join('\n'),
  };
}

function parseOpenDesignV1(ds) {
  const tokens = parseTokensFromCss(ds.tokensCss || '');
  const sections = splitMarkdownSections(ds.docContent || '');

  const components = [];
  const componentDetails = {};
  const compKey = Object.keys(sections).find((k) => /component/i.test(k));
  if (compKey) {
    const subParts = sections[compKey].split(/\n(?=###\s+)/);
    for (const part of subParts) {
      const m = part.match(/^###\s+(.+)\n([\s\S]*)/);
      if (m) {
        const name = m[1].trim();
        const body = m[2].trim();
        const firstLine = body.split(/\r?\n/).find((l) => l.trim().startsWith('-')) || body.split(/\r?\n/)[0] || '';
        components.push({
          name,
          group: 'Component Stylings',
          summary: firstLine.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').slice(0, 120),
        });
        componentDetails[name] = {
          name,
          group: 'Component Stylings',
          summary: firstLine.replace(/^[-*]\s*/, '').slice(0, 120),
          apiDoc: `### ${name}\n${body}`,
          dts: '',
        };
      }
    }
  }

  const hardRules = [];
  const dosDontsKey = Object.keys(sections).find((k) => /do'?s\s+and\s+don'?ts|rules/i.test(k));
  if (dosDontsKey) {
    const dontMatch = sections[dosDontsKey].match(/###\s*Don'?t[\s\S]*/i);
    if (dontMatch) {
      for (const b of extractBulletsFromMarkdown(dontMatch[0])) {
        if (hardRules.length < 10) hardRules.push(`Avoid: ${b}`);
      }
    }
    const doMatch = sections[dosDontsKey].match(/###\s*Do\b[\s\S]*?(?=###|$)/i);
    if (doMatch) {
      for (const b of extractBulletsFromMarkdown(doMatch[0])) {
        if (hardRules.length < 10) hardRules.push(`Do: ${b}`);
      }
    }
  }

  const runtimeHeadSnippet = ds.hasTokensCss
    ? `<link rel="stylesheet" href="/ds/${ds.id}/tokens.css">`
    : '';

  return {
    namespace: null,
    libraries: [],
    tokens,
    components,
    componentDetails,
    assetGroups: [],
    docsMap: { [ds.docFile || 'DESIGN.md']: ds.docContent || '' },
    sections,
    hardRules,
    runtimeHeadSnippet,
  };
}

function buildCompactDigest(meta, parsed) {
  const lines = [];
  lines.push(`# [Active Design System] ${meta.name} (id: ${meta.id}, format: ${meta.format})`);
  if (meta.description) lines.push(`> ${meta.description}`);
  lines.push('');

  if (parsed.runtimeHeadSnippet) {
    lines.push('## Runtime & Tokens Link');
    lines.push('```html');
    lines.push(parsed.runtimeHeadSnippet);
    lines.push('```');
    if (parsed.namespace) {
      lines.push(`Global React component namespace: \`window.${parsed.namespace}\` (use real components instead of reinventing CSS clones).`);
    }
    lines.push('');
  }

  // Pick up to 14 key semantic tokens
  const keyTokenPatterns = [
    /^--(surface|bg|background|paper)$/i,
    /^--(surface-1|surface-card|surface-inverse|frame)$/i,
    /^--(on-surface|fg|text|ink|on-surface-muted|muted)$/i,
    /^--(primary|accent|on-primary|accent-on|signature|link)$/i,
    /^--(outline|border|outline-ink|outline-strong)$/i,
    /^--(radius-plate|radius-control|radius-md|radius-pill)$/i,
    /^--(font-display|font-sans|font-body|font-mono)$/i,
  ];
  const pickedTokens = [];
  const seenTok = new Set();
  for (const pat of keyTokenPatterns) {
    for (const t of parsed.tokens) {
      if (pat.test(t.name) && !seenTok.has(t.name)) {
        seenTok.add(t.name);
        pickedTokens.push(t);
      }
    }
  }
  for (const t of parsed.tokens) {
    if (pickedTokens.length >= 14) break;
    if (!seenTok.has(t.name)) {
      seenTok.add(t.name);
      pickedTokens.push(t);
    }
  }
  if (pickedTokens.length > 0) {
    lines.push(`## Key Tokens (${parsed.tokens.length} total)`);
    for (const t of pickedTokens.slice(0, 14)) {
      const val = t.dark ? `${t.light} / dark: ${t.dark}` : t.light;
      lines.push(`- \`${t.name}\`: ${val}${t.usage ? ` — ${t.usage.slice(0, 48)}` : ''}`);
    }
    lines.push('');
  }

  if (parsed.components.length > 0) {
    lines.push(`## Components (${parsed.components.length})`);
    const byGroup = new Map();
    for (const c of parsed.components) {
      const g = c.group || 'Components';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(c.name);
    }
    for (const [grp, names] of byGroup.entries()) {
      lines.push(`- **${grp}**: ${names.join(', ')}`);
    }
    lines.push('');
  }

  if (parsed.hardRules.length > 0) {
    lines.push('## Hard Rules');
    for (const r of parsed.hardRules.slice(0, 6)) {
      lines.push(`- ${r.slice(0, 140)}`);
    }
    lines.push('');
  }

  lines.push('## Fast Workflow');
  lines.push(`- Exact component Props / tokens / SVG names / boilerplate: call \`od_query_system(id="${meta.id}", aspect="component"|"tokens"|"assets"|"rules"|"boilerplate", query="...")\`.`);
  lines.push(`- Build, lint & preview in 1 call: \`od_render(designSystemId="${meta.id}", title="...", type="prototype|dashboard|slides|landing", files|slides=...)\`.`);

  let digest = lines.join('\n');
  if (Buffer.byteLength(digest, 'utf8') > 2800) {
    // Trim cleanly while keeping tail workflow instructions
    const tail = `\n\n## Fast Workflow\n- Query details: \`od_query_system(id="${meta.id}", aspect="component"|"tokens"|"assets"|"rules"|"boilerplate", query="...")\`\n- Render & lint in 1 step: \`od_render(designSystemId="${meta.id}", ...)\``;
    const headBudget = 2750 - Buffer.byteLength(tail, 'utf8');
    const trimmedLines = [];
    let bytes = 0;
    for (const l of lines.slice(0, -3)) {
      const lb = Buffer.byteLength(l + '\n', 'utf8');
      if (bytes + lb > headBudget) break;
      trimmedLines.push(l);
      bytes += lb;
    }
    digest = `${trimmedLines.join('\n')}${tail}`;
  }
  return digest;
}

export function compileDesignSystem(id, { force = false } = {}) {
  const ds = getDesignSystem(id);
  if (!ds) return null;

  const mtimeMs = getSourceMtimeMs(ds);
  const cachePath = getCompiledCachePath(ds.id);
  if (!force && existsSync(cachePath)) {
    try {
      const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
      if (cached && cached.schemaVersion === 2 && cached.mtimeMs === mtimeMs) {
        return cached;
      }
    } catch {
      // rebuild cache
    }
  }

  const parsed = ds.format === 'claude-v3' ? parseClaudeV3(ds) : parseOpenDesignV1(ds);
  const compiled = {
    schemaVersion: 2,
    id: ds.id,
    name: ds.name,
    format: ds.format,
    category: ds.category,
    description: ds.description,
    mtimeMs,
    compiledAt: new Date().toISOString(),
    namespace: parsed.namespace,
    libraries: parsed.libraries,
    runtimeHeadSnippet: parsed.runtimeHeadSnippet,
    tokens: parsed.tokens,
    components: parsed.components,
    componentDetails: parsed.componentDetails,
    assetGroups: parsed.assetGroups,
    sections: parsed.sections,
    docsMap: parsed.docsMap,
    hardRules: parsed.hardRules,
    digest: '',
  };
  compiled.digest = buildCompactDigest(ds, parsed);

  try {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(compiled), 'utf8');
  } catch {
    // cache write failure is non-fatal
  }

  return compiled;
}

export function queryDesignSystem(id, { aspect = 'digest', query = '' } = {}) {
  const compiled = compileDesignSystem(id);
  if (!compiled) return null;

  const q = String(query || '').trim();
  const qLower = q.toLowerCase();

  if (aspect === 'digest') {
    return {
      id: compiled.id,
      name: compiled.name,
      format: compiled.format,
      namespace: compiled.namespace,
      runtimeHeadSnippet: compiled.runtimeHeadSnippet,
      componentCount: compiled.components.length,
      tokenCount: compiled.tokens.length,
      digest: compiled.digest,
    };
  }

  if (aspect === 'component') {
    const terms = q
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const allNames = Object.keys(compiled.componentDetails || {});
    let matchedNames = [];
    if (terms.length === 0) {
      return {
        id: compiled.id,
        format: compiled.format,
        namespace: compiled.namespace,
        components: compiled.components,
      };
    }
    for (const term of terms) {
      const tLow = term.toLowerCase();
      const exact = allNames.find((n) => n.toLowerCase() === tLow);
      if (exact) {
        matchedNames.push(exact);
      } else {
        for (const n of allNames) {
          const det = compiled.componentDetails[n];
          if (
            n.toLowerCase().includes(tLow) ||
            (det?.summary || '').toLowerCase().includes(tLow) ||
            (det?.group || '').toLowerCase().includes(tLow)
          ) {
            matchedNames.push(n);
          }
        }
      }
    }
    matchedNames = [...new Set(matchedNames)].slice(0, 8);
    return {
      id: compiled.id,
      namespace: compiled.namespace,
      matched: matchedNames.map((n) => compiled.componentDetails[n]),
      availableComponents: compiled.components.map((c) => c.name),
    };
  }

  if (aspect === 'tokens') {
    const filtered = qLower
      ? compiled.tokens.filter(
          (t) =>
            t.name.toLowerCase().includes(qLower) ||
            t.group.toLowerCase().includes(qLower) ||
            t.usage.toLowerCase().includes(qLower) ||
            t.light.toLowerCase().includes(qLower),
        )
      : compiled.tokens;
    return {
      id: compiled.id,
      total: compiled.tokens.length,
      count: filtered.length,
      tokens: filtered.slice(0, 120),
    };
  }

  if (aspect === 'assets') {
    const groups = (compiled.assetGroups || []).map((g) => ({
      name: g.name,
      files: qLower ? g.files.filter((f) => f.toLowerCase().includes(qLower)) : g.files,
      apiDoc: g.apiDoc,
    }));
    return {
      id: compiled.id,
      assetGroups: groups,
    };
  }

  if (aspect === 'rules' || aspect === 'voice') {
    const matchedDocs = {};
    for (const [k, v] of Object.entries(compiled.docsMap || {})) {
      if (!qLower || k.toLowerCase().includes(qLower) || v.toLowerCase().includes(qLower)) {
        matchedDocs[k] = v.slice(0, 8000);
      }
    }
    return {
      id: compiled.id,
      hardRules: compiled.hardRules,
      docs: matchedDocs,
    };
  }

  if (aspect === 'boilerplate') {
    const ds = getDesignSystem(id);
    const title = q || `${compiled.name} Prototype`;
    if (compiled.format === 'claude-v3' && compiled.namespace) {
      const ns = compiled.namespace;
      return {
        id: compiled.id,
        format: compiled.format,
        html: `<!doctype html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${compiled.runtimeHeadSnippet}
</head>
<body>
<div id="root"></div>
<script>
(function () {
  var h = React.createElement;
  var NS = window.${ns};
  function App() {
    return h(NS.Page || 'main', {
      paper: 'grid',
      grain: true,
      header: NS.TitleBand ? h(NS.TitleBand, { eyebrow: '${compiled.id.toUpperCase()}', title: '${title}', number: '01' }) : undefined,
      footer: NS.FooterBand ? h(NS.FooterBand, { label: '${compiled.name}' }, '${title}') : undefined
    }, h('div', { style: { padding: '24px' } }, 'Replace with real ${ns} components'));
  }
  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();
</script>
</body>
</html>`,
      };
    }

    return {
      id: compiled.id,
      format: compiled.format,
      html: `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${compiled.runtimeHeadSnippet}
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--surface, var(--bg, ${ds?.swatches?.surface || '#FAFAFA'}));
    color: var(--on-surface, var(--fg, ${ds?.swatches?.onSurface || '#18181B'}));
    font-family: var(--font-sans, var(--font-body, system-ui, sans-serif));
  }
</style>
</head>
<body>
  <main style="max-width: 1120px; margin: 0 auto; padding: 48px 24px;">
    <h1>${title}</h1>
  </main>
</body>
</html>`,
    };
  }

  return {
    id: compiled.id,
    digest: compiled.digest,
  };
}
