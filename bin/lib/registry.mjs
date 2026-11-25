import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

import {
  getState,
  resolveActiveDesignSystem,
} from './state.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = join(__dirname, '..', '..');

export function getDataDir() {
  const dir =
    process.env.OPEN_DESIGN_DATA_DIR ||
    process.env.PLUGIN_DATA ||
    join(homedir(), '.gemini', 'antigravity', 'plugin_data', 'open-design');
  mkdirSync(dir, { recursive: true });
  return dir;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,63}$/i;

export function normalizeSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function extractSwatches(tokensCss = '') {
  const pick = (names) => {
    for (const n of names) {
      const m = tokensCss.match(new RegExp(`--${n}\\s*:\\s*(#[0-9a-fA-F]{3,8})`, 'i'));
      if (m) return m[1];
    }
    return null;
  };
  return {
    surface: pick(['surface', 'bg', 'background', 'paper', 'color-bg']) || '#FAFAFA',
    onSurface: pick(['on-surface', 'foreground', 'text', 'ink', 'color-text']) || '#18181B',
    primary: pick(['primary', 'accent', 'brand', 'color-primary']) || '#2563EB',
    signature: pick(['signature', 'secondary', 'highlight', 'accent-secondary']) || '#0EA5E9',
    frame: pick(['frame', 'surface-inverse', 'ink', 'color-surface-inverse']) || '#18181B',
  };
}

function loadSystemDescriptor(id, rootDir, sourceType) {
  if (!existsSync(rootDir)) return null;
  const manifestPath = join(rootDir, 'manifest.json');
  const dsJsonPath = join(rootDir, 'design-system.json');
  const tokensCssPath = join(rootDir, 'tokens.css');
  const designMdPath = join(rootDir, 'DESIGN.md');
  const readmePath = join(rootDir, 'README.md');

  let manifest = null;
  let dsJson = null;
  try {
    if (existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    // ignore
  }
  try {
    if (existsSync(dsJsonPath)) dsJson = JSON.parse(readFileSync(dsJsonPath, 'utf8'));
  } catch {
    // ignore
  }

  const isClaudeV3 = Boolean(
    manifest?.manifestVersion === 3 ||
      dsJson ||
      existsSync(join(rootDir, 'components', 'bundle.js')),
  );

  const tokensCss = existsSync(tokensCssPath) ? readFileSync(tokensCssPath, 'utf8') : '';
  const name = manifest?.name || dsJson?.title || id;
  const category =
    manifest?.category || (isClaudeV3 ? 'Component Bundle (Claude v3)' : 'Open Design v1');
  const description =
    manifest?.description ||
    dsJson?.lastChange?.note ||
    'Portable design system package';

  return {
    id,
    name,
    category,
    description,
    format: isClaudeV3 ? 'claude-v3' : 'od-v1',
    sourceType,
    pinned: false,
    rootDir,
    hasTokensCss: existsSync(tokensCssPath),
    hasTokensJson: existsSync(join(rootDir, 'tokens.json')),
    hasBundle: existsSync(join(rootDir, 'components', 'bundle.js')),
    hasApiDocs: existsSync(join(rootDir, 'api')),
    docFile: existsSync(designMdPath)
      ? 'DESIGN.md'
      : existsSync(readmePath)
        ? 'README.md'
        : null,
    swatches: extractSwatches(tokensCss),
  };
}

function isDesignSystemDir(dir) {
  return (
    existsSync(dir) &&
    (existsSync(join(dir, 'tokens.css')) ||
      existsSync(join(dir, 'DESIGN.md')) ||
      existsSync(join(dir, 'manifest.json')) ||
      existsSync(join(dir, 'design-system.json')))
  );
}

function discoverPluginDesignSystems() {
  const pluginsRoot = join(homedir(), '.gemini', 'config', 'plugins');
  if (!existsSync(pluginsRoot)) return [];
  const discovered = [];

  for (const pluginEnt of readdirSync(pluginsRoot, { withFileTypes: true })) {
    if (!pluginEnt.isDirectory() || pluginEnt.name === 'open-design') continue;
    const pDir = join(pluginsRoot, pluginEnt.name);
    const candidates = [
      join(pDir, 'design-system'),
      join(pDir, 'resources', 'design-system'),
      pDir,
    ];
    const skillsDir = join(pDir, 'skills');
    if (existsSync(skillsDir)) {
      for (const skEnt of readdirSync(skillsDir, { withFileTypes: true })) {
        if (skEnt.isDirectory()) {
          candidates.push(join(skillsDir, skEnt.name, 'resources', 'project'));
        }
      }
    }

    for (const cand of candidates) {
      if (!isDesignSystemDir(cand) || cand === pDir) continue;
      let rawId = pluginEnt.name;
      try {
        const mf = join(cand, 'manifest.json');
        if (existsSync(mf)) {
          const parsed = JSON.parse(readFileSync(mf, 'utf8'));
          rawId = parsed.id || parsed.name || rawId;
        }
      } catch {
        // ignore
      }
      const id = normalizeSlug(rawId) || normalizeSlug(pluginEnt.name);
      if (!id) continue;
      discovered.push({
        id,
        rootDir: cand,
        sourceType: `plugin:${pluginEnt.name}`,
      });
    }
  }
  return discovered;
}

export function listDesignSystems() {
  const systems = [];
  const seen = new Set();

  // 1. User-installed / imported design systems in DATA_DIR/design-systems
  const userDsRoot = join(getDataDir(), 'design-systems');
  if (existsSync(userDsRoot)) {
    for (const ent of readdirSync(userDsRoot, { withFileTypes: true })) {
      if (!ent.isDirectory() || !SLUG_RE.test(ent.name) || seen.has(ent.name)) continue;
      const desc = loadSystemDescriptor(ent.name, join(userDsRoot, ent.name), 'user');
      if (desc) {
        systems.push(desc);
        seen.add(ent.name);
      }
    }
  }

  // 2. Bundled Open Design systems in PLUGIN_ROOT/resources/design-systems
  const bundledRoot = join(PLUGIN_ROOT, 'resources', 'design-systems');
  if (existsSync(bundledRoot)) {
    for (const ent of readdirSync(bundledRoot, { withFileTypes: true })) {
      if (!ent.isDirectory() || !SLUG_RE.test(ent.name) || seen.has(ent.name)) continue;
      const desc = loadSystemDescriptor(ent.name, join(bundledRoot, ent.name), 'bundled');
      if (desc) {
        systems.push(desc);
        seen.add(ent.name);
      }
    }
  }

  // 3. Sibling Antigravity plugins shipping a design system
  for (const item of discoverPluginDesignSystems()) {
    if (seen.has(item.id)) continue;
    const desc = loadSystemDescriptor(item.id, item.rootDir, item.sourceType);
    if (desc) {
      systems.push(desc);
      seen.add(item.id);
    }
  }

  const resolvedActive = resolveActiveDesignSystem({
    installedIds: systems.map((s) => s.id),
  });
  for (const s of systems) {
    s.active = s.id === resolvedActive.designSystemId;
  }
  return systems;
}

export function getDefaultDesignSystemId(ctx = {}) {
  const systems = listDesignSystems();
  return resolveActiveDesignSystem({
    ...ctx,
    installedIds: systems.map((s) => s.id),
  }).designSystemId;
}

export function getDesignSystem(id) {
  const all = listDesignSystems();
  const found = all.find((s) => s.id === id);
  if (!found) return null;

  const docPath = found.docFile ? join(found.rootDir, found.docFile) : null;
  const docContent = docPath && existsSync(docPath) ? readFileSync(docPath, 'utf8') : '';
  const tokensCss = found.hasTokensCss
    ? readFileSync(join(found.rootDir, 'tokens.css'), 'utf8')
    : '';

  const extraDocs = [];
  for (const ent of readdirSync(found.rootDir, { withFileTypes: true })) {
    if (ent.isFile() && ent.name.endsWith('.md') && ent.name !== found.docFile) {
      extraDocs.push(ent.name);
    }
  }

  let apiComponents = [];
  const apiCompDir = join(found.rootDir, 'api', 'components');
  if (existsSync(apiCompDir)) {
    apiComponents = readdirSync(apiCompDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''));
  }

  return {
    ...found,
    docContent,
    tokensCss,
    extraDocs,
    apiComponents,
  };
}

export function resolveDesignSystemFile(id, relPath) {
  const found = listDesignSystems().find((s) => s.id === id);
  if (!found) return null;
  const cleanRel = String(relPath || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');
  if (!cleanRel || cleanRel.includes('..')) return null;

  const rootResolved = resolve(found.rootDir);
  const full = resolve(rootResolved, cleanRel);
  if (!full.startsWith(rootResolved + sep) && full !== rootResolved) {
    return null;
  }
  if (!existsSync(full) || statSync(full).isDirectory()) return null;
  return full;
}

export async function importDesignSystem(sourcePath, customId) {
  if (!sourcePath || !existsSync(sourcePath)) {
    throw new Error(`Source path not found: ${sourcePath}`);
  }
  const st = statSync(sourcePath);
  const userDsRoot = join(getDataDir(), 'design-systems');
  mkdirSync(userDsRoot, { recursive: true });

  const existingIds = new Set(listDesignSystems().map((s) => s.id));
  let id = normalizeSlug(customId || basename(sourcePath).replace(/\.zip$/i, ''));
  if (!id || (existingIds.has(id) && !customId)) {
    id = normalizeSlug(`${id || 'custom-ds'}-${Date.now().toString(36)}`);
  }
  const destDir = join(userDsRoot, id);

  if (st.isDirectory()) {
    rmSync(destDir, { recursive: true, force: true });
    cpSync(sourcePath, destDir, {
      recursive: true,
      filter: (src) => !src.includes(`${sep}.git`) && !src.includes(`${sep}node_modules`),
    });
  } else if (sourcePath.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(readFileSync(sourcePath));
    const fileEntries = Object.values(zip.files).filter((f) => !f.dir);
    if (fileEntries.length === 0) throw new Error('Zip archive is empty');

    const topSegs = new Set(fileEntries.map((f) => f.name.split('/')[0]));
    const stripPrefix = topSegs.size === 1 && fileEntries.every((f) => f.name.includes('/'))
      ? `${[...topSegs][0]}/`
      : '';

    rmSync(destDir, { recursive: true, force: true });
    mkdirSync(destDir, { recursive: true });

    for (const entry of fileEntries) {
      const rel = stripPrefix ? entry.name.slice(stripPrefix.length) : entry.name;
      if (!rel || rel.includes('..')) continue;
      const outPath = resolve(destDir, rel);
      if (!outPath.startsWith(resolve(destDir) + sep)) continue;
      mkdirSync(dirname(outPath), { recursive: true });
      const buf = await entry.async('nodebuffer');
      writeFileSync(outPath, buf);
    }
  } else {
    throw new Error('Source must be a directory or a .zip archive');
  }

  const manifestPath = join(destDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          schemaVersion: 'od-design-system-project/v1',
          id,
          name: customId || id,
          category: 'Imported',
          description: 'Imported local design system',
          source: { type: 'local', origin: sourcePath },
          files: {
            design: existsSync(join(destDir, 'DESIGN.md'))
              ? 'DESIGN.md'
              : existsSync(join(destDir, 'README.md'))
                ? 'README.md'
                : 'DESIGN.md',
            tokens: 'tokens.css',
          },
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  return loadSystemDescriptor(id, destDir, 'user');
}

export function listUpstreamCatalog() {
  const catPath = join(PLUGIN_ROOT, 'resources', 'upstream-catalog.json');
  const installedIds = new Set(listDesignSystems().map((s) => s.id));
  if (!existsSync(catPath)) return [];
  try {
    const items = JSON.parse(readFileSync(catPath, 'utf8'));
    return items.map((item) => ({
      ...item,
      installed: installedIds.has(item.id) || installedIds.has(item.slug),
    }));
  } catch {
    return [];
  }
}

export function syncUpstreamDesignSystem(slug) {
  if (!SLUG_RE.test(String(slug || ''))) {
    throw new Error(`Invalid design system slug: ${slug}`);
  }
  const cleanSlug = String(slug).trim();
  const userDsRoot = join(getDataDir(), 'design-systems');
  mkdirSync(userDsRoot, { recursive: true });
  const tmpDir = join(getDataDir(), `.tmp-sync-${cleanSlug}-${Date.now()}`);

  try {
    execFileSync(
      'git',
      [
        'clone',
        '--depth',
        '1',
        '--filter=blob:none',
        '--sparse',
        'https://github.com/nexu-io/open-design.git',
        tmpDir,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 },
    );
    execFileSync('git', ['-C', tmpDir, 'sparse-checkout', 'set', `design-systems/${cleanSlug}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });

    const src = join(tmpDir, 'design-systems', cleanSlug);
    if (!existsSync(src)) {
      throw new Error(`Design system "${cleanSlug}" not found in nexu-io/open-design`);
    }
    const dest = join(userDsRoot, cleanSlug);
    rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, { recursive: true });
    return loadSystemDescriptor(cleanSlug, dest, 'upstream-synced');
  } finally {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}
