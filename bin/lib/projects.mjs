import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import {
  getDataDir,
  getDefaultDesignSystemId,
  getDesignSystem,
  normalizeSlug,
} from './registry.mjs';

const ID_RE = /^[a-z0-9][a-z0-9-_]{0,63}$/i;

function assertValidId(id, label = 'id') {
  if (!id || !ID_RE.test(String(id))) {
    throw new Error(`Invalid ${label}: "${id}". Use 1-64 ASCII letters, digits, "-" or "_".`);
  }
}

function getProjectsRoot() {
  const dir = join(getDataDir(), 'projects');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function readJsonSafe(path, fallback = null) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSlidesHtml({ title, designSystemId, slides }) {
  const dsLink = designSystemId
    ? `<link rel="stylesheet" href="/ds/${escHtml(designSystemId)}/tokens.css">`
    : '';
  const total = slides.length;
  const slidesHtml = slides
    .map((sl, idx) => {
      const bullets = Array.isArray(sl.bullets) ? sl.bullets : [];
      const metrics = Array.isArray(sl.metrics) ? sl.metrics : [];
      return `
      <section class="od-slide ${idx === 0 ? 'is-active' : ''}" data-index="${idx}" aria-hidden="${idx === 0 ? 'false' : 'true'}">
        <header class="od-slide__band">
          <div class="od-slide__eyebrow">${escHtml(sl.eyebrow || `SLIDE ${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`)}</div>
          <h1 class="od-slide__title">${escHtml(sl.title || `Slide ${idx + 1}`)}</h1>
        </header>
        <div class="od-slide__body">
          ${sl.body ? `<p class="od-slide__lead">${escHtml(sl.body)}</p>` : ''}
          ${
            metrics.length > 0
              ? `<div class="od-slide__metrics">${metrics
                  .map(
                    (m) => `
                <div class="od-metric">
                  <span class="od-metric__label">${escHtml(m.label)}</span>
                  <strong class="od-metric__val">${escHtml(m.value)}${m.unit ? ` <small>${escHtml(m.unit)}</small>` : ''}</strong>
                </div>`,
                  )
                  .join('')}</div>`
              : ''
          }
          ${
            bullets.length > 0
              ? `<ul class="od-slide__list">${bullets.map((b) => `<li>${escHtml(b)}</li>`).join('')}</ul>`
              : ''
          }
        </div>
        <footer class="od-slide__foot">
          <span>${escHtml(title)}</span>
          <span>${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
        </footer>
      </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(title)}</title>
${dsLink}
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: var(--surface, var(--bg, var(--background, #FAFAFA))); color: var(--on-surface, var(--foreground, var(--text, #18181B))); font-family: var(--font-sans, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif); }
  .od-deck { height: 100vh; display: grid; grid-template-rows: minmax(0, 1fr) 44px; background: var(--surface, var(--bg, #FAFAFA)); }
  .od-stage { position: relative; overflow: hidden; display: grid; place-items: center; padding: 20px; }
  .od-slide {
    display: none; width: min(100%, 1120px); aspect-ratio: 16 / 9; max-height: 100%;
    background: var(--surface-card, var(--card, #FFFFFF)); color: var(--on-surface, var(--foreground, #18181B));
    border: 1px solid var(--outline, var(--border, #E4E4E7)); border-radius: var(--radius-plate, 6px);
    grid-template-rows: auto minmax(0, 1fr) 42px; overflow: hidden;
  }
  .od-slide.is-active { display: grid; }
  .od-slide__band { background: var(--primary, var(--accent, #18181B)); color: var(--on-primary, var(--primary-foreground, #FAFAFA)); padding: 26px 40px 22px; border-bottom: 1px solid var(--outline, #E4E4E7); }
  .od-slide__eyebrow { font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85; margin-bottom: 6px; }
  .od-slide__title { margin: 0; font-family: var(--font-display, Georgia, serif); font-size: clamp(24px, 3vw, 38px); line-height: 1.18; font-weight: 600; }
  .od-slide__body { padding: 28px 40px; display: flex; flex-direction: column; gap: 18px; overflow: auto; }
  .od-slide__lead { margin: 0; font-size: 17px; line-height: 1.7; max-width: 56ch; }
  .od-slide__metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
  .od-metric { padding: 14px 16px; background: var(--surface-1, var(--muted, #F4F4F5)); border: 1px solid var(--outline, var(--border, #E4E4E7)); border-radius: var(--radius-plate, 6px); }
  .od-metric__label { display: block; font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px; color: var(--on-surface-muted, var(--muted-foreground, #71717A)); text-transform: uppercase; letter-spacing: 0.06em; }
  .od-metric__val { display: block; margin-top: 6px; font-family: var(--font-mono, ui-monospace, monospace); font-size: 28px; font-weight: 500; }
  .od-metric__val small { font-size: 14px; font-weight: 400; color: var(--on-surface-muted, #71717A); }
  .od-slide__list { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; font-size: 16px; line-height: 1.65; }
  .od-slide__foot { display: flex; align-items: center; justify-content: space-between; padding: 0 40px; background: var(--frame, var(--surface-inverse, #18181B)); color: var(--on-frame, var(--on-inverse, #FAFAFA)); font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px; letter-spacing: 0.08em; }
  .od-nav { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: var(--frame, #18181B); color: var(--on-frame, #FAFAFA); font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; }
  .od-nav button { background: transparent; color: var(--on-frame, #FAFAFA); border: 1px solid rgba(255, 255, 255, 0.25); padding: 4px 12px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 12px; }
</style>
</head>
<body>
<div class="od-deck">
  <div class="od-stage">${slidesHtml}</div>
  <div class="od-nav">
    <button type="button" id="od-prev">← 上一页</button>
    <span id="od-counter">1 / ${total}</span>
    <button type="button" id="od-next">下一页 →</button>
  </div>
</div>
<script>
  (function() {
    var idx = 0;
    var slides = Array.prototype.slice.call(document.querySelectorAll('.od-slide'));
    var counter = document.getElementById('od-counter');
    function show(n) {
      if (!slides.length) return;
      idx = Math.max(0, Math.min(slides.length - 1, n));
      slides.forEach(function(el, i) {
        el.classList.toggle('is-active', i === idx);
        el.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
      });
      if (counter) counter.textContent = (idx + 1) + ' / ' + slides.length;
    }
    document.getElementById('od-prev').addEventListener('click', function() { show(idx - 1); });
    document.getElementById('od-next').addEventListener('click', function() { show(idx + 1); });
    window.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') show(idx + 1);
      else if (e.key === 'ArrowLeft') show(idx - 1);
    });
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'od-goto-slide') show(Number(e.data.index) || 0);
    });
  })();
</script>
</body>
</html>`;
}

export function listProjects() {
  const root = getProjectsRoot();
  const projects = [];
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory() || !ID_RE.test(ent.name)) continue;
    const meta = readJsonSafe(join(root, ent.name, 'project.json'));
    if (meta) {
      const arts = listArtifacts(ent.name);
      projects.push({ ...meta, artifactCount: arts.length });
    }
  }
  return projects.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export function getProject(projectId) {
  assertValidId(projectId, 'projectId');
  const dir = join(getProjectsRoot(), projectId);
  const meta = readJsonSafe(join(dir, 'project.json'));
  if (!meta) return null;
  return {
    ...meta,
    artifacts: listArtifacts(projectId),
  };
}

export function createProject({ id, name, description = '', designSystemId, brief = null }) {
  const dsId = designSystemId || getDefaultDesignSystemId();
  const root = getProjectsRoot();
  let slug = normalizeSlug(id || name || `project-${Date.now().toString(36)}`);
  if (!slug) slug = `project-${Date.now().toString(36)}`;
  if (existsSync(join(root, slug)) && !id) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }
  assertValidId(slug, 'projectId');

  const now = new Date().toISOString();
  const meta = {
    id: slug,
    name: name || slug,
    description,
    designSystemId: dsId,
    brief,
    createdAt: now,
    updatedAt: now,
  };
  writeJson(join(root, slug, 'project.json'), meta);
  mkdirSync(join(root, slug, 'artifacts'), { recursive: true });
  return { ...meta, artifacts: [] };
}

export function saveProjectBrief(projectId, brief) {
  assertValidId(projectId, 'projectId');
  const pPath = join(getProjectsRoot(), projectId, 'project.json');
  const meta = readJsonSafe(pPath);
  if (!meta) throw new Error(`Project not found: ${projectId}`);
  meta.brief = brief;
  if (brief?.designSystemId) meta.designSystemId = brief.designSystemId;
  meta.updatedAt = new Date().toISOString();
  writeJson(pPath, meta);
  return meta;
}

export function listArtifacts(projectId) {
  assertValidId(projectId, 'projectId');
  const artsDir = join(getProjectsRoot(), projectId, 'artifacts');
  if (!existsSync(artsDir)) return [];
  const items = [];
  for (const ent of readdirSync(artsDir, { withFileTypes: true })) {
    if (!ent.isDirectory() || !ID_RE.test(ent.name)) continue;
    const meta = readJsonSafe(join(artsDir, ent.name, 'artifact.json'));
    if (meta) items.push(meta);
  }
  return items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function writeVersionFiles(artDir, version, files) {
  const vDir = join(artDir, 'versions', `v${version}`);
  mkdirSync(vDir, { recursive: true });
  const written = [];
  for (const [relPath, content] of Object.entries(files)) {
    const cleanRel = String(relPath).replace(/^\/+/, '').replace(/\\/g, '/');
    if (!cleanRel || cleanRel.includes('..')) {
      throw new Error(`Invalid file path in artifact: ${relPath}`);
    }
    const target = resolve(vDir, cleanRel);
    if (!target.startsWith(resolve(vDir) + sep)) {
      throw new Error(`Unsafe file path in artifact: ${relPath}`);
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, String(content), 'utf8');
    written.push(cleanRel);
  }
  return written;
}

export function createArtifact(
  projectId,
  { id, title, type = 'prototype', designSystemId, files = {}, slides = null, note = 'Initial version' },
) {
  assertValidId(projectId, 'projectId');
  const projPath = join(getProjectsRoot(), projectId, 'project.json');
  const proj = readJsonSafe(projPath);
  if (!proj) throw new Error(`Project not found: ${projectId}`);

  const dsId = designSystemId || proj.designSystemId || getDefaultDesignSystemId();
  const artsDir = join(getProjectsRoot(), projectId, 'artifacts');
  let artId = normalizeSlug(id || title || `artifact-${Date.now().toString(36)}`);
  if (!artId) artId = `artifact-${Date.now().toString(36)}`;
  if (existsSync(join(artsDir, artId)) && !id) {
    artId = `${artId}-${Date.now().toString(36).slice(-4)}`;
  }
  assertValidId(artId, 'artifactId');

  const finalFiles = { ...files };
  if (type === 'slides' && Array.isArray(slides) && slides.length > 0) {
    finalFiles['slides.json'] = JSON.stringify(slides, null, 2);
    if (!finalFiles['index.html']) {
      finalFiles['index.html'] = buildSlidesHtml({ title: title || artId, designSystemId: dsId, slides });
    }
  }
  if (!finalFiles['index.html']) {
    throw new Error('Artifact must provide "index.html" in files (or "slides" array for type="slides").');
  }

  const artDir = join(artsDir, artId);
  const fileList = writeVersionFiles(artDir, 1, finalFiles);
  const now = new Date().toISOString();

  const meta = {
    id: artId,
    projectId,
    title: title || artId,
    type,
    designSystemId: dsId,
    currentVersion: 1,
    versions: [{ version: 1, createdAt: now, note, files: fileList }],
    annotations: [],
    createdAt: now,
    updatedAt: now,
  };

  writeJson(join(artDir, 'artifact.json'), meta);
  proj.updatedAt = now;
  writeJson(projPath, proj);
  return getArtifact(projectId, artId, 1);
}

export function updateArtifact(
  projectId,
  artifactId,
  { files = {}, slides = null, note = 'Revision', title, designSystemId },
) {
  assertValidId(projectId, 'projectId');
  assertValidId(artifactId, 'artifactId');
  const artDir = join(getProjectsRoot(), projectId, 'artifacts', artifactId);
  const metaPath = join(artDir, 'artifact.json');
  const meta = readJsonSafe(metaPath);
  if (!meta) throw new Error(`Artifact not found: ${projectId}/${artifactId}`);

  const nextVer = Number(meta.currentVersion || 0) + 1;
  const dsId = designSystemId || meta.designSystemId || getDefaultDesignSystemId();
  const nextTitle = title || meta.title;

  // Carry forward existing files from previous version if partial update
  const prevDir = join(artDir, 'versions', `v${meta.currentVersion}`);
  const mergedFiles = {};
  if (existsSync(prevDir)) {
    for (const prevMetaFile of meta.versions?.find((v) => v.version === meta.currentVersion)?.files || []) {
      const p = join(prevDir, prevMetaFile);
      if (existsSync(p)) mergedFiles[prevMetaFile] = readFileSync(p, 'utf8');
    }
  }
  Object.assign(mergedFiles, files);

  if (meta.type === 'slides' && Array.isArray(slides) && slides.length > 0) {
    mergedFiles['slides.json'] = JSON.stringify(slides, null, 2);
    if (!files['index.html']) {
      mergedFiles['index.html'] = buildSlidesHtml({
        title: nextTitle,
        designSystemId: dsId,
        slides,
      });
    }
  }

  const fileList = writeVersionFiles(artDir, nextVer, mergedFiles);
  const now = new Date().toISOString();

  meta.title = nextTitle;
  meta.designSystemId = dsId;
  meta.currentVersion = nextVer;
  meta.updatedAt = now;
  meta.versions.push({ version: nextVer, createdAt: now, note, files: fileList });
  writeJson(metaPath, meta);

  const projPath = join(getProjectsRoot(), projectId, 'project.json');
  const proj = readJsonSafe(projPath);
  if (proj) {
    proj.updatedAt = now;
    writeJson(projPath, proj);
  }

  return getArtifact(projectId, artifactId, nextVer);
}

export function rollbackArtifact(projectId, artifactId, targetVersion) {
  assertValidId(projectId, 'projectId');
  assertValidId(artifactId, 'artifactId');
  const artDir = join(getProjectsRoot(), projectId, 'artifacts', artifactId);
  const metaPath = join(artDir, 'artifact.json');
  const meta = readJsonSafe(metaPath);
  if (!meta) throw new Error(`Artifact not found: ${projectId}/${artifactId}`);

  const target = meta.versions.find((v) => v.version === Number(targetVersion));
  if (!target) throw new Error(`Version v${targetVersion} not found`);

  meta.currentVersion = target.version;
  meta.updatedAt = new Date().toISOString();
  writeJson(metaPath, meta);
  return getArtifact(projectId, artifactId, target.version);
}

export function getArtifact(projectId, artifactId, version) {
  assertValidId(projectId, 'projectId');
  assertValidId(artifactId, 'artifactId');
  const artDir = join(getProjectsRoot(), projectId, 'artifacts', artifactId);
  const meta = readJsonSafe(join(artDir, 'artifact.json'));
  if (!meta) return null;

  const ver = version ? Number(version) : meta.currentVersion;
  const vDir = join(artDir, 'versions', `v${ver}`);
  const verInfo = meta.versions.find((v) => v.version === ver);
  const files = {};
  if (existsSync(vDir) && verInfo) {
    for (const rel of verInfo.files) {
      const p = join(vDir, rel);
      if (existsSync(p)) files[rel] = readFileSync(p, 'utf8');
    }
  }

  let slides = null;
  if (files['slides.json']) {
    try {
      slides = JSON.parse(files['slides.json']);
    } catch {
      slides = null;
    }
  }

  return {
    ...meta,
    activeVersion: ver,
    files,
    slides,
  };
}

export function addAnnotation(projectId, artifactId, { target = 'General', text }) {
  assertValidId(projectId, 'projectId');
  assertValidId(artifactId, 'artifactId');
  const metaPath = join(getProjectsRoot(), projectId, 'artifacts', artifactId, 'artifact.json');
  const meta = readJsonSafe(metaPath);
  if (!meta) throw new Error(`Artifact not found: ${projectId}/${artifactId}`);

  const item = {
    id: `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    target,
    text: String(text || '').trim(),
    resolved: false,
    createdAt: new Date().toISOString(),
  };
  meta.annotations = meta.annotations || [];
  meta.annotations.push(item);
  meta.updatedAt = item.createdAt;
  writeJson(metaPath, meta);
  return meta.annotations;
}

export function resolveAnnotation(projectId, artifactId, annotationId, resolved = true) {
  assertValidId(projectId, 'projectId');
  assertValidId(artifactId, 'artifactId');
  const metaPath = join(getProjectsRoot(), projectId, 'artifacts', artifactId, 'artifact.json');
  const meta = readJsonSafe(metaPath);
  if (!meta) throw new Error(`Artifact not found: ${projectId}/${artifactId}`);
  for (const ann of meta.annotations || []) {
    if (ann.id === annotationId) ann.resolved = resolved;
  }
  writeJson(metaPath, meta);
  return meta.annotations || [];
}

export function resolveArtifactFile(projectId, artifactId, version, relPath) {
  assertValidId(projectId, 'projectId');
  assertValidId(artifactId, 'artifactId');
  const ver = Number(version);
  if (!Number.isInteger(ver) || ver < 1) return null;
  const cleanRel = String(relPath || 'index.html').replace(/^\/+/, '').replace(/\\/g, '/');
  if (!cleanRel || cleanRel.includes('..')) return null;

  const vDir = resolve(getProjectsRoot(), projectId, 'artifacts', artifactId, 'versions', `v${ver}`);
  const full = resolve(vDir, cleanRel);
  if (!full.startsWith(vDir + sep) && full !== vDir) return null;
  if (!existsSync(full) || statSync(full).isDirectory()) return null;
  return full;
}

export function createStarterProject(requestedDsId) {
  const dsId = requestedDsId || getDefaultDesignSystemId();
  const ds = getDesignSystem(dsId);
  const dsName = ds?.name || dsId;
  const sw = ds?.swatches || {
    surface: '#FAFAFA',
    onSurface: '#18181B',
    primary: '#2563EB',
    signature: '#0EA5E9',
    frame: '#18181B',
  };

  const proj = createProject({
    name: `${dsName} · 工作台示例`,
    description: `基于设计系统「${dsName}」生成的通用工作台与令牌预览示例。`,
    designSystemId: dsId,
    brief: {
      title: `${dsName} 界面试样`,
      type: 'dashboard',
      designSystemId: dsId,
      audience: '产品与研发团队',
      density: 60,
      variance: 35,
      notes: '展示所选设计系统的色彩变量、排版层级、卡片布局与交互状态。',
    },
  });

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(dsName)} · Studio Showcase</title>
${ds?.hasTokensCss ? `<link rel="stylesheet" href="/ds/${escHtml(dsId)}/tokens.css">` : ''}
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--surface, var(--bg, ${sw.surface}));
    color: var(--on-surface, var(--foreground, ${sw.onSurface}));
    font-family: var(--font-sans, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif);
    line-height: 1.6;
  }
  .wrap { max-width: 1120px; margin: 0 auto; min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto; border-inline: 1px solid var(--outline, rgba(128,128,128,0.22)); }
  .hero { background: var(--primary, ${sw.primary}); color: var(--on-primary, #FFFFFF); padding: 32px 40px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 20px; }
  .eyebrow { font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; letter-spacing: 0.08em; opacity: 0.85; text-transform: uppercase; margin-bottom: 6px; }
  .hero h1 { margin: 0; font-family: var(--font-display, Georgia, serif); font-size: clamp(24px, 3vw, 38px); font-weight: 600; line-height: 1.18; }
  .badge { font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; padding: 5px 10px; border: 1px solid currentColor; border-radius: var(--radius-control, 4px); }
  .content { padding: 32px 40px; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; align-content: start; }
  .card { background: var(--surface-card, var(--surface-1, #FFFFFF)); border: 1px solid var(--outline, rgba(128,128,128,0.25)); border-radius: var(--radius-plate, 6px); padding: 20px; display: flex; flex-direction: column; gap: 10px; }
  .card__meta { font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px; color: var(--on-surface-muted, #71717A); display: flex; justify-content: space-between; }
  .card h2 { margin: 0; font-family: var(--font-serif, var(--font-display, inherit)); font-size: 20px; }
  .card p { margin: 0; font-size: 14px; color: var(--on-surface-muted, #71717A); }
  .swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 4px; }
  .swatch { height: 28px; border-radius: 3px; border: 1px solid var(--outline, rgba(128,128,128,0.3)); }
  .metric-val { font-family: var(--font-mono, ui-monospace, monospace); font-size: 32px; font-weight: 600; color: var(--on-surface, ${sw.onSurface}); }
  .actions { display: flex; gap: 10px; margin-top: 6px; }
  .btn { padding: 8px 14px; border-radius: var(--radius-control, 4px); border: 1px solid var(--outline-strong, var(--outline, #888)); background: transparent; color: inherit; cursor: pointer; font-size: 13px; font-weight: 500; }
  .btn--primary { background: var(--primary, ${sw.primary}); color: var(--on-primary, #FFFFFF); border-color: transparent; }
  .foot { background: var(--frame, var(--surface-inverse, ${sw.frame})); color: var(--on-frame, #FAFAFA); padding: 14px 40px; display: flex; justify-content: space-between; font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px; }
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <div>
      <div class="eyebrow">OPEN DESIGN STUDIO · ${escHtml(ds?.format || 'od-v1')}</div>
      <h1>${escHtml(dsName)} · 设计系统实时试样</h1>
    </div>
    <span class="badge">${escHtml(dsId)}</span>
  </header>
  <main class="content">
    <section class="card">
      <div class="card__meta"><span>TOKENS · PALETTE</span><span>LIVE</span></div>
      <h2>语义色板与对比度</h2>
      <p>当前画布直接挂载 <code>/ds/${escHtml(dsId)}/tokens.css</code>，所有卡片、边框与按钮均通过 CSS 变量响应。</p>
      <div class="swatches">
        <div class="swatch" style="background:var(--surface, ${sw.surface})" title="surface"></div>
        <div class="swatch" style="background:var(--primary, ${sw.primary})" title="primary"></div>
        <div class="swatch" style="background:var(--signature, ${sw.signature})" title="signature"></div>
        <div class="swatch" style="background:var(--frame, ${sw.frame})" title="frame"></div>
      </div>
    </section>
    <section class="card">
      <div class="card__meta"><span>METRICS · TYPOGRAPHY</span><span>16:9 / WEB</span></div>
      <h2>关键指标与等宽读数</h2>
      <div class="metric-val">98.4%</div>
      <p>通过左侧「规范体检」可即时检查 Anti-AI-Slop 与当前设计系统的合规状态，或点击上方导出 HTML / ZIP / PPTX。</p>
      <div class="actions">
        <button class="btn btn--primary" type="button" onclick="this.textContent='已确认'">确认方案</button>
        <button class="btn" type="button">查看细节</button>
      </div>
    </section>
  </main>
  <footer class="foot">
    <span>DESIGN SYSTEM: ${escHtml(dsId)}</span>
    <span>OPEN DESIGN STUDIO</span>
  </footer>
</div>
</body>
</html>`;

  const artifact = createArtifact(proj.id, {
    title: `${dsName} 试样页`,
    type: 'dashboard',
    designSystemId: dsId,
    files: { 'index.html': html },
    note: `基于 ${dsId} 生成的通用示例`,
  });

  return { project: getProject(proj.id), artifact };
}
