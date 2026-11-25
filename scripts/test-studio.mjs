import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import JSZip from 'jszip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..');

const tempDataDir = mkdtempSync(join(tmpdir(), 'od-test-data-'));
const tempExportDir = join(tempDataDir, 'exports');
const tempWsDir = join(tempDataDir, 'workspace');
mkdirSync(tempWsDir, { recursive: true });

// Create a synthetic Claude Design v3 fixture inside tempDataDir to verify dual-standard support universally
const mockV3Dir = join(tempDataDir, 'design-systems', 'mock-claude-v3');
mkdirSync(join(mockV3Dir, 'api', 'components'), { recursive: true });
mkdirSync(join(mockV3Dir, 'components', 'lib'), { recursive: true });
mkdirSync(join(mockV3Dir, 'assets', 'Icons'), { recursive: true });

writeFileSync(
  join(mockV3Dir, 'manifest.json'),
  JSON.stringify(
    {
      manifestVersion: 3,
      name: 'Mock Claude UI',
      namespace: 'MockUI',
      components: [
        { name: 'Page', group: 'Layout', summary: 'Standard shell wrapper' },
        { name: 'Card', group: 'Content', summary: 'Structured surface container' },
      ],
      assetGroups: [{ name: 'Icons', order: ['star.svg'], files: [{ path: 'assets/Icons/star.svg' }] }],
    },
    null,
    2,
  ),
  'utf8',
);
writeFileSync(
  join(mockV3Dir, 'tokens.css'),
  ':root, [data-theme="light"] { --surface: #fafafa; --on-surface: #18181b; --primary: #2563eb; }\n[data-theme="dark"] { --surface: #111317; --on-surface: #f3f4f6; --primary: #3b82f6; }\n',
  'utf8',
);
writeFileSync(
  join(mockV3Dir, 'api', 'tokens.md'),
  '# Tokens\n## Color · Surfaces\n| token | light | dark | usage |\n| --- | --- | --- | --- |\n| `--surface` | #fafafa | #111317 | Main page background |\n| `--primary` | #2563eb | #3b82f6 | Primary accent |\n',
  'utf8',
);
writeFileSync(
  join(mockV3Dir, 'api', 'components', 'Page.md'),
  '# Page\n## Props (PageProps)\n| prop | type | note |\n| --- | --- | --- |\n| `title` | `string` | Page heading |\n',
  'utf8',
);
writeFileSync(
  join(mockV3Dir, 'api', 'components', 'Card.md'),
  '# Card\n## Props (CardProps)\n| prop | type | note |\n| --- | --- | --- |\n| `padded` | `boolean` | Inner padding |\n',
  'utf8',
);
writeFileSync(join(mockV3Dir, 'components', 'bundle.css'), '.mock-card{border:1px solid var(--outline,#e5e7eb);}\n', 'utf8');
writeFileSync(join(mockV3Dir, 'components', 'bundle.js'), 'window.MockUI={Page:function(){},Card:function(){}};\n', 'utf8');
writeFileSync(join(mockV3Dir, 'assets', 'Icons', 'star.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>', 'utf8');

const transport = new StdioClientTransport({
  command: 'node',
  args: [join(PLUGIN_ROOT, 'bin', 'server.mjs')],
  cwd: PLUGIN_ROOT,
  env: {
    ...process.env,
    OPEN_DESIGN_DATA_DIR: tempDataDir,
  },
});

const client = new Client({ name: 'open-design-test-client', version: '2.0.0' });

try {
  await client.connect(transport);

  // 1. Verify tools/list (all v1 + v2 tools)
  const { tools } = await client.listTools();
  const names = new Set(tools.map((t) => t.name));
  for (const reqTool of [
    'open_studio',
    'od_collect_brief',
    'od_list_design_systems',
    'od_set_active_system',
    'od_query_system',
    'od_render',
    'od_sync_to_workspace',
    'od_lint_workspace',
    'od_get_design_system',
    'od_import_design_system',
    'od_sync_upstream_system',
    'od_list_projects',
    'od_create_project',
    'od_create_artifact',
    'od_update_artifact',
    'od_get_artifact',
    'od_lint_artifact',
    'od_export_artifact',
    'od_app_bootstrap',
    'od_app_set_active_system',
    'od_app_inspect_compiled',
    'od_app_sync_to_workspace',
  ]) {
    assert.ok(names.has(reqTool), `Missing expected tool: ${reqTool}`);
  }
  const openStudio = tools.find((t) => t.name === 'open_studio');
  assert.equal(openStudio._meta?.ui?.resourceUri, 'ui://open-design/app.html');
  const odRenderTool = tools.find((t) => t.name === 'od_render');
  assert.equal(odRenderTool._meta?.ui?.resourceUri, 'ui://open-design/app.html');
  const eps = openStudio._meta?.['com.google.antigravity/ui']?.entrypoints || [];
  assert.ok(eps.some((e) => e.type === 'aux_pane') && eps.some((e) => e.type === 'global'));

  const bootstrapTool = tools.find((t) => t.name === 'od_app_bootstrap');
  assert.deepEqual(bootstrapTool._meta?.ui?.visibility, ['app']);
  console.log(`PASS 1: tools/list (${tools.length} tools & v2 entrypoints verified)`);

  // 2. Verify neutral default UI HTML bundle & frameDomains CSP
  const resRead = await client.readResource({ uri: 'ui://open-design/app.html' });
  const content = resRead.contents[0];
  assert.equal(content.mimeType, 'text/html;profile=mcp-app');
  const frameDomains = content._meta?.ui?.csp?.frameDomains || [];
  assert.ok(
    frameDomains.length === 1 && /^http:\/\/127\.0\.0\.1:\d+$/.test(frameDomains[0]),
    `Expected loopback frameDomain, got ${JSON.stringify(frameDomains)}`,
  );
  assert.ok(content.text.includes('Open Design Studio'));
  assert.ok(Buffer.byteLength(content.text, 'utf8') < 500 * 1024, 'Default UI HTML should stay lightweight (< 500 KB)');
  console.log(`PASS 2: Default UI bundle & frameDomains (${frameDomains[0]}) verified`);

  // 3. Dual-Standard Pre-Compiler & od_query_system (mock-claude-v3 + apple od-v1)
  const dsRes = await client.callTool({ name: 'od_list_design_systems', arguments: {} });
  const systems = dsRes.structuredContent.systems;
  assert.ok(systems.some((s) => s.id === 'mock-claude-v3' && s.format === 'claude-v3'));
  const odSystem = systems.find((s) => s.id === 'apple') || systems.find((s) => s.format === 'od-v1');
  assert.ok(odSystem, 'At least one od-v1 design system must be bundled');
  const targetDsId = odSystem.id;

  const v3Digest = await client.callTool({
    name: 'od_query_system',
    arguments: { id: 'mock-claude-v3', aspect: 'digest' },
  });
  assert.equal(v3Digest.structuredContent.componentCount, 2);
  assert.ok(Buffer.byteLength(v3Digest.structuredContent.digest, 'utf8') < 3000, 'Digest must stay compact < 3KB');

  const v3Comps = await client.callTool({
    name: 'od_query_system',
    arguments: { id: 'mock-claude-v3', aspect: 'component', query: 'Page,Card' },
  });
  assert.equal(v3Comps.structuredContent.matched.length, 2);
  assert.ok(v3Comps.structuredContent.matched[0].apiDoc.includes('Props'));

  const odDigest = await client.callTool({
    name: 'od_query_system',
    arguments: { id: targetDsId, aspect: 'digest' },
  });
  assert.ok(odDigest.structuredContent.digest.includes('Runtime & Tokens Link'));
  assert.ok(Buffer.byteLength(odDigest.structuredContent.digest, 'utf8') < 3000);
  console.log(`PASS 3: Dual-standard compiler & od_query_system verified (mock-claude-v3 + ${targetDsId})`);

  // 4. Dynamic ds:// MCP resources
  const dsResRead = await client.readResource({ uri: 'ds://mock-claude-v3/digest' });
  assert.ok(dsResRead.contents[0].text.includes('Mock Claude UI'));
  const odTokensRead = await client.readResource({ uri: `ds://${targetDsId}/tokens.css` });
  assert.ok(odTokensRead.contents[0].text.includes('--'));
  console.log('PASS 4: Dynamic ds:// MCP resources verified');

  // 5. Active State & Single-Step od_render (v1 -> v2 + inspector hook)
  const setActRes = await client.callTool({
    name: 'od_set_active_system',
    arguments: { id: targetDsId, injectionMode: 'auto' },
  });
  assert.equal(setActRes.structuredContent.activeDesignSystemId, targetDsId);

  const r1 = await client.callTool({
    name: 'od_render',
    arguments: {
      title: 'Single-Step Render Page',
      type: 'prototype',
      html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:var(--surface,var(--bg,#fff));color:var(--on-surface,var(--fg,#111));}</style></head><body><main><h1>Hello Open Design</h1></main></body></html>`,
    },
  });
  assert.equal(r1.structuredContent.tab, 'canvas');
  assert.equal(r1.structuredContent.artifact.designSystemId, targetDsId);
  assert.equal(r1.structuredContent.lint.passed, true);
  assert.ok(r1.structuredContent.artifact.previewUrl.includes('/v1/index.html'));

  const r2 = await client.callTool({
    name: 'od_render',
    arguments: {
      projectId: r1.structuredContent.projectId,
      artifactId: r1.structuredContent.artifactId,
      html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:var(--surface,#fff);color:var(--on-surface,#111);}</style></head><body><main><h1>Hello Open Design v2</h1></main></body></html>`,
      note: 'Iterate via od_render',
    },
  });
  assert.equal(r2.structuredContent.artifact.currentVersion, 2);

  // Verify loopback preview auth, token rewrite, inspector injection & traversal blocking
  const previewUrl = r2.structuredContent.artifact.previewUrl;
  const respHtml = await fetch(previewUrl);
  assert.equal(respHtml.status, 200);
  const servedHtml = await respHtml.text();
  assert.ok(servedHtml.includes('data-od-inspector="1"'), 'Loopback HTML must include controlled element picker script');
  const rewrittenMatch = servedHtml.match(/href="(\/ds\/[^"]+\/tokens\.css)"/);
  assert.ok(rewrittenMatch, `Expected rewritten /ds/<token>/${targetDsId}/tokens.css`);
  const respCss = await fetch(`${frameDomains[0]}${rewrittenMatch[1]}`);
  assert.equal(respCss.status, 200);
  const badTokResp = await fetch(previewUrl.replace(/\/p\/[^/]+\//, '/p/wrongtoken/'));
  assert.equal(badTokResp.status, 403);
  const travResp = await fetch(`${frameDomains[0]}/ds/${previewUrl.split('/p/')[1].split('/')[0]}/${targetDsId}/..%2F..%2Fplugin.json`);
  assert.ok(travResp.status === 400 || travResp.status === 403 || travResp.status === 404);
  console.log('PASS 5: Active state, single-step od_render v1->v2, inspector script & preview auth verified');

  // 6. Workspace Sync (.agents/design-system.json binding) & Real Code Lint
  const syncRes = await client.callTool({
    name: 'od_sync_to_workspace',
    arguments: {
      targetDir: tempWsDir,
      mode: 'design-system',
      designSystemId: 'mock-claude-v3',
      bindWorkspace: true,
    },
  });
  assert.ok(existsSync(syncRes.structuredContent.boundConfigPath));
  assert.ok(existsSync(join(syncRes.structuredContent.installedDir, 'tokens.css')));

  const badTsxPath = join(tempWsDir, 'SlopCard.tsx');
  writeFileSync(
    badTsxPath,
    `export function SlopCard() { return <div className="from-purple-500">🚀 Acme Corp</div>; }`,
    'utf8',
  );
  const wsLintRes = await client.callTool({
    name: 'od_lint_workspace',
    arguments: { paths: [tempWsDir] },
  });
  assert.equal(wsLintRes.structuredContent.designSystemId, 'mock-claude-v3', 'Workspace binding must override global active system');
  assert.equal(wsLintRes.structuredContent.passed, false);
  assert.ok(wsLintRes.structuredContent.totalErrors >= 2, 'Should detect neon gradient and emoji');
  console.log('PASS 6: Workspace sync, .agents/design-system.json binding & TSX linter verified');

  // 7. PreInvocation Hook end-to-end test (backend zero-overhead, UI inject once, second turn deduped)
  const hookScript = join(PLUGIN_ROOT, 'scripts', 'pre-invocation-hook.mjs');
  const runHook = (inputObj) => {
    const t0 = Date.now();
    const res = spawnSync('node', [hookScript], {
      cwd: PLUGIN_ROOT,
      input: JSON.stringify(inputObj),
      encoding: 'utf8',
      env: { ...process.env, OPEN_DESIGN_DATA_DIR: tempDataDir },
    });
    assert.equal(res.status, 0, `Hook failed: ${res.stderr}`);
    return { parsed: JSON.parse(res.stdout), ms: Date.now() - t0 };
  };

  const backendHook = runHook({
    conversationId: 'conv-hook-1',
    workspacePaths: [],
    lastUserInput: 'Fix the SQL query index in server.py',
  });
  assert.deepEqual(backendHook.parsed, {});

  const uiHook1 = runHook({
    conversationId: 'conv-hook-1',
    workspacePaths: [tempWsDir],
    lastUserInput: '帮我用当前设计系统做一个产品原型页面',
  });
  assert.ok(Array.isArray(uiHook1.parsed.injectSteps) && uiHook1.parsed.injectSteps.length === 1);
  assert.ok(uiHook1.parsed.injectSteps[0].systemMessage.systemMessage.includes('mock-claude-v3'));

  const uiHook2 = runHook({
    conversationId: 'conv-hook-1',
    workspacePaths: [tempWsDir],
    lastUserInput: '再把按钮改大一点',
  });
  assert.deepEqual(uiHook2.parsed, {}, 'Same conversation must deduplicate digest injection');
  console.log(`PASS 7: PreInvocation hook verified (UI latency=${uiHook1.ms}ms, dedup works)`);

  // 8. Slides HTML/ZIP/PPTX exports
  const slidesRes = await client.callTool({
    name: 'od_render',
    arguments: {
      projectId: r1.structuredContent.projectId,
      title: 'Product Launch Deck',
      type: 'slides',
      designSystemId: targetDsId,
      slides: [
        {
          eyebrow: '01 · OVERVIEW',
          title: 'Q4 Product Architecture',
          body: 'Summary of key delivery metrics across core modules.',
          metrics: [
            { label: 'AVAILABILITY', value: '99.95', unit: '%' },
            { label: 'LATENCY P95', value: '42', unit: 'ms' },
          ],
          bullets: ['Unified token pipeline across web and slides', 'Automated anti-slop validation'],
          notes: 'Start with architecture overview.',
        },
        {
          eyebrow: '02 · ROADMAP',
          title: 'Next Quarter Priorities',
          bullets: ['Expand component coverage', 'Automate regression checks'],
          notes: 'Highlight key engineering milestones.',
        },
      ],
    },
  });
  const slidesArtId = slidesRes.structuredContent.artifactId;
  const projIdForSlides = slidesRes.structuredContent.projectId;

  const htmlExp = await client.callTool({
    name: 'od_export_artifact',
    arguments: { projectId: projIdForSlides, artifactId: slidesArtId, format: 'html', outputDir: tempExportDir },
  });
  assert.ok(existsSync(htmlExp.structuredContent.outputPath));

  const zipExp = await client.callTool({
    name: 'od_export_artifact',
    arguments: { projectId: projIdForSlides, artifactId: slidesArtId, format: 'zip', outputDir: tempExportDir },
  });
  const zipBuf = readFileSync(zipExp.structuredContent.outputPath);
  assert.equal(zipBuf.subarray(0, 2).toString('ascii'), 'PK');

  const pptxExp = await client.callTool({
    name: 'od_export_artifact',
    arguments: { projectId: projIdForSlides, artifactId: slidesArtId, format: 'pptx', outputDir: tempExportDir },
  });
  const pptxBuf = readFileSync(pptxExp.structuredContent.outputPath);
  assert.equal(pptxBuf.subarray(0, 2).toString('ascii'), 'PK');
  const pptxZip = await JSZip.loadAsync(pptxBuf);
  assert.ok(pptxZip.file('ppt/slides/slide1.xml'), 'slide1.xml missing in exported pptx');
  assert.ok(pptxZip.file('ppt/slides/slide2.xml'), 'slide2.xml missing in exported pptx');
  console.log(
    `PASS 8: exports verified (html=${htmlExp.structuredContent.bytes}B, zip=${zipExp.structuredContent.bytes}B, pptx=${pptxExp.structuredContent.bytes}B)`,
  );
} finally {
  await client.close();
  rmSync(tempDataDir, { recursive: true, force: true });
}
