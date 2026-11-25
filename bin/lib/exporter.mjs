import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import JSZip from 'jszip';
import PptxGenJSImport from 'pptxgenjs';
import { getArtifact } from './projects.mjs';
import { getDefaultDesignSystemId, getDesignSystem, resolveDesignSystemFile } from './registry.mjs';

const PptxGenJS = PptxGenJSImport.default || PptxGenJSImport;

export function getDefaultExportDir() {
  const dir = join(homedir(), '.gemini', 'antigravity', 'scratch', 'open-design-exports');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function safeScriptInline(js) {
  return String(js || '').replace(/<\/script/gi, '<\\/script');
}

function addDirToZip(zipFolder, diskDir, skipNames = new Set(['node_modules', '.git'])) {
  for (const ent of readdirSync(diskDir, { withFileTypes: true })) {
    if (skipNames.has(ent.name)) continue;
    const full = join(diskDir, ent.name);
    if (ent.isDirectory()) {
      addDirToZip(zipFolder.folder(ent.name), full, skipNames);
    } else {
      zipFolder.file(ent.name, readFileSync(full));
    }
  }
}

function extractPaletteFromTokens(tokensCss = '') {
  const pick = (names, fallback) => {
    for (const n of names) {
      const m = tokensCss.match(new RegExp(`--${n}\\s*:\\s*(#[0-9a-fA-F]{6})`, 'i'));
      if (m) return m[1].replace('#', '').toUpperCase();
    }
    return fallback.replace('#', '').toUpperCase();
  };
  return {
    surface: pick(['surface', 'bg', 'background', 'paper'], '#FAFAFA'),
    surface1: pick(['surface-1', 'muted'], '#F4F4F5'),
    surfaceCard: pick(['surface-card', 'card'], '#FFFFFF'),
    onSurface: pick(['on-surface', 'foreground', 'text', 'ink'], '#18181B'),
    muted: pick(['on-surface-muted', 'muted-foreground'], '#71717A'),
    primary: pick(['primary', 'accent', 'brand'], '#18181B'),
    onPrimary: pick(['on-primary', 'primary-foreground'], '#FAFAFA'),
    signature: pick(['signature', 'secondary', 'highlight'], '#3B82F6'),
    frame: pick(['frame', 'surface-inverse', 'ink'], '#18181B'),
    onFrame: pick(['on-frame', 'on-inverse'], '#FAFAFA'),
    onFrameAccent: pick(['on-frame-accent', 'on-inverse-accent'], '#60A5FA'),
    outline: pick(['outline', 'border'], '#E4E4E7'),
  };
}

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSlidesFromHtml(html) {
  const sections = [...html.matchAll(/<section[^>]*>([\s\S]*?)<\/section>/gi)];
  if (sections.length === 0) {
    const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
    return [
      {
        title: titleM ? stripTags(titleM[1]) : 'Design Overview',
        body: paras.slice(0, 3).join('\n'),
        bullets: [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => stripTags(m[1])).slice(0, 6),
      },
    ];
  }
  return sections.map((sec, idx) => {
    const inner = sec[1];
    const h1 = inner.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
    const eyebrow = inner.match(/class="[^"]*eyebrow[^"]*"[^>]*>([\s\S]*?)<\//i);
    const p = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const bullets = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => stripTags(m[1]));
    return {
      eyebrow: eyebrow ? stripTags(eyebrow[1]) : `SLIDE ${String(idx + 1).padStart(2, '0')}`,
      title: h1 ? stripTags(h1[1]) : `Slide ${idx + 1}`,
      body: p ? stripTags(p[1]) : '',
      bullets,
    };
  });
}

export async function exportArtifact({
  projectId,
  artifactId,
  version,
  format = 'html',
  outputDir,
}) {
  const artifact = getArtifact(projectId, artifactId, version);
  if (!artifact) {
    throw new Error(`Artifact not found: ${projectId}/${artifactId}`);
  }
  const destDir = outputDir || getDefaultExportDir();
  mkdirSync(destDir, { recursive: true });

  const baseName = `${artifact.id}-v${artifact.activeVersion}`;
  const dsId = artifact.designSystemId || getDefaultDesignSystemId();
  const ds = getDesignSystem(dsId);

  if (format === 'html') {
    let html = artifact.files['index.html'] || '';
    // Inline /ds/<id>/... stylesheets and scripts
    html = html.replace(
      /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
      (full, href) => {
        const dsMatch = href.match(/^\/ds\/([^/]+)\/(.+)$/);
        if (dsMatch) {
          const f = resolveDesignSystemFile(dsMatch[1], dsMatch[2]);
          if (f) return `<style>\n${readFileSync(f, 'utf8')}\n</style>`;
        } else if (artifact.files[href.replace(/^\.\//, '')]) {
          return `<style>\n${artifact.files[href.replace(/^\.\//, '')]}\n</style>`;
        }
        return full;
      },
    );
    html = html.replace(
      /<script\s+[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi,
      (full, src) => {
        const dsMatch = src.match(/^\/ds\/([^/]+)\/(.+)$/);
        if (dsMatch) {
          const f = resolveDesignSystemFile(dsMatch[1], dsMatch[2]);
          if (f) return `<script>\n${safeScriptInline(readFileSync(f, 'utf8'))}\n</script>`;
        } else if (artifact.files[src.replace(/^\.\//, '')]) {
          return `<script>\n${safeScriptInline(artifact.files[src.replace(/^\.\//, '')])}\n</script>`;
        }
        return full;
      },
    );

    const outPath = join(destDir, `${baseName}.html`);
    writeFileSync(outPath, html, 'utf8');
    return { format: 'html', outputPath: outPath, bytes: Buffer.byteLength(html, 'utf8') };
  }

  if (format === 'zip') {
    const zip = new JSZip();
    for (const [rel, content] of Object.entries(artifact.files)) {
      let out = content;
      if (rel.endsWith('.html') || rel.endsWith('.css')) {
        out = out.replace(/\/ds\/([a-z0-9-_]+)\//gi, './ds/$1/');
      }
      zip.file(rel, out);
    }
    if (ds && existsSync(ds.rootDir)) {
      const dsFolder = zip.folder('ds').folder(ds.id);
      if (ds.hasTokensCss) dsFolder.file('tokens.css', readFileSync(join(ds.rootDir, 'tokens.css')));
      if (ds.hasBundle && existsSync(join(ds.rootDir, 'components'))) {
        addDirToZip(dsFolder.folder('components'), join(ds.rootDir, 'components'));
      }
      if (existsSync(join(ds.rootDir, 'fonts'))) {
        addDirToZip(dsFolder.folder('fonts'), join(ds.rootDir, 'fonts'));
      }
      if (existsSync(join(ds.rootDir, 'assets'))) {
        addDirToZip(dsFolder.folder('assets'), join(ds.rootDir, 'assets'));
      }
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const outPath = join(destDir, `${baseName}.zip`);
    writeFileSync(outPath, buf);
    return { format: 'zip', outputPath: outPath, bytes: buf.length };
  }

  if (format === 'pptx') {
    const palette = extractPaletteFromTokens(ds?.tokensCss || '');
    const slides =
      Array.isArray(artifact.slides) && artifact.slides.length > 0
        ? artifact.slides
        : parseSlidesFromHtml(artifact.files['index.html'] || '');

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
    pptx.title = artifact.title;
    pptx.subject = `Generated with ${ds?.name || dsId} via Open Design Studio`;

    slides.forEach((sl, idx) => {
      const slide = pptx.addSlide();
      slide.background = { color: palette.surface };

      // Top primary header band
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 13.333,
        h: 1.55,
        fill: { color: palette.primary },
        line: { color: palette.onPrimary, width: 1 },
      });

      const eyebrow = sl.eyebrow || `SLIDE ${String(idx + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
      slide.addText(eyebrow.toUpperCase(), {
        x: 0.65,
        y: 0.22,
        w: 12.0,
        h: 0.3,
        fontFace: 'IBM Plex Mono',
        fontSize: 11,
        color: palette.onPrimary,
        bold: true,
      });

      slide.addText(String(sl.title || `Slide ${idx + 1}`), {
        x: 0.65,
        y: 0.55,
        w: 12.0,
        h: 0.8,
        fontFace: 'Microsoft YaHei',
        fontSize: 28,
        color: palette.onPrimary,
        bold: true,
      });

      let cursorY = 1.95;

      if (sl.body) {
        slide.addText(String(sl.body), {
          x: 0.65,
          y: cursorY,
          w: 12.0,
          h: 1.1,
          fontFace: 'Microsoft YaHei',
          fontSize: 16,
          color: palette.onSurface,
          valign: 'top',
        });
        cursorY += 1.25;
      }

      const metrics = Array.isArray(sl.metrics) ? sl.metrics : [];
      if (metrics.length > 0) {
        const count = Math.min(metrics.length, 4);
        const gap = 0.25;
        const cardW = (12.0 - gap * (count - 1)) / count;
        metrics.slice(0, 4).forEach((m, mi) => {
          const cx = 0.65 + mi * (cardW + gap);
          slide.addShape(pptx.ShapeType.rect, {
            x: cx,
            y: cursorY,
            w: cardW,
            h: 1.35,
            fill: { color: palette.surfaceCard },
            line: { color: palette.outline, width: 1 },
          });
          slide.addText(String(m.label || ''), {
            x: cx + 0.18,
            y: cursorY + 0.16,
            w: cardW - 0.36,
            h: 0.3,
            fontFace: 'IBM Plex Mono',
            fontSize: 10,
            color: palette.muted,
          });
          slide.addText(`${m.value ?? ''}${m.unit ? ` ${m.unit}` : ''}`, {
            x: cx + 0.18,
            y: cursorY + 0.52,
            w: cardW - 0.36,
            h: 0.65,
            fontFace: 'IBM Plex Mono',
            fontSize: 24,
            color: palette.onSurface,
            bold: true,
          });
        });
        cursorY += 1.6;
      }

      const bullets = Array.isArray(sl.bullets) ? sl.bullets : [];
      if (bullets.length > 0) {
        slide.addText(
          bullets.map((b) => ({ text: String(b), options: { bullet: true, breakLine: true } })),
          {
            x: 0.65,
            y: cursorY,
            w: 12.0,
            h: Math.max(1.2, 6.6 - cursorY),
            fontFace: 'Microsoft YaHei',
            fontSize: 15,
            color: palette.onSurface,
            valign: 'top',
            paraSpaceAfter: 8,
          },
        );
      }

      // Bottom frame bar
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 6.95,
        w: 13.333,
        h: 0.55,
        fill: { color: palette.frame },
      });
      slide.addText(`${artifact.title} · ${ds?.name || dsId}`, {
        x: 0.65,
        y: 7.05,
        w: 9.0,
        h: 0.35,
        fontFace: 'IBM Plex Mono',
        fontSize: 10,
        color: palette.onFrame,
      });
      slide.addText(`${String(idx + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`, {
        x: 10.5,
        y: 7.05,
        w: 2.18,
        h: 0.35,
        align: 'right',
        fontFace: 'IBM Plex Mono',
        fontSize: 10,
        color: palette.onFrameAccent,
      });

      if (sl.notes) {
        slide.addNotes(String(sl.notes));
      }
    });

    const outPath = join(destDir, `${baseName}.pptx`);
    await pptx.writeFile({ fileName: outPath });
    const statBytes = readFileSync(outPath).length;
    return { format: 'pptx', outputPath: outPath, bytes: statBytes, slideCount: slides.length };
  }

  throw new Error(`Unsupported export format: ${format}`);
}

export async function exportDesignSystemPackage(designSystemId, outputDir) {
  const ds = getDesignSystem(designSystemId);
  if (!ds) throw new Error(`Design system not found: ${designSystemId}`);
  const destDir = outputDir || getDefaultExportDir();
  mkdirSync(destDir, { recursive: true });

  const zip = new JSZip();
  const root = zip.folder(ds.id);
  root.file(
    'manifest.json',
    JSON.stringify(
      {
        schemaVersion: 'od-design-system-project/v1',
        id: ds.id,
        name: ds.name,
        category: ds.category,
        description: ds.description,
        source: { type: ds.sourceType, origin: basename(ds.rootDir) },
        files: { design: 'DESIGN.md', tokens: 'tokens.css' },
      },
      null,
      2,
    ),
  );
  root.file('DESIGN.md', ds.docContent || `# ${ds.name}\n`);
  root.file('tokens.css', ds.tokensCss || '');

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const outPath = join(destDir, `${ds.id}-od-v1.zip`);
  writeFileSync(outPath, buf);
  return { format: 'design-system', outputPath: outPath, bytes: buf.length };
}
