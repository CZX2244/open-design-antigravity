import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { compileDesignSystem } from './compiler.mjs';
import { lintArtifact } from './linter.mjs';
import { getArtifact } from './projects.mjs';
import { getDefaultDesignSystemId, getDesignSystem } from './registry.mjs';
import { writeWorkspaceBinding } from './state.mjs';

const LINT_EXTS = new Set(['.html', '.htm', '.css', '.tsx', '.jsx', '.vue']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo']);

function copyDirSafe(src, dst) {
  if (!existsSync(src)) return 0;
  mkdirSync(dst, { recursive: true });
  let count = 0;
  for (const ent of readdirSync(src, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const s = join(src, ent.name);
    const d = join(dst, ent.name);
    if (ent.isDirectory()) {
      count += copyDirSafe(s, d);
    } else {
      cpSync(s, d);
      count += 1;
    }
  }
  return count;
}

export function syncToWorkspace({
  targetDir,
  mode = 'design-system',
  designSystemId,
  projectId,
  artifactId,
  version,
  bindWorkspace = true,
} = {}) {
  if (!targetDir || typeof targetDir !== 'string') {
    throw new Error('targetDir (absolute path) is required.');
  }
  const absTarget = resolve(targetDir);
  mkdirSync(absTarget, { recursive: true });

  const dsId = designSystemId || getDefaultDesignSystemId({ workspacePaths: [absTarget] });
  const ds = getDesignSystem(dsId);
  if (!ds) throw new Error(`Design system not found: ${dsId}`);

  if (mode === 'design-system') {
    const folderBase = basename(absTarget).toLowerCase();
    const installDir =
      folderBase === 'design-system' || folderBase === 'design-systems' || folderBase === ds.id
        ? absTarget
        : join(absTarget, 'design-system', ds.id);
    mkdirSync(installDir, { recursive: true });

    let filesWrittenCount = 0;
    for (const fileName of ['tokens.css', 'tokens.json', 'DESIGN.md', 'README.md', 'manifest.json', 'design-system.json']) {
      const p = join(ds.rootDir, fileName);
      if (existsSync(p)) {
        cpSync(p, join(installDir, fileName));
        filesWrittenCount += 1;
      }
    }
    for (const subDir of ['components', 'fonts', 'assets', 'api']) {
      filesWrittenCount += copyDirSafe(join(ds.rootDir, subDir), join(installDir, subDir));
    }

    const compiled = compileDesignSystem(ds.id);
    if (compiled?.digest) {
      writeFileSync(join(installDir, 'DIGEST.md'), compiled.digest, 'utf8');
      filesWrittenCount += 1;
    }

    let boundConfigPath = null;
    if (bindWorkspace) {
      boundConfigPath = writeWorkspaceBinding(absTarget, {
        designSystemId: ds.id,
        assetsDir: installDir,
      });
    }

    return {
      mode: 'design-system',
      designSystemId: ds.id,
      designSystemName: ds.name,
      targetDir: absTarget,
      installedDir: installDir,
      filesWrittenCount,
      boundConfigPath,
    };
  }

  if (mode === 'artifact') {
    if (!projectId || !artifactId) {
      throw new Error('projectId and artifactId are required when mode="artifact".');
    }
    const art = getArtifact(projectId, artifactId, version);
    if (!art) {
      throw new Error(`Artifact not found: ${projectId}/${artifactId}`);
    }
    const artDsId = designSystemId || art.designSystemId || ds.id;
    const artDs = getDesignSystem(artDsId) || ds;

    const filesWritten = [];
    for (const [rel, content] of Object.entries(art.files || {})) {
      const cleanRel = String(rel).replace(/^\/+/, '').replace(/\\/g, '/');
      if (!cleanRel || cleanRel.includes('..')) continue;
      const outPath = resolve(absTarget, cleanRel);
      if (!outPath.startsWith(absTarget + sep)) continue;
      mkdirSync(dirname(outPath), { recursive: true });
      let text = String(content);
      if (cleanRel.endsWith('.html') || cleanRel.endsWith('.css')) {
        text = text.replace(/\/ds\/([a-z0-9-_]+)\//gi, './ds/$1/');
      }
      writeFileSync(outPath, text, 'utf8');
      filesWritten.push(outPath);
    }

    const dsOutDir = join(absTarget, 'ds', artDs.id);
    mkdirSync(dsOutDir, { recursive: true });
    if (artDs.hasTokensCss) {
      cpSync(join(artDs.rootDir, 'tokens.css'), join(dsOutDir, 'tokens.css'));
      filesWritten.push(join(dsOutDir, 'tokens.css'));
    }
    for (const subDir of ['components', 'fonts', 'assets']) {
      copyDirSafe(join(artDs.rootDir, subDir), join(dsOutDir, subDir));
    }

    let boundConfigPath = null;
    if (bindWorkspace) {
      boundConfigPath = writeWorkspaceBinding(absTarget, {
        designSystemId: artDs.id,
        assetsDir: dsOutDir,
      });
    }

    return {
      mode: 'artifact',
      projectId,
      artifactId,
      version: art.activeVersion,
      designSystemId: artDs.id,
      targetDir: absTarget,
      entryFile: join(absTarget, 'index.html'),
      filesWrittenCount: filesWritten.length,
      boundConfigPath,
    };
  }

  throw new Error(`Unsupported sync mode: ${mode}`);
}

function collectLintableFiles(inputPaths, maxFiles = 40) {
  const out = [];
  const visit = (p) => {
    if (out.length >= maxFiles) return;
    const abs = resolve(p);
    if (!existsSync(abs)) return;
    const st = statSync(abs);
    if (st.isFile()) {
      if (LINT_EXTS.has(extname(abs).toLowerCase())) out.push(abs);
      return;
    }
    if (st.isDirectory()) {
      for (const ent of readdirSync(abs, { withFileTypes: true })) {
        if (out.length >= maxFiles) break;
        if (SKIP_DIRS.has(ent.name)) continue;
        visit(join(abs, ent.name));
      }
    }
  };
  for (const p of inputPaths) visit(p);
  return out;
}

export function lintWorkspaceFiles({ paths = [], designSystemId } = {}) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('paths array (files or directories) is required.');
  }
  const dsId = designSystemId || getDefaultDesignSystemId({ workspacePaths: paths });
  const files = collectLintableFiles(paths);

  const results = files.map((filePath) => {
    const ext = extname(filePath).toLowerCase();
    const raw = readFileSync(filePath, 'utf8');
    const isHtml = ext === '.html' || ext === '.htm';
    const isCss = ext === '.css';
    const report = lintArtifact({
      html: isHtml ? raw : '',
      css: isCss ? raw : '',
      code: isHtml || isCss ? '' : raw,
      designSystemId: dsId,
      isComponentCode: !isHtml,
    });
    return {
      path: filePath,
      ...report,
    };
  });

  const totalErrors = results.reduce((sum, r) => sum + (r.counts?.errors || 0), 0);
  const totalWarnings = results.reduce((sum, r) => sum + (r.counts?.warnings || 0), 0);

  return {
    designSystemId: dsId,
    filesScanned: results.length,
    totalErrors,
    totalWarnings,
    passed: totalErrors === 0,
    results,
  };
}
