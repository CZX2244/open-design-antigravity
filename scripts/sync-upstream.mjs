import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..');
const RESOURCES_DIR = join(PLUGIN_ROOT, 'resources');
const UPSTREAM_DIR = join(RESOURCES_DIR, 'upstream');
const BUNDLED_DS_DIR = join(RESOURCES_DIR, 'design-systems');
const TMP_CLONE = join(PLUGIN_ROOT, '.tmp-open-design');

const REPO_URL = 'https://github.com/nexu-io/open-design.git';

function runGit(args, cwd = PLUGIN_ROOT) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 90_000,
  });
}

function writeFallbackAssets() {
  mkdirSync(join(UPSTREAM_DIR, 'craft'), { recursive: true });
  mkdirSync(join(UPSTREAM_DIR, 'skills'), { recursive: true });
  mkdirSync(BUNDLED_DS_DIR, { recursive: true });

  const antiSlopPath = join(UPSTREAM_DIR, 'craft', 'anti-ai-slop.md');
  if (!existsSync(antiSlopPath)) {
    writeFileSync(
      antiSlopPath,
      `# Anti-AI-Slop Craft Rules

1. **Hierarchy & Typography**: Establish clear typographic scale; never let headings, labels, and body sit at indistinguishable weights/sizes.
2. **Color Discipline**: Bind surfaces, ink, borders, and accents to CSS custom properties in \`tokens.css\`. Avoid default purple-indigo neon gradients and uncalibrated glowing shadows.
3. **No Emoji Chrome**: Keep icons intentional (SVG); do not scatter Unicode emojis across navigation, buttons, or metric cards.
4. **Real Copy Only**: Replace \`Lorem ipsum\`, \`Acme Corp\`, and \`TBD\` with domain-authentic copy and real units.
5. **Accessibility & Responsiveness**: Include \`<!doctype html>\`, \`lang\`, viewport meta, semantic landmarks, and ≥ 4.5:1 contrast.
`,
      'utf8',
    );
  }

  const catalogPath = join(RESOURCES_DIR, 'upstream-catalog.json');
  if (!existsSync(catalogPath)) {
    writeFileSync(catalogPath, '[]\n', 'utf8');
  }

  // Built-in starter v1 systems so Studio always ships with OD v1 examples even offline
  const starters = [
    {
      id: 'editorial-paper',
      name: 'Editorial Paper',
      category: 'Editorial & Publishing',
      description: 'Warm archival paper with crisp serif headlines and structured tabular metadata.',
      tokens: `:root, [data-theme="light"] {\n  --surface: #FBF9F4;\n  --surface-1: #F2EFE6;\n  --surface-card: #FFFFFF;\n  --on-surface: #171614;\n  --on-surface-muted: #66635B;\n  --outline: #D6D0C4;\n  --outline-ink: #171614;\n  --primary: #1F4E5F;\n  --on-primary: #FBF9F4;\n  --signature: #C85A32;\n  --frame: #171614;\n  --on-frame: #FBF9F4;\n  --font-display: Georgia, "Noto Serif SC", serif;\n  --font-sans: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;\n  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n[data-theme="dark"] {\n  --surface: #1C1B19;\n  --surface-1: #252320;\n  --surface-card: #2D2B27;\n  --on-surface: #F4F1EA;\n  --on-surface-muted: #B0AAA0;\n  --outline: #403D37;\n  --outline-ink: #F4F1EA;\n}\n`,
    },
    {
      id: 'instrument-mono',
      name: 'Instrument Mono',
      category: 'Developer & Telemetry',
      description: 'Precision technical interface built on strict hairline grids and tabular monospace numerals.',
      tokens: `:root, [data-theme="light"] {\n  --surface: #F7F8FA;\n  --surface-1: #ECEEF2;\n  --surface-card: #FFFFFF;\n  --on-surface: #111317;\n  --on-surface-muted: #5A6170;\n  --outline: #D1D6E0;\n  --outline-ink: #111317;\n  --primary: #0F62FE;\n  --on-primary: #FFFFFF;\n  --signature: #FF6B2C;\n  --frame: #111317;\n  --on-frame: #F7F8FA;\n  --font-display: system-ui, -apple-system, "PingFang SC", sans-serif;\n  --font-sans: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;\n  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n[data-theme="dark"] {\n  --surface: #111317;\n  --surface-1: #181B21;\n  --surface-card: #1E222A;\n  --on-surface: #F2F4F8;\n  --on-surface-muted: #9AA2B2;\n  --outline: #2F3542;\n  --outline-ink: #F2F4F8;\n}\n`,
    },
  ];

  for (const st of starters) {
    const dir = join(BUNDLED_DS_DIR, st.id);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'manifest.json'),
        JSON.stringify(
          {
            schemaVersion: 'od-design-system-project/v1',
            id: st.id,
            name: st.name,
            category: st.category,
            description: st.description,
            source: { type: 'bundled', origin: 'Open Design Studio fallback starter' },
            files: { design: 'DESIGN.md', tokens: 'tokens.css' },
          },
          null,
          2,
        ),
        'utf8',
      );
      writeFileSync(
        join(dir, 'DESIGN.md'),
        `# ${st.name}\n\n${st.description}\n\n## Rules\n- Use tokens from \`tokens.css\` strictly.\n- Maintain clear visual hierarchy and ≥ 4.5:1 contrast.\n`,
        'utf8',
      );
      writeFileSync(join(dir, 'tokens.css'), st.tokens, 'utf8');
    }
  }
}

try {
  if (existsSync(TMP_CLONE)) {
    rmSync(TMP_CLONE, { recursive: true, force: true });
  }

  console.log(`Cloning tree index from ${REPO_URL}...`);
  runGit(['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', REPO_URL, TMP_CLONE]);

  const treeOutput = runGit(['ls-tree', '-r', '--name-only', 'HEAD'], TMP_CLONE);
  const allFiles = treeOutput.split(/\r?\n/).filter(Boolean);

  const craftFiles = allFiles.filter((p) => p.startsWith('craft/'));
  const skillFiles = allFiles.filter(
    (p) => p.startsWith('skills/') || p.startsWith('plugins/_official/examples/'),
  );
  const manifestFiles = allFiles.filter((p) => /^design-systems\/[^/]+\/manifest\.json$/.test(p));

  const initialCheckoutPaths = [
    ...craftFiles,
    ...skillFiles,
    ...manifestFiles,
    ...(allFiles.includes('docs/skills-protocol.md') ? ['docs/skills-protocol.md'] : []),
  ];

  if (initialCheckoutPaths.length > 0) {
    // Write sparse-checkout file directly to avoid command-line length limits on Windows
    const sparseFile = join(TMP_CLONE, '.git', 'info', 'sparse-checkout');
    mkdirSync(dirname(sparseFile), { recursive: true });
    writeFileSync(sparseFile, initialCheckoutPaths.map((p) => `/${p}`).join('\n') + '\n', 'utf8');
    runGit(['config', 'core.sparseCheckout', 'true'], TMP_CLONE);
    runGit(['config', 'core.sparseCheckoutCone', 'false'], TMP_CLONE);
    runGit(['checkout', 'HEAD'], TMP_CLONE);
  }

  // 1. Copy craft/ & skills/
  rmSync(UPSTREAM_DIR, { recursive: true, force: true });
  mkdirSync(join(UPSTREAM_DIR, 'craft'), { recursive: true });
  mkdirSync(join(UPSTREAM_DIR, 'skills'), { recursive: true });

  if (existsSync(join(TMP_CLONE, 'craft'))) {
    cpSync(join(TMP_CLONE, 'craft'), join(UPSTREAM_DIR, 'craft'), { recursive: true });
  }
  if (existsSync(join(TMP_CLONE, 'skills'))) {
    cpSync(join(TMP_CLONE, 'skills'), join(UPSTREAM_DIR, 'skills'), { recursive: true });
  }
  if (existsSync(join(TMP_CLONE, 'plugins', '_official', 'examples'))) {
    cpSync(
      join(TMP_CLONE, 'plugins', '_official', 'examples'),
      join(UPSTREAM_DIR, 'skills', '_examples'),
      { recursive: true },
    );
  }
  if (existsSync(join(TMP_CLONE, 'docs', 'skills-protocol.md'))) {
    cpSync(
      join(TMP_CLONE, 'docs', 'skills-protocol.md'),
      join(UPSTREAM_DIR, 'skills-protocol.md'),
    );
  }

  // 2. Build upstream catalog from all manifest.json files
  const catalog = [];
  for (const mf of manifestFiles) {
    const full = join(TMP_CLONE, mf);
    if (!existsSync(full)) continue;
    try {
      const parsed = JSON.parse(readFileSync(full, 'utf8'));
      const slug = mf.split('/')[1];
      catalog.push({
        id: parsed.id || slug,
        slug,
        name: parsed.name || slug,
        category: parsed.category || 'General',
        description: parsed.description || '',
        schemaVersion: parsed.schemaVersion || 'od-design-system-project/v1',
        path: `design-systems/${slug}`,
      });
    } catch {
      // skip malformed manifest
    }
  }
  catalog.sort((a, b) => a.name.localeCompare(b.name));
  mkdirSync(RESOURCES_DIR, { recursive: true });
  writeFileSync(join(RESOURCES_DIR, 'upstream-catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');

  // 3. Pick 8 diverse curated design systems to bundle offline
  const picked = [];
  const seenCategories = new Set();
  for (const item of catalog) {
    if (picked.length >= 8) break;
    if (!seenCategories.has(item.category)) {
      seenCategories.add(item.category);
      picked.push(item);
    }
  }
  for (const item of catalog) {
    if (picked.length >= 8) break;
    if (!picked.some((p) => p.slug === item.slug)) picked.push(item);
  }

  if (picked.length > 0) {
    const dsCheckoutPaths = [];
    for (const item of picked) {
      const prefix = `design-systems/${item.slug}/`;
      for (const f of allFiles) {
        if (f.startsWith(prefix)) dsCheckoutPaths.push(f);
      }
    }
    const sparseFile = join(TMP_CLONE, '.git', 'info', 'sparse-checkout');
    writeFileSync(sparseFile, dsCheckoutPaths.map((p) => `/${p}`).join('\n') + '\n', 'utf8');
    runGit(['checkout', 'HEAD'], TMP_CLONE);

    rmSync(BUNDLED_DS_DIR, { recursive: true, force: true });
    mkdirSync(BUNDLED_DS_DIR, { recursive: true });
    for (const item of picked) {
      const src = join(TMP_CLONE, 'design-systems', item.slug);
      if (existsSync(src)) {
        cpSync(src, join(BUNDLED_DS_DIR, item.slug), { recursive: true });
      }
    }
  }

  rmSync(TMP_CLONE, { recursive: true, force: true });

  const craftCount = existsSync(join(UPSTREAM_DIR, 'craft'))
    ? readdirSync(join(UPSTREAM_DIR, 'craft'), { recursive: true }).length
    : 0;
  const bundledCount = existsSync(BUNDLED_DS_DIR)
    ? readdirSync(BUNDLED_DS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).length
    : 0;

  console.log(
    `Upstream sync complete: craft=${craftCount} files, catalog=${catalog.length} systems, bundled=${bundledCount} systems.`,
  );
  // Ensure fallback anti-ai-slop exists if upstream repo changed path
  writeFallbackAssets();
} catch (err) {
  console.warn(`Upstream sync failed (${err instanceof Error ? err.message : String(err)}); using built-in fallbacks.`);
  if (existsSync(TMP_CLONE)) {
    try {
      rmSync(TMP_CLONE, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
  writeFallbackAssets();
}
