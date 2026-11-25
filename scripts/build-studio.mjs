import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..');
const DIST_DIR = join(PLUGIN_ROOT, 'dist');

mkdirSync(DIST_DIR, { recursive: true });

const res = await esbuild.build({
  entryPoints: [join(PLUGIN_ROOT, 'src', 'studio-client.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  target: ['es2022'],
  minify: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

function safeScript(code) {
  return code.replace(/<\/script/gi, '<\\/script');
}

const studioJs = res.outputFiles[0].text;

const html = `<!doctype html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open Design Studio</title>
</head>
<body>
<div id="od-studio-root"></div>
<script>${safeScript(studioJs)}</script>
</body>
</html>
`;

const outPath = join(DIST_DIR, 'app.html');
writeFileSync(outPath, html, 'utf8');

const sizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`Built dist/app.html (${sizeKb} KB)`);

if (Buffer.byteLength(html, 'utf8') > 2 * 1024 * 1024) {
  throw new Error(`dist/app.html exceeded 2 MiB (${sizeKb} KB)`);
}
if (/<script[^>]+src=/i.test(html) || /<link[^>]+rel=["']stylesheet/i.test(html)) {
  throw new Error('dist/app.html must not reference external scripts or stylesheets');
}
