import { readFileSync } from 'node:fs';
import { compileDesignSystem } from '../bin/lib/compiler.mjs';
import { listDesignSystems } from '../bin/lib/registry.mjs';
import {
  hasInjectedSession,
  markInjectedSession,
  resolveActiveDesignSystem,
} from '../bin/lib/state.mjs';

const UI_INTENT_RE =
  /(ui|ux|页面|网页|界面|原型|组件|看板|仪表盘|落地页|官网|幻灯片|演示文稿|ppt|pptx|slides|design\s*system|设计系统|样式|配色|主题|排版|动效|画布|landing\s*page|dashboard|prototype|frontend|前端|卡片|按钮|表单|导航|布局|layout|css|html|tailwind|tsx|react\s*component)/i;

function out(obj) {
  process.stdout.write(JSON.stringify(obj));
}

async function main() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    out({});
    return;
  }

  let payload = {};
  try {
    payload = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    out({});
    return;
  }

  const conversationId = String(payload.conversationId || '');
  const workspacePaths = Array.isArray(payload.workspacePaths) ? payload.workspacePaths : [];
  const cwd = String(payload.cwd || '');
  const lastUserInput = String(payload.lastUserInput || '');

  const installedIds = listDesignSystems().map((s) => s.id);
  const active = resolveActiveDesignSystem({ workspacePaths, cwd, installedIds });
  const dsId = active?.designSystemId;

  if (!dsId || active.injectionMode === 'manual') {
    out({});
    return;
  }

  if (active.injectionMode === 'auto' && !UI_INTENT_RE.test(lastUserInput)) {
    out({});
    return;
  }

  if (conversationId && hasInjectedSession(conversationId, dsId)) {
    out({});
    return;
  }

  const compiled = compileDesignSystem(dsId);
  if (!compiled?.digest) {
    out({});
    return;
  }

  if (conversationId) {
    markInjectedSession(conversationId, dsId);
  }

  out({
    injectSteps: [
      {
        systemMessage: {
          systemMessage: `${compiled.digest}\n\n(Injected by Open Design Studio · mode=${active.injectionMode}, source=${active.source})`,
        },
      },
    ],
  });
}

try {
  await main();
} catch {
  out({});
}
