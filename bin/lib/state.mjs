import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDataDir } from './registry.mjs';

const VALID_MODES = new Set(['auto', 'always', 'manual']);
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..', '..');

function getStatePath() {
  return join(getDataDir(), 'state.json');
}

function getSessionsPath() {
  return join(getDataDir(), 'hook-sessions.json');
}

function readJsonSafe(filePath, fallback = null) {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonSafe(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export function readRawState() {
  const raw = readJsonSafe(getStatePath(), {});
  const injectionMode = VALID_MODES.has(raw?.injectionMode) ? raw.injectionMode : 'auto';
  return {
    activeDesignSystemId: raw?.activeDesignSystemId ? String(raw.activeDesignSystemId) : null,
    injectionMode,
    updatedAt: raw?.updatedAt || null,
  };
}

export function getState() {
  return readRawState();
}

export function setState({ activeDesignSystemId, injectionMode } = {}) {
  const prev = readRawState();
  const next = {
    activeDesignSystemId:
      activeDesignSystemId !== undefined ? (activeDesignSystemId ? String(activeDesignSystemId) : null) : prev.activeDesignSystemId,
    injectionMode:
      injectionMode !== undefined && VALID_MODES.has(injectionMode) ? injectionMode : prev.injectionMode,
    updatedAt: new Date().toISOString(),
  };
  writeJsonSafe(getStatePath(), next);
  return next;
}

export function findWorkspaceBinding(workspacePath) {
  if (!workspacePath || typeof workspacePath !== 'string') return null;
  let current;
  try {
    current = resolve(workspacePath.replace(/^file:\/\//i, ''));
  } catch {
    return null;
  }
  if (!existsSync(current)) return null;

  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = join(current, '.agents', 'design-system.json');
    if (existsSync(candidate)) {
      const parsed = readJsonSafe(candidate, null);
      if (parsed && typeof parsed.designSystemId === 'string' && parsed.designSystemId.trim()) {
        return {
          designSystemId: parsed.designSystemId.trim(),
          injectionMode: VALID_MODES.has(parsed.injectionMode) ? parsed.injectionMode : null,
          configPath: candidate,
        };
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export function writeWorkspaceBinding(workspaceDir, { designSystemId, injectionMode, assetsDir } = {}) {
  if (!workspaceDir) throw new Error('workspaceDir is required');
  const agentsDir = join(resolve(workspaceDir), '.agents');
  mkdirSync(agentsDir, { recursive: true });
  const cfgPath = join(agentsDir, 'design-system.json');
  const payload = {
    designSystemId,
    ...(injectionMode && VALID_MODES.has(injectionMode) ? { injectionMode } : {}),
    ...(assetsDir ? { assetsDir } : {}),
    updatedAt: new Date().toISOString(),
  };
  writeJsonSafe(cfgPath, payload);
  return cfgPath;
}

function getPreferredFallbackSystemId(installedIds) {
  if (installedIds && installedIds.length > 0) {
    if (installedIds.includes('editorial-paper')) return 'editorial-paper';
    return installedIds[0];
  }
  return 'editorial-paper';
}

export function resolveActiveDesignSystem({ workspacePaths = [], cwd = '', installedIds = null } = {}) {
  const raw = readRawState();
  const mode = raw.injectionMode;

  const searchDirs = [
    ...(Array.isArray(workspacePaths) ? workspacePaths : []),
    ...(cwd ? [cwd] : []),
  ].filter(Boolean);

  for (const dir of searchDirs) {
    const binding = findWorkspaceBinding(dir);
    if (binding) {
      if (!installedIds || installedIds.includes(binding.designSystemId)) {
        return {
          designSystemId: binding.designSystemId,
          injectionMode: binding.injectionMode || mode,
          source: 'workspace',
          configPath: binding.configPath,
        };
      }
    }
  }

  if (raw.activeDesignSystemId) {
    if (!installedIds || installedIds.includes(raw.activeDesignSystemId)) {
      return {
        designSystemId: raw.activeDesignSystemId,
        injectionMode: mode,
        source: 'global',
      };
    }
  }

  return {
    designSystemId: getPreferredFallbackSystemId(installedIds),
    injectionMode: mode,
    source: 'default',
  };
}

export function hasInjectedSession(conversationId, systemId) {
  if (!conversationId || !systemId) return false;
  const store = readJsonSafe(getSessionsPath(), {});
  const entry = store?.[conversationId];
  return Boolean(entry && entry.systemId === systemId);
}

export function markInjectedSession(conversationId, systemId) {
  if (!conversationId || !systemId) return;
  const store = readJsonSafe(getSessionsPath(), {});
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const pruned = {};
  const entries = Object.entries(store || {})
    .filter(([, v]) => v && typeof v.ts === 'number' && now - v.ts < sevenDaysMs)
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, 199);

  for (const [k, v] of entries) {
    pruned[k] = v;
  }
  pruned[conversationId] = { systemId, ts: now, updatedAt: new Date(now).toISOString() };
  writeJsonSafe(getSessionsPath(), pruned);
}
