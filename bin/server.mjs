import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { compileDesignSystem, queryDesignSystem } from './lib/compiler.mjs';
import {
  exportArtifact,
  exportDesignSystemPackage,
} from './lib/exporter.mjs';
import { lintArtifact } from './lib/linter.mjs';
import {
  addAnnotation,
  createArtifact,
  createProject,
  createStarterProject,
  getArtifact,
  getProject,
  listArtifacts,
  listProjects,
  resolveAnnotation,
  resolveArtifactFile,
  rollbackArtifact,
  saveProjectBrief,
  updateArtifact,
} from './lib/projects.mjs';
import {
  getDefaultDesignSystemId,
  getDesignSystem,
  importDesignSystem,
  listDesignSystems,
  listUpstreamCatalog,
  PLUGIN_ROOT,
  resolveDesignSystemFile,
  syncUpstreamDesignSystem,
} from './lib/registry.mjs';
import {
  getState,
  resolveActiveDesignSystem,
  setState,
  writeWorkspaceBinding,
} from './lib/state.mjs';
import { lintWorkspaceFiles, syncToWorkspace } from './lib/workspace.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_HTML_PATH = join(PLUGIN_ROOT, 'dist', 'app.html');
const APP_URI = 'ui://open-design/app.html';
const RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.md': 'text/markdown; charset=utf-8',
};

const OD_INSPECTOR_SCRIPT = `
<script data-od-inspector="1">
(function () {
  var active = false;
  var overlay = null;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #b6c83f;background:rgba(182,200,63,0.12);display:none;box-sizing:border-box;';
    document.body.appendChild(overlay);
    return overlay;
  }
  function buildSelector(el) {
    var parts = [];
    var cur = el;
    for (var i = 0; i < 3 && cur && cur.nodeType === 1 && cur !== document.body; i++) {
      var seg = cur.tagName.toLowerCase();
      if (cur.id) { seg += '#' + cur.id; parts.unshift(seg); break; }
      if (cur.classList && cur.classList.length) {
        seg += '.' + Array.prototype.slice.call(cur.classList, 0, 2).join('.');
      }
      parts.unshift(seg);
      cur = cur.parentElement;
    }
    return parts.join(' > ') || 'body';
  }
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'od-inspect-toggle') {
      active = Boolean(e.data.enabled);
      if (!active && overlay) overlay.style.display = 'none';
    }
  });
  document.addEventListener('mousemove', function (e) {
    if (!active) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === overlay || el === document.documentElement) return;
    var r = el.getBoundingClientRect();
    var ov = ensureOverlay();
    ov.style.display = 'block';
    ov.style.left = r.left + 'px';
    ov.style.top = r.top + 'px';
    ov.style.width = r.width + 'px';
    ov.style.height = r.height + 'px';
  }, true);
  document.addEventListener('click', function (e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    if (!el || el.nodeType !== 1) return;
    var text = String(el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 48);
    window.parent.postMessage({
      type: 'od-element-picked',
      selector: buildSelector(el),
      tagName: el.tagName.toLowerCase(),
      textPreview: text
    }, '*');
  }, true);
})();
</script>`;

// 1. Start authenticated 127.0.0.1 loopback HTTP preview server
const previewToken = randomBytes(16).toString('hex');

const httpServer = createServer((req, res) => {
  try {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const parts = reqUrl.pathname.split('/').filter(Boolean);

    // /p/<token>/<projectId>/<artifactId>/v<N>/<file...>
    if (parts[0] === 'p') {
      if (parts[1] !== previewToken || parts.length < 5) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }
      const projectId = decodeURIComponent(parts[2]);
      const artifactId = decodeURIComponent(parts[3]);
      const verMatch = parts[4].match(/^v(\d+)$/);
      if (!verMatch) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad version');
        return;
      }
      const version = Number(verMatch[1]);
      const relPath = parts.slice(5).map(decodeURIComponent).join('/') || 'index.html';
      const filePath = resolveArtifactFile(projectId, artifactId, version, relPath);
      if (!filePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const ext = extname(filePath).toLowerCase();
      const mime = MIME_MAP[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-store',
      });
      if (ext === '.html' || ext === '.css') {
        let text = readFileSync(filePath, 'utf8');
        text = text.replace(/\/ds\/([a-z0-9-_]+)\//gi, `/ds/${previewToken}/$1/`);
        if (ext === '.html') {
          if (/<\/body>/i.test(text)) {
            text = text.replace(/<\/body>/i, `${OD_INSPECTOR_SCRIPT}\n</body>`);
          } else {
            text += OD_INSPECTOR_SCRIPT;
          }
        }
        res.end(text);
      } else {
        res.end(readFileSync(filePath));
      }
      return;
    }

    // /ds/<token>/<dsId>/<file...>
    if (parts[0] === 'ds') {
      if (parts[1] !== previewToken || parts.length < 4) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }
      const dsId = decodeURIComponent(parts[2]);
      const relPath = parts.slice(3).map(decodeURIComponent).join('/');
      const filePath = resolveDesignSystemFile(dsId, relPath);
      if (!filePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const ext = extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_MAP[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(readFileSync(filePath));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(err instanceof Error ? err.message : 'Internal error');
  }
});

await new Promise((resolveListen, rejectListen) => {
  httpServer.once('error', rejectListen);
  httpServer.listen(0, '127.0.0.1', () => resolveListen());
});

const addressInfo = httpServer.address();
const previewPort = typeof addressInfo === 'object' && addressInfo ? addressInfo.port : 0;
const previewOrigin = `http://127.0.0.1:${previewPort}`;

function buildPreviewUrl(projectId, artifactId, version) {
  return `${previewOrigin}/p/${previewToken}/${encodeURIComponent(projectId)}/${encodeURIComponent(artifactId)}/v${version}/index.html`;
}

// 2. Initialize MCP Server
const server = new McpServer({
  name: 'open-design-studio',
  version: '2.0.0',
});

server.registerResource(
  'open-design-system-resources',
  new ResourceTemplate('ds://{id}/{part}', {
    list: async () => {
      const resources = [];
      for (const s of listDesignSystems()) {
        resources.push({
          uri: `ds://${s.id}/digest`,
          name: `${s.name} · Digest`,
          title: `${s.name} Pre-compiled Digest`,
          description: s.description,
          mimeType: 'text/markdown',
        });
        if (s.hasTokensCss) {
          resources.push({
            uri: `ds://${s.id}/tokens.css`,
            name: `${s.name} · tokens.css`,
            title: `${s.name} CSS Tokens`,
            mimeType: 'text/css',
          });
        }
      }
      return { resources };
    },
  }),
  {
    title: 'Design System Resource',
    description: 'Pre-compiled digest, tokens.css, and spec for installed design systems.',
  },
  async (uri, variables) => {
    const id = String(variables.id || '');
    const part = String(variables.part || 'digest');
    if (part === 'digest') {
      const compiled = compileDesignSystem(id);
      if (!compiled) throw new Error(`Design system not found: ${id}`);
      return {
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: compiled.digest }],
      };
    }
    const ds = getDesignSystem(id);
    if (!ds) throw new Error(`Design system not found: ${id}`);
    if (part === 'tokens.css') {
      return {
        contents: [{ uri: uri.href, mimeType: 'text/css', text: ds.tokensCss || '' }],
      };
    }
    if (part === 'spec') {
      return {
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: ds.docContent || '' }],
      };
    }
    throw new Error(`Unsupported resource part "${part}". Use digest, tokens.css, or spec.`);
  },
);

server.registerResource(
  'open-design-studio-app',
  APP_URI,
  {
    title: 'Open Design Studio',
    description: 'Interactive Open Design Studio UI for Antigravity',
    mimeType: RESOURCE_MIME_TYPE,
    _meta: {
      ui: {
        prefersBorder: false,
        csp: {
          frameDomains: [previewOrigin],
        },
      },
    },
  },
  async () => {
    const html = readFileSync(APP_HTML_PATH, 'utf8');
    return {
      contents: [
        {
          uri: APP_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: html,
          _meta: {
            ui: {
              prefersBorder: false,
              csp: {
                frameDomains: [previewOrigin],
              },
            },
          },
        },
      ],
    };
  },
);

// Helper to summarize artifact without shipping huge multi-file payloads to trajectory unless requested
function summarizeArtifact(art) {
  if (!art) return null;
  return {
    id: art.id,
    projectId: art.projectId,
    title: art.title,
    type: art.type,
    designSystemId: art.designSystemId,
    currentVersion: art.currentVersion,
    activeVersion: art.activeVersion,
    versions: art.versions,
    annotations: art.annotations || [],
    slides: art.slides || null,
    fileNames: Object.keys(art.files || {}),
    previewUrl: buildPreviewUrl(art.projectId, art.id, art.activeVersion || art.currentVersion),
    updatedAt: art.updatedAt,
  };
}

// --- UI Entrypoint Tools ---

server.registerTool(
  'open_studio',
  {
    title: 'Open Design Studio',
    description:
      '打开 Open Design Studio 工作台：浏览多套设计系统（兼容 Open Design DESIGN.md 与 Claude Design v3）、交互式画布预览与视口切换、批注迭代、Anti-AI-Slop 检查以及 HTML/ZIP/PPTX 导出。所有参数均可选。',
    inputSchema: {
      tab: z
        .enum(['canvas', 'brief', 'systems', 'linter', 'skills'])
        .optional()
        .describe('初始打开的标签页'),
      projectId: z.string().optional().describe('要定位的项目 ID'),
      artifactId: z.string().optional().describe('要预览的产物 ID'),
      designSystemId: z.string().optional().describe('要高亮的设计系统 ID'),
    },
    _meta: {
      ui: { resourceUri: APP_URI },
      'ui/resourceUri': APP_URI,
      'com.google.antigravity/ui': {
        entrypoints: [
          { type: 'aux_pane', title: 'Open Design Studio' },
          { type: 'global', title: 'Open Design Studio' },
        ],
      },
    },
  },
  async (args = {}) => {
    const systems = listDesignSystems();
    const projects = listProjects();
    return {
      content: [
        {
          type: 'text',
          text: `已打开 Open Design Studio（已挂载 ${systems.length} 套设计系统，${projects.length} 个设计项目）。`,
        },
      ],
      structuredContent: {
        tab: args.tab || 'canvas',
        projectId: args.projectId || projects[0]?.id || null,
        artifactId: args.artifactId || null,
        designSystemId: args.designSystemId || getDefaultDesignSystemId(),
      },
    };
  },
);

server.registerTool(
  'od_collect_brief',
  {
    title: 'Collect Design Brief',
    description:
      '打开 Open Design Studio 的交互式需求简报卡，让用户确认交付类型（原型/看板/幻灯片/落地页/动效）、设计系统、受众以及信息密度/创意幅度滑块。',
    inputSchema: {
      title: z.string().optional(),
      type: z.enum(['prototype', 'dashboard', 'slides', 'landing', 'component', 'motion']).optional(),
      designSystemId: z.string().optional(),
      audience: z.string().optional(),
      notes: z.string().optional(),
      projectId: z.string().optional(),
    },
    _meta: {
      ui: { resourceUri: APP_URI },
      'ui/resourceUri': APP_URI,
    },
  },
  async (args = {}) => {
    return {
      content: [
        {
          type: 'text',
          text: '已在 Open Design Studio 打开需求简报卡，等待确认目标设计系统与交付参数。',
        },
      ],
      structuredContent: {
        tab: 'brief',
        briefDraft: {
          title: args.title || '',
          type: args.type || 'prototype',
          designSystemId: args.designSystemId || getDefaultDesignSystemId(),
          audience: args.audience || '',
          notes: args.notes || '',
          projectId: args.projectId || null,
        },
      },
    };
  },
);

// --- Design System Registry Tools ---

server.registerTool(
  'od_list_design_systems',
  {
    title: 'List Design Systems',
    description: '列出 Open Design Studio 中所有可用的本地设计系统，并标出当前全局激活的系统与注入模式。',
    inputSchema: {},
  },
  async () => {
    const rawState = getState();
    const active = resolveActiveDesignSystem({ installedIds: listDesignSystems().map((x) => x.id) });
    const systems = listDesignSystems().map((s) => ({
      id: s.id,
      name: s.name,
      format: s.format,
      category: s.category,
      description: s.description,
      sourceType: s.sourceType,
      active: s.id === active.designSystemId,
      hasTokensCss: s.hasTokensCss,
      hasBundle: s.hasBundle,
      hasApiDocs: s.hasApiDocs,
      swatches: s.swatches,
    }));
    const payload = {
      activeDesignSystemId: active.designSystemId,
      injectionMode: rawState.injectionMode,
      systems,
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
);

server.registerTool(
  'od_set_active_system',
  {
    title: 'Set Active Design System',
    description:
      '设置全局默认激活的设计系统（或绑定当前工作区项目 .agents/design-system.json），并配置自动注入模式（auto/always/manual）。',
    inputSchema: {
      id: z.string().optional().describe('要激活的设计系统 ID'),
      injectionMode: z.enum(['auto', 'always', 'manual']).optional().describe('自动注入策略：auto（检测 UI 意图按需注入）、always（始终注入）、manual（仅手动挂载胶囊时注入）'),
      workspaceDir: z.string().optional().describe('可选：若提供工作区目录，则同步写入 <workspaceDir>/.agents/design-system.json'),
    },
  },
  async ({ id, injectionMode, workspaceDir } = {}) => {
    if (id) {
      const ds = getDesignSystem(id);
      if (!ds) {
        return { isError: true, content: [{ type: 'text', text: `Design system not found: ${id}` }] };
      }
    }
    const nextState = setState({
      ...(id ? { activeDesignSystemId: id } : {}),
      ...(injectionMode ? { injectionMode } : {}),
    });
    const resolvedId = id || nextState.activeDesignSystemId || getDefaultDesignSystemId();
    let boundConfigPath = null;
    if (workspaceDir) {
      boundConfigPath = writeWorkspaceBinding(workspaceDir, {
        designSystemId: resolvedId,
        injectionMode: nextState.injectionMode,
      });
    }
    const compiled = compileDesignSystem(resolvedId);
    const out = {
      activeDesignSystemId: resolvedId,
      injectionMode: nextState.injectionMode,
      boundConfigPath,
      digest: compiled?.digest || '',
    };
    return {
      content: [{ type: 'text', text: `已激活设计系统 ${resolvedId}（mode=${nextState.injectionMode}${boundConfigPath ? `, workspace=${boundConfigPath}` : ''}）\n\n${out.digest}` }],
      structuredContent: out,
    };
  },
);

server.registerTool(
  'od_query_system',
  {
    title: 'Query Design System Spec & Components',
    description:
      '高信噪比按需精准查询任意设计系统：支持按 aspect 精准查组件 Props 文档（如 aspect="component", query="Page,SpecimenCard"）、Token 色板表、SVG 素材名、规则/文案或 HTML 起手骨架。不传 id 时自动读取当前激活系统。',
    inputSchema: {
      id: z.string().optional().describe('设计系统 ID（省略时自动使用当前激活系统）'),
      aspect: z
        .enum(['digest', 'component', 'tokens', 'assets', 'rules', 'voice', 'boilerplate'])
        .default('digest')
        .describe('要查询的维度'),
      query: z.string().optional().default('').describe('过滤关键词或逗号分隔组件名，如 "Page,TitleBand,Entry"'),
    },
  },
  async ({ id, aspect = 'digest', query = '' } = {}) => {
    const targetId = id || getDefaultDesignSystemId();
    const res = queryDesignSystem(targetId, { aspect, query });
    if (!res) {
      return { isError: true, content: [{ type: 'text', text: `Design system not found: ${targetId}` }] };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
      structuredContent: res,
    };
  },
);

server.registerTool(
  'od_render',
  {
    title: 'Quick Render & Preview Artifact (Single-Step)',
    description:
      '主力单步渲染工具：一次调用自动完成「建项或递增版本 + 注入设计系统运行时/tokens.css + 确定性 Anti-AI-Slop 体检 + 刷新 Open Design Studio 右侧预览画布」。支持传 html 字符串、多文件 files 映射或结构化 slides 数组。',
    inputSchema: {
      title: z.string().optional().describe('产物标题（更新已有产物时可选）'),
      type: z.enum(['prototype', 'dashboard', 'slides', 'landing', 'component', 'motion']).optional().default('prototype'),
      designSystemId: z.string().optional().describe('绑定设计系统 ID（省略时自动使用当前激活系统）'),
      projectId: z.string().optional().describe('可选项目 ID（省略时自动新建或复用同名/近期项目）'),
      artifactId: z.string().optional().describe('可选产物 ID；若同时命中已有项目与产物，自动递增版本号 (v1 -> v2)'),
      html: z.string().optional().describe('主页面 index.html 内容（files["index.html"] 的快捷方式）'),
      files: z.record(z.string(), z.string()).optional().default({}).describe('完整源码文件映射'),
      slides: z
        .array(
          z.object({
            eyebrow: z.string().optional(),
            title: z.string(),
            body: z.string().optional(),
            bullets: z.array(z.string()).optional(),
            metrics: z
              .array(z.object({ label: z.string(), value: z.string(), unit: z.string().optional() }))
              .optional(),
            notes: z.string().optional(),
          }),
        )
        .optional()
        .describe('当 type="slides" 时，传结构化幻灯片数组自动生成网页与 PPTX'),
      injectRuntime: z.boolean().optional().default(true).describe('自动补齐 /ds/<id>/tokens.css（及按需补齐 bundle.js/css）'),
      note: z.string().optional().describe('版本说明'),
    },
    _meta: {
      ui: { resourceUri: APP_URI },
      'ui/resourceUri': APP_URI,
    },
  },
  async (args = {}) => {
    try {
      const dsId = args.designSystemId || getDefaultDesignSystemId();
      const compiled = compileDesignSystem(dsId);

      // Resolve or auto-create project
      let targetProjectId = args.projectId;
      if (!targetProjectId) {
        const existingProjects = listProjects();
        const matchingProj = existingProjects.find((p) => p.designSystemId === dsId);
        if (matchingProj && args.artifactId) {
          targetProjectId = matchingProj.id;
        } else if (args.artifactId) {
          for (const p of existingProjects) {
            if (getArtifact(p.id, args.artifactId)) {
              targetProjectId = p.id;
              break;
            }
          }
        }
        if (!targetProjectId) {
          const proj = createProject({
            name: args.title || `${compiled?.name || dsId} · Studio`,
            designSystemId: dsId,
            description: `Created via od_render (${dsId})`,
          });
          targetProjectId = proj.id;
        }
      }

      // Prepare files & auto-inject design system runtime/tokens
      const files = { ...(args.files || {}) };
      if (args.html && !files['index.html']) {
        files['index.html'] = args.html;
      }
      if (args.injectRuntime !== false && files['index.html']) {
        let htmlText = files['index.html'];
        const headExtras = [];
        const hasTokens = new RegExp(`/ds/${dsId}/tokens\\.css|tokens\\.css`, 'i').test(htmlText);
        if (!hasTokens && compiled?.id) {
          headExtras.push(`<link rel="stylesheet" href="/ds/${dsId}/tokens.css">`);
        }
        if (
          compiled?.format === 'claude-v3' &&
          compiled.namespace &&
          (htmlText.includes(`${compiled.namespace}.`) || htmlText.includes(`window.${compiled.namespace}`)) &&
          !/bundle\.js/i.test(htmlText)
        ) {
          for (const line of String(compiled.runtimeHeadSnippet || '').split(/\r?\n/)) {
            if (line.trim() && !line.includes('tokens.css')) headExtras.push(line.trim());
          }
        }
        if (headExtras.length > 0) {
          const snippet = headExtras.join('\n');
          if (/<\/head>/i.test(htmlText)) {
            htmlText = htmlText.replace(/<\/head>/i, `${snippet}\n</head>`);
          } else {
            htmlText = `${snippet}\n${htmlText}`;
          }
          files['index.html'] = htmlText;
        }
      }

      const existingArt = args.artifactId ? getArtifact(targetProjectId, args.artifactId) : null;
      const art = existingArt
        ? updateArtifact(targetProjectId, args.artifactId, {
            files,
            slides: args.slides,
            title: args.title,
            designSystemId: dsId,
            note: args.note || 'od_render revision',
          })
        : createArtifact(targetProjectId, {
            id: args.artifactId,
            title: args.title || `${compiled?.name || dsId} 产物`,
            type: args.type || 'prototype',
            designSystemId: dsId,
            files,
            slides: args.slides,
            note: args.note || 'Created via od_render',
          });

      const cssText = Object.entries(art.files || {})
        .filter(([k]) => k.endsWith('.css'))
        .map(([, v]) => v)
        .join('\n');
      const lint = lintArtifact({
        html: art.files['index.html'] || '',
        css: cssText,
        designSystemId: art.designSystemId,
        type: art.type,
      });
      const summary = summarizeArtifact(art);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ projectId: art.projectId, artifact: summary, lint }, null, 2),
          },
        ],
        structuredContent: {
          tab: 'canvas',
          projectId: art.projectId,
          artifactId: art.id,
          designSystemId: art.designSystemId,
          artifact: summary,
          lint,
        },
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `od_render 失败: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  },
);

server.registerTool(
  'od_sync_to_workspace',
  {
    title: 'Sync Design System or Artifact to Workspace',
    description:
      '将当前激活设计系统的 tokens.css/组件/规范（或 Studio 中已生成产物）落盘到真实项目目录，并可选绑定 .agents/design-system.json 使工作区自动激活该系统。',
    inputSchema: {
      targetDir: z.string().describe('目标工作区或目录的绝对路径'),
      mode: z.enum(['design-system', 'artifact']).default('design-system'),
      designSystemId: z.string().optional(),
      projectId: z.string().optional(),
      artifactId: z.string().optional(),
      version: z.number().int().positive().optional(),
      bindWorkspace: z.boolean().optional().default(true),
    },
  },
  async (args) => {
    try {
      const res = syncToWorkspace(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
        structuredContent: res,
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `同步工作区失败: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  },
);

server.registerTool(
  'od_lint_workspace',
  {
    title: 'Lint Real Workspace UI Files',
    description: '对本地代码库里的真实 .html / .css / .tsx / .jsx / .vue 文件批量运行当前设计系统规范与 Anti-AI-Slop 检查。',
    inputSchema: {
      paths: z.array(z.string()).min(1).describe('待扫描的绝对文件或目录路径数组'),
      designSystemId: z.string().optional(),
    },
  },
  async (args) => {
    try {
      const res = lintWorkspaceFiles(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
        structuredContent: res,
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `工作区体检失败: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  },
);

server.registerTool(
  'od_get_design_system',
  {
    title: 'Get Design System Spec',
    description: '读取指定设计系统的核心规范文档（DESIGN.md / README.md）和 tokens.css 变量契约。',
    inputSchema: {
      id: z.string().describe('设计系统 ID，例如内置 Open Design 系统 slug 或本地导入的系统 ID'),
      includeTokensCss: z.boolean().optional().default(true),
    },
  },
  async ({ id, includeTokensCss = true }) => {
    const ds = getDesignSystem(id);
    if (!ds) {
      return { isError: true, content: [{ type: 'text', text: `Design system not found: ${id}` }] };
    }
    const result = {
      id: ds.id,
      name: ds.name,
      format: ds.format,
      category: ds.category,
      tokensCssUrl: `/ds/${ds.id}/tokens.css`,
      bundleCssUrl: ds.hasBundle ? `/ds/${ds.id}/components/bundle.css` : null,
      bundleJsUrl: ds.hasBundle ? `/ds/${ds.id}/components/bundle.js` : null,
      docContent: ds.docContent,
      extraDocs: ds.extraDocs,
      apiComponents: ds.apiComponents,
      tokensCss: includeTokensCss ? ds.tokensCss : undefined,
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
);

server.registerTool(
  'od_import_design_system',
  {
    title: 'Import Local Design System',
    description: '从本地文件夹或 .zip 压缩包导入设计系统（兼容 Claude Design v3 和 Open Design v1）到 Studio 库中。',
    inputSchema: {
      sourcePath: z.string().describe('本地目录或 .zip 压缩包的绝对路径'),
      id: z.string().optional().describe('自定义系统 slug（可选）'),
    },
  },
  async ({ sourcePath, id }) => {
    try {
      const desc = await importDesignSystem(sourcePath, id);
      return {
        content: [{ type: 'text', text: `已成功导入设计系统 ${desc.name} (id: ${desc.id}, 格式: ${desc.format})` }],
        structuredContent: { system: desc },
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `导入失败: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  },
);

server.registerTool(
  'od_sync_upstream_system',
  {
    title: 'Sync Upstream Design System',
    description: '按 slug 从 GitHub nexu-io/open-design 官方库按需拉取任意品牌设计系统到本地 Studio。',
    inputSchema: {
      slug: z.string().describe('官方设计系统 slug，例如 stripe、linear、notion 等（可先查上游目录）'),
    },
  },
  async ({ slug }) => {
    try {
      const desc = syncUpstreamDesignSystem(slug);
      return {
        content: [{ type: 'text', text: `已从上游同步设计系统 ${desc.name} (id: ${desc.id})` }],
        structuredContent: { system: desc },
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `同步失败: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  },
);

// --- Project & Artifact Tools ---

server.registerTool(
  'od_list_projects',
  {
    title: 'List Projects',
    description: '列出 Open Design Studio 中的全部本地设计项目。',
    inputSchema: {},
  },
  async () => {
    const projects = listProjects();
    return {
      content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
      structuredContent: { projects },
    };
  },
);

server.registerTool(
  'od_create_project',
  {
    title: 'Create Project',
    description: '在 Open Design Studio 中创建一个新设计项目并绑定目标设计系统。',
    inputSchema: {
      id: z.string().optional(),
      name: z.string(),
      description: z.string().optional(),
      designSystemId: z.string().optional(),
    },
  },
  async (args) => {
    const project = createProject(args);
    return {
      content: [{ type: 'text', text: `已创建项目 ${project.name} (id: ${project.id}，绑定系统: ${project.designSystemId})` }],
      structuredContent: { project },
    };
  },
);

const SlideSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  metrics: z
    .array(z.object({ label: z.string(), value: z.string(), unit: z.string().optional() }))
    .optional(),
  notes: z.string().optional(),
});

server.registerTool(
  'od_create_artifact',
  {
    title: 'Create Design Artifact',
    description:
      '在项目中创建新版本化产物（原型、看板、幻灯片、落地页、组件或动效）。HTML 内可使用 /ds/<designSystemId>/tokens.css 直接引用设计系统令牌。',
    inputSchema: {
      projectId: z.string(),
      id: z.string().optional(),
      title: z.string(),
      type: z.enum(['prototype', 'dashboard', 'slides', 'landing', 'component', 'motion']).default('prototype'),
      designSystemId: z.string().optional(),
      files: z.record(z.string(), z.string()).optional().default({}),
      slides: z.array(SlideSchema).optional().describe('当 type="slides" 时，提供结构化幻灯片数组可同时自动生成交互网页与 PPTX 数据'),
      note: z.string().optional(),
    },
  },
  async (args) => {
    try {
      const art = createArtifact(args.projectId, args);
      const lint = lintArtifact({
        html: art.files['index.html'] || '',
        css: art.files['styles.css'] || '',
        designSystemId: art.designSystemId,
        type: art.type,
      });
      const summary = summarizeArtifact(art);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ artifact: summary, lint }, null, 2),
          },
        ],
        structuredContent: { artifact: summary, lint },
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `创建产物失败: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  },
);

server.registerTool(
  'od_update_artifact',
  {
    title: 'Update Artifact (New Version)',
    description: '更新已有产物并自动递增版本号（v1 -> v2 -> ...），保留历史版本支持随时对比与回滚。',
    inputSchema: {
      projectId: z.string(),
      artifactId: z.string(),
      files: z.record(z.string(), z.string()).optional().default({}),
      slides: z.array(SlideSchema).optional(),
      title: z.string().optional(),
      designSystemId: z.string().optional(),
      note: z.string().optional(),
    },
  },
  async (args) => {
    try {
      const art = updateArtifact(args.projectId, args.artifactId, args);
      const lint = lintArtifact({
        html: art.files['index.html'] || '',
        css: art.files['styles.css'] || '',
        designSystemId: art.designSystemId,
        type: art.type,
      });
      const summary = summarizeArtifact(art);
      return {
        content: [{ type: 'text', text: JSON.stringify({ artifact: summary, lint }, null, 2) }],
        structuredContent: { artifact: summary, lint },
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `更新产物失败: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  },
);

server.registerTool(
  'od_get_artifact',
  {
    title: 'Get Artifact',
    description: '读取指定产物的源码文件、版本历史和批注列表。',
    inputSchema: {
      projectId: z.string(),
      artifactId: z.string(),
      version: z.number().int().positive().optional(),
    },
  },
  async ({ projectId, artifactId, version }) => {
    const art = getArtifact(projectId, artifactId, version);
    if (!art) {
      return { isError: true, content: [{ type: 'text', text: `Artifact not found: ${projectId}/${artifactId}` }] };
    }
    const out = {
      ...summarizeArtifact(art),
      files: art.files,
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(out, null, 2) }],
      structuredContent: out,
    };
  },
);

// --- Linter & Exporter Tools ---

server.registerTool(
  'od_lint_artifact',
  {
    title: 'Lint Artifact (Anti-AI-Slop & Design System)',
    description: '对产物执行确定性 Anti-AI-Slop 与所绑定设计系统的规范检查。',
    inputSchema: {
      projectId: z.string(),
      artifactId: z.string(),
      version: z.number().int().positive().optional(),
    },
  },
  async ({ projectId, artifactId, version }) => {
    const art = getArtifact(projectId, artifactId, version);
    if (!art) {
      return { isError: true, content: [{ type: 'text', text: `Artifact not found: ${projectId}/${artifactId}` }] };
    }
    const cssText = Object.entries(art.files || {})
      .filter(([k]) => k.endsWith('.css'))
      .map(([, v]) => v)
      .join('\n');
    const report = lintArtifact({
      html: art.files['index.html'] || '',
      css: cssText,
      designSystemId: art.designSystemId,
      type: art.type,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
      structuredContent: report,
    };
  },
);

server.registerTool(
  'od_export_artifact',
  {
    title: 'Export Artifact (HTML / ZIP / PPTX / Design System)',
    description: '将设计产物导出到本地：支持单文件自包含 html、工程包 zip、原生可编辑幻灯片 pptx，或导出设计系统包。',
    inputSchema: {
      projectId: z.string().optional(),
      artifactId: z.string().optional(),
      version: z.number().int().positive().optional(),
      format: z.enum(['html', 'zip', 'pptx', 'design-system']).default('html'),
      designSystemId: z.string().optional().describe('仅当 format="design-system" 时需要'),
      outputDir: z.string().optional().describe('自定义导出目录（默认保存到 scratch/open-design-exports）'),
    },
  },
  async (args) => {
    try {
      if (args.format === 'design-system') {
        const res = await exportDesignSystemPackage(args.designSystemId || getDefaultDesignSystemId(), args.outputDir);
        return {
          content: [{ type: 'text', text: `已导出设计系统包: ${res.outputPath} (${res.bytes} bytes)` }],
          structuredContent: res,
        };
      }
      if (!args.projectId || !args.artifactId) {
        return { isError: true, content: [{ type: 'text', text: 'projectId and artifactId are required for html/zip/pptx export.' }] };
      }
      const res = await exportArtifact(args);
      return {
        content: [{ type: 'text', text: `已导出 ${res.format.toUpperCase()} 文件: ${res.outputPath} (${res.bytes} bytes)` }],
        structuredContent: res,
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `导出失败: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  },
);

// --- App-Only Tools (called directly by Studio UI iframe) ---

const APP_ONLY_META = { ui: { visibility: ['app'] } };

function listCraftDocs() {
  const craftDir = join(PLUGIN_ROOT, 'resources', 'upstream', 'craft');
  if (!existsSync(craftDir)) return [];
  return [
    'anti-ai-slop.md',
    ...readdirListSafe(craftDir).filter((f) => f !== 'anti-ai-slop.md'),
  ]
    .filter((f, idx, arr) => arr.indexOf(f) === idx && existsSync(join(craftDir, f)))
    .map((file) => ({
      file,
      content: readFileSync(join(craftDir, file), 'utf8'),
    }));
}

function readdirListSafe(dir) {
  try {
    return readdirSyncRecursive(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}

function readdirSyncRecursive(dir, base = '') {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...readdirSyncRecursive(join(dir, ent.name), rel));
    else out.push(rel);
  }
  return out;
}

function listStudioSkills() {
  const skillsRoot = join(PLUGIN_ROOT, 'skills');
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const mdPath = join(skillsRoot, d.name, 'SKILL.md');
      if (!existsSync(mdPath)) return null;
      const raw = readFileSync(mdPath, 'utf8');
      const descM = raw.match(/description:\s*>-\s*\n([\s\S]*?)\n---/);
      return {
        name: d.name,
        description: descM ? descM[1].replace(/\s+/g, ' ').trim() : '',
      };
    })
    .filter(Boolean);
}

server.registerTool(
  'od_app_bootstrap',
  {
    title: 'Studio Bootstrap',
    description: 'App-only bootstrap payload for Open Design Studio UI.',
    inputSchema: {
      projectId: z.string().optional(),
      artifactId: z.string().optional(),
    },
    _meta: APP_ONLY_META,
  },
  async (args = {}) => {
    const systems = listDesignSystems();
    const rawState = getState();
    const active = resolveActiveDesignSystem({ installedIds: systems.map((s) => s.id) });
    const compiledActive = compileDesignSystem(active.designSystemId);
    const projects = listProjects();
    const targetProjId = args.projectId || projects[0]?.id || null;
    const project = targetProjId ? getProject(targetProjId) : null;
    const targetArtId = args.artifactId || project?.artifacts?.[0]?.id || null;
    const activeArtifact =
      targetProjId && targetArtId ? getArtifact(targetProjId, targetArtId) : null;

    return {
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: {
        previewOrigin,
        previewToken,
        activeSystemId: active.designSystemId,
        injectionMode: rawState.injectionMode,
        activeDigest: compiledActive?.digest || '',
        designSystems: systems.map((s) => ({
          id: s.id,
          name: s.name,
          format: s.format,
          category: s.category,
          description: s.description,
          sourceType: s.sourceType,
          active: s.id === active.designSystemId,
          pinned: s.pinned,
          hasTokensCss: s.hasTokensCss,
          hasBundle: s.hasBundle,
          hasApiDocs: s.hasApiDocs,
          swatches: s.swatches,
        })),
        upstreamCatalog: listUpstreamCatalog(),
        projects,
        activeProject: project,
        activeArtifact: activeArtifact ? summarizeArtifact(activeArtifact) : null,
        craftDocs: listCraftDocs(),
        skills: listStudioSkills(),
      },
    };
  },
);

server.registerTool(
  'od_app_set_active_system',
  {
    title: 'App Set Active Design System',
    description: 'App-only tool to set active global design system and injection mode.',
    inputSchema: {
      id: z.string().optional(),
      injectionMode: z.enum(['auto', 'always', 'manual']).optional(),
    },
    _meta: APP_ONLY_META,
  },
  async ({ id, injectionMode } = {}) => {
    if (id && !getDesignSystem(id)) {
      return { isError: true, content: [{ type: 'text', text: `Not found: ${id}` }] };
    }
    const next = setState({
      ...(id ? { activeDesignSystemId: id } : {}),
      ...(injectionMode ? { injectionMode } : {}),
    });
    const activeId = next.activeDesignSystemId || getDefaultDesignSystemId();
    const compiled = compileDesignSystem(activeId);
    return {
      content: [{ type: 'text', text: activeId }],
      structuredContent: {
        activeSystemId: activeId,
        injectionMode: next.injectionMode,
        digest: compiled?.digest || '',
        name: compiled?.name || activeId,
      },
    };
  },
);

server.registerTool(
  'od_app_inspect_compiled',
  {
    title: 'App Inspect Compiled Design System',
    description: 'App-only tool to fetch compiled tokens, components API, SVG previews, and digest.',
    inputSchema: { id: z.string() },
    _meta: APP_ONLY_META,
  },
  async ({ id }) => {
    const ds = getDesignSystem(id);
    const compiled = compileDesignSystem(id);
    if (!ds || !compiled) return { isError: true, content: [{ type: 'text', text: 'Not found' }] };

    const svgAssets = [];
    for (const grp of compiled.assetGroups || []) {
      for (const fname of (grp.files || []).slice(0, 30)) {
        const p = join(ds.rootDir, 'assets', grp.name, fname);
        if (existsSync(p) && fname.endsWith('.svg')) {
          svgAssets.push({
            group: grp.name,
            name: fname,
            svg: readFileSync(p, 'utf8'),
          });
        }
      }
    }

    return {
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: {
        id: compiled.id,
        name: compiled.name,
        format: compiled.format,
        namespace: compiled.namespace,
        runtimeHeadSnippet: compiled.runtimeHeadSnippet,
        digest: compiled.digest,
        tokens: compiled.tokens,
        components: compiled.components,
        componentDetails: compiled.componentDetails,
        hardRules: compiled.hardRules,
        svgAssets,
        docContent: ds.docContent,
        tokensCss: ds.tokensCss,
      },
    };
  },
);

server.registerTool(
  'od_app_sync_to_workspace',
  {
    title: 'App Sync to Workspace',
    description: 'App-only tool to sync design system or artifact to workspace.',
    inputSchema: {
      targetDir: z.string(),
      mode: z.enum(['design-system', 'artifact']).default('design-system'),
      designSystemId: z.string().optional(),
      projectId: z.string().optional(),
      artifactId: z.string().optional(),
      version: z.number().int().positive().optional(),
      bindWorkspace: z.boolean().optional().default(true),
    },
    _meta: APP_ONLY_META,
  },
  async (args) => {
    const res = syncToWorkspace(args);
    return {
      content: [{ type: 'text', text: res.installedDir || res.entryFile || res.targetDir }],
      structuredContent: res,
    };
  },
);

server.registerTool(
  'od_app_get_artifact',
  {
    title: 'App Get Artifact',
    description: 'App-only tool to fetch full artifact preview data and fallback HTML.',
    inputSchema: {
      projectId: z.string(),
      artifactId: z.string(),
      version: z.number().int().positive().optional(),
    },
    _meta: APP_ONLY_META,
  },
  async ({ projectId, artifactId, version }) => {
    const art = getArtifact(projectId, artifactId, version);
    if (!art) return { isError: true, content: [{ type: 'text', text: 'Artifact not found' }] };
    const ds = getDesignSystem(art.designSystemId);
    const cssText = Object.entries(art.files || {})
      .filter(([k]) => k.endsWith('.css'))
      .map(([, v]) => v)
      .join('\n');
    const lint = lintArtifact({
      html: art.files['index.html'] || '',
      css: cssText,
      designSystemId: art.designSystemId,
      type: art.type,
    });
    return {
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: {
        artifact: {
          ...summarizeArtifact(art),
          html: art.files['index.html'] || '',
          files: art.files,
        },
        tokensCss: ds?.tokensCss || '',
        lint,
      },
    };
  },
);

server.registerTool(
  'od_app_get_ds',
  {
    title: 'App Get Design System',
    description: 'App-only tool to inspect a Design System spec.',
    inputSchema: { id: z.string() },
    _meta: APP_ONLY_META,
  },
  async ({ id }) => {
    const ds = getDesignSystem(id);
    if (!ds) return { isError: true, content: [{ type: 'text', text: 'Not found' }] };
    return {
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: { system: ds },
    };
  },
);

server.registerTool(
  'od_app_save_annotation',
  {
    title: 'App Save Annotation',
    description: 'App-only tool to add or toggle revision annotations.',
    inputSchema: {
      projectId: z.string(),
      artifactId: z.string(),
      action: z.enum(['add', 'resolve']).default('add'),
      target: z.string().optional(),
      text: z.string().optional(),
      annotationId: z.string().optional(),
      resolved: z.boolean().optional(),
    },
    _meta: APP_ONLY_META,
  },
  async (args) => {
    const annotations =
      args.action === 'resolve' && args.annotationId
        ? resolveAnnotation(args.projectId, args.artifactId, args.annotationId, args.resolved ?? true)
        : addAnnotation(args.projectId, args.artifactId, { target: args.target, text: args.text });
    return {
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: { annotations },
    };
  },
);

server.registerTool(
  'od_app_rollback',
  {
    title: 'App Rollback Version',
    description: 'App-only tool to switch active artifact version.',
    inputSchema: {
      projectId: z.string(),
      artifactId: z.string(),
      version: z.number().int().positive(),
    },
    _meta: APP_ONLY_META,
  },
  async ({ projectId, artifactId, version }) => {
    const art = rollbackArtifact(projectId, artifactId, version);
    return {
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: { artifact: summarizeArtifact(art) },
    };
  },
);

server.registerTool(
  'od_app_export',
  {
    title: 'App Export Artifact',
    description: 'App-only tool to export artifact or design system.',
    inputSchema: {
      projectId: z.string().optional(),
      artifactId: z.string().optional(),
      version: z.number().int().positive().optional(),
      format: z.enum(['html', 'zip', 'pptx', 'design-system']),
      designSystemId: z.string().optional(),
    },
    _meta: APP_ONLY_META,
  },
  async (args) => {
    const res =
      args.format === 'design-system'
        ? await exportDesignSystemPackage(args.designSystemId || getDefaultDesignSystemId())
        : await exportArtifact(args);
    return {
      content: [{ type: 'text', text: res.outputPath }],
      structuredContent: res,
    };
  },
);

server.registerTool(
  'od_app_import_ds',
  {
    title: 'App Import Design System',
    description: 'App-only tool to import a local directory or zip design system.',
    inputSchema: { sourcePath: z.string(), id: z.string().optional() },
    _meta: APP_ONLY_META,
  },
  async ({ sourcePath, id }) => {
    const desc = await importDesignSystem(sourcePath, id);
    return {
      content: [{ type: 'text', text: desc.id }],
      structuredContent: { system: desc },
    };
  },
);

server.registerTool(
  'od_app_sync_upstream',
  {
    title: 'App Sync Upstream Design System',
    description: 'App-only tool to install an official design system from nexu-io/open-design.',
    inputSchema: { slug: z.string() },
    _meta: APP_ONLY_META,
  },
  async ({ slug }) => {
    const desc = syncUpstreamDesignSystem(slug);
    return {
      content: [{ type: 'text', text: desc.id }],
      structuredContent: { system: desc },
    };
  },
);

server.registerTool(
  'od_app_save_brief',
  {
    title: 'App Save Brief',
    description: 'App-only tool to persist a design brief into a project.',
    inputSchema: {
      projectId: z.string().optional(),
      brief: z.record(z.string(), z.unknown()),
    },
    _meta: APP_ONLY_META,
  },
  async ({ projectId, brief }) => {
    const proj = projectId
      ? saveProjectBrief(projectId, brief)
      : createProject({
          name: String(brief.title || 'New Design Project'),
          designSystemId: String(brief.designSystemId || getDefaultDesignSystemId()),
          brief,
        });
    return {
      content: [{ type: 'text', text: proj.id }],
      structuredContent: { project: proj },
    };
  },
);

server.registerTool(
  'od_app_create_sample_project',
  {
    title: 'App Create Starter Project',
    description: 'App-only tool to create a starter project using the selected design system so users can immediately test Canvas/Linter/Export.',
    inputSchema: {
      designSystemId: z.string().optional(),
    },
    _meta: APP_ONLY_META,
  },
  async (args = {}) => {
    const created = createStarterProject(args.designSystemId);
    return {
      content: [{ type: 'text', text: created.project.id }],
      structuredContent: {
        project: created.project,
        artifact: summarizeArtifact(created.artifact),
      },
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
