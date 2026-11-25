import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from '@modelcontextprotocol/ext-apps';
import { z } from 'zod';

type StudioTab = 'canvas' | 'brief' | 'systems' | 'linter' | 'skills';
type ViewportPreset = 'auto' | 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'slide';
type ThemeMode = 'light' | 'dark';
type InspectorTab = 'digest' | 'tokens' | 'components' | 'assets';
type FormatFilter = 'all' | 'od-v1' | 'claude-v3';

const VIEWPORT_WIDTHS: Record<ViewportPreset, string> = {
  auto: '100%',
  desktop: '1440px',
  laptop: '1280px',
  tablet: '768px',
  mobile: '390px',
  slide: '1120px',
};

const DELIVERABLE_TYPES = [
  { id: 'prototype', code: 'UI-01', icon: 'layout', label: '交互原型', desc: '多页面可点击产品流程' },
  { id: 'dashboard', code: 'UI-02', icon: 'sliders', label: '数据看板', desc: '指标读数、状态与图表' },
  { id: 'slides', code: 'DK-03', icon: 'presentation', label: '幻灯片 Slides', desc: '16:9 演示与 PPTX 导出' },
  { id: 'landing', code: 'LP-04', icon: 'sparkles', label: '品牌落地页', desc: '首屏叙事与结构化版面' },
  { id: 'component', code: 'CM-05', icon: 'package', label: '组件试样', desc: '可复用模块与多状态测试' },
  { id: 'motion', code: 'MT-06', icon: 'zap', label: '动态图形', desc: 'HTML/SVG/Canvas 分镜动效' },
] as const;

const app = new App({ name: 'open-design-studio', version: '2.0.0' }, {});

const ICON_PATHS: Record<string, string> = {
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  crosshair: '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  package: '<path d="m16.5 9.4-9-5.19"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  presentation: '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  rotateCcw: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
};

function icon(name: string, size = 14): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.85');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.flexShrink = '0';
  svg.innerHTML = ICON_PATHS[name] || ICON_PATHS.layers;
  return svg;
}

function brandLogoSvg(size = 24): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 128 128');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <rect x="10" y="10" width="108" height="108" rx="24" fill="#0F172A"/>
    <rect x="12" y="12" width="104" height="104" rx="22" stroke="#334155" stroke-opacity="0.7" stroke-width="2"/>
    <rect x="26" y="28" width="52" height="52" rx="10" fill="#1E293B" stroke="#94A3B8" stroke-opacity="0.6" stroke-width="2.5"/>
    <rect x="50" y="48" width="52" height="52" rx="10" fill="#2563EB" stroke="#F8FAFC" stroke-width="4"/>
    <circle cx="88" cy="86" r="5" fill="#38BDF8"/>
  `;
  return svg;
}

const styleEl = document.createElement('style');
styleEl.textContent = `
  :root, [data-theme="light"] {
    --od-bg: var(--color-background-secondary, #f4f6f9);
    --od-surface: var(--color-background-primary, #ffffff);
    --od-surface-2: var(--color-background-tertiary, #eef1f5);
    --od-surface-hover: #f8fafc;
    --od-topbar-bg: rgba(255, 255, 255, 0.86);
    --od-text: var(--color-text-primary, #0f172a);
    --od-muted: var(--color-text-secondary, #64748b);
    --od-border: var(--color-border-primary, #e2e8f0);
    --od-border-strong: var(--color-border-secondary, #cbd5e1);
    --od-accent: #2563eb;
    --od-accent-hover: #1d4ed8;
    --od-accent-fg: #ffffff;
    --od-accent-soft: rgba(37, 99, 235, 0.10);
    --od-success: #16a34a;
    --od-success-bg: rgba(22, 163, 74, 0.11);
    --od-warn: #d97706;
    --od-warn-bg: rgba(217, 119, 6, 0.12);
    --od-danger: #dc2626;
    --od-danger-bg: rgba(220, 38, 38, 0.11);
    --od-dot: rgba(15, 23, 42, 0.085);
    --od-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
    --od-shadow-md: 0 8px 24px -6px rgba(15, 23, 42, 0.09), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
    --od-sans: var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif);
    --od-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
  [data-theme="dark"] {
    --od-bg: var(--color-background-secondary, #0d1017);
    --od-surface: var(--color-background-primary, #151922);
    --od-surface-2: var(--color-background-tertiary, #1c222e);
    --od-surface-hover: #212836;
    --od-topbar-bg: rgba(21, 25, 34, 0.86);
    --od-text: var(--color-text-primary, #f1f5f9);
    --od-muted: var(--color-text-secondary, #94a3b8);
    --od-border: var(--color-border-primary, #262e3d);
    --od-border-strong: var(--color-border-secondary, #364154);
    --od-accent: #3b82f6;
    --od-accent-hover: #60a5fa;
    --od-accent-fg: #ffffff;
    --od-accent-soft: rgba(59, 130, 246, 0.15);
    --od-success: #4ade80;
    --od-success-bg: rgba(74, 222, 128, 0.14);
    --od-warn: #fbbf24;
    --od-warn-bg: rgba(251, 191, 36, 0.14);
    --od-danger: #f87171;
    --od-danger-bg: rgba(248, 113, 113, 0.14);
    --od-dot: rgba(248, 250, 252, 0.075);
    --od-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.25);
    --od-shadow-md: 0 10px 28px -6px rgba(0, 0, 0, 0.45);
  }

  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: var(--od-bg);
    color: var(--od-text);
    font-family: var(--od-sans);
    font-size: 13px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .od-shell { min-height: 100vh; display: flex; flex-direction: column; }

  .od-topbar {
    position: sticky; top: 0; z-index: 30;
    background: var(--od-topbar-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--od-border);
    padding: 10px 20px 0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .od-topbar-row {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
  }
  .od-brand { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .od-title { font-size: 14px; font-weight: 650; margin: 0; letter-spacing: -0.01em; }
  .od-ver-tag {
    font-family: var(--od-mono); font-size: 10px; font-weight: 600;
    padding: 1px 6px; border-radius: 5px;
    background: var(--od-surface-2); color: var(--od-muted); border: 1px solid var(--od-border);
  }

  .od-sys-switcher {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 3px 8px 3px 9px; border-radius: 999px;
    background: var(--od-surface-2); border: 1px solid var(--od-border);
  }
  .od-sys-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    box-shadow: 0 0 0 2px var(--od-surface);
  }
  .od-sys-select {
    background: transparent; border: 0; color: var(--od-text);
    font-family: var(--od-mono); font-size: 11px; font-weight: 600;
    cursor: pointer; padding-right: 4px; outline: none; max-width: 170px;
  }
  .od-sys-select option { background: var(--od-surface); color: var(--od-text); }

  .od-seg {
    display: inline-flex; align-items: center; padding: 2px;
    background: var(--od-surface-2); border: 1px solid var(--od-border);
    border-radius: 7px; gap: 2px;
  }
  .od-seg-btn {
    border: 0; background: transparent; color: var(--od-muted);
    font-family: var(--od-mono); font-size: 11px; font-weight: 500;
    padding: 3px 8px; border-radius: 5px; cursor: pointer;
    transition: background 0.14s ease, color 0.14s ease;
  }
  .od-seg-btn:hover { color: var(--od-text); }
  .od-seg-btn.is-active {
    background: var(--od-surface); color: var(--od-text);
    box-shadow: var(--od-shadow-sm); font-weight: 600;
  }

  .od-tabs { display: flex; gap: 4px; overflow-x: auto; }
  .od-tab {
    display: inline-flex; align-items: center; gap: 6px;
    border: 0; background: transparent; color: var(--od-muted);
    padding: 8px 12px; font-size: 13px; font-weight: 500; cursor: pointer;
    border-bottom: 2px solid transparent; white-space: nowrap;
    transition: color 0.14s ease, border-color 0.14s ease;
  }
  .od-tab:hover { color: var(--od-text); }
  .od-tab.is-active { color: var(--od-accent); border-bottom-color: var(--od-accent); font-weight: 600; }
  .od-tab-badge {
    font-family: var(--od-mono); font-size: 10px; font-weight: 600;
    padding: 1px 6px; border-radius: 999px;
    background: var(--od-surface-2); color: var(--od-muted);
    font-variant-numeric: tabular-nums;
  }
  .od-tab.is-active .od-tab-badge { background: var(--od-accent-soft); color: var(--od-accent); }

  .od-main { flex: 1; padding: 18px 20px 28px; max-width: 1440px; width: 100%; margin: 0 auto; }

  .od-stack { display: flex; flex-direction: column; gap: 14px; }
  .od-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .od-row-between { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
  .od-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .od-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .od-grid-auto { display: grid; grid-template-columns: repeat(auto-fill, minmax(268px, 1fr)); gap: 12px; }
  .od-brief-layout { display: grid; grid-template-columns: minmax(0, 1.5fr) 330px; gap: 16px; align-items: start; }
  .od-comp-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 12px; align-items: start; }
  @media (max-width: 960px) {
    .od-brief-layout, .od-canvas-grid, .od-comp-layout { grid-template-columns: 1fr; }
  }
  @media (max-width: 780px) { .od-grid-2, .od-grid-3 { grid-template-columns: 1fr; } }

  .od-card {
    background: var(--od-surface);
    border: 1px solid var(--od-border);
    border-radius: 10px;
    padding: 15px;
    box-shadow: var(--od-shadow-sm);
  }
  .od-card-hover { transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease; }
  .od-card-hover:hover { border-color: var(--od-border-strong); box-shadow: var(--od-shadow-md); }
  .od-card.is-selected { border-color: var(--od-accent); box-shadow: 0 0 0 1px var(--od-accent-soft); }
  .od-card-compact { padding: 10px 12px; }
  .od-sticky-side { position: sticky; top: 96px; }

  .od-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    border: 1px solid var(--od-border-strong);
    background: var(--od-surface);
    color: var(--od-text);
    border-radius: 7px;
    padding: 6px 11px;
    font-size: 12px; font-weight: 500; font-family: inherit;
    cursor: pointer; white-space: nowrap;
    transition: background 0.14s ease, border-color 0.14s ease, transform 0.1s ease;
  }
  .od-btn:hover { background: var(--od-surface-hover); border-color: var(--od-border-strong); }
  .od-btn:active { transform: translateY(0.5px); }
  .od-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
  .od-btn--primary {
    background: var(--od-accent); border-color: var(--od-accent); color: var(--od-accent-fg);
  }
  .od-btn--primary:hover { background: var(--od-accent-hover); border-color: var(--od-accent-hover); }
  .od-btn--active {
    background: var(--od-accent-soft); border-color: var(--od-accent); color: var(--od-accent);
  }
  .od-btn--ghost { border-color: transparent; background: transparent; color: var(--od-muted); }
  .od-btn--ghost:hover { background: var(--od-surface-2); color: var(--od-text); border-color: transparent; }
  .od-btn--sm { padding: 4px 9px; font-size: 11px; border-radius: 6px; }
  .od-btn--full { width: 100%; }

  .od-btn.is-picking {
    background: var(--od-accent-soft); border-color: var(--od-accent); color: var(--od-accent);
  }
  .od-pulse-dot {
    width: 7px; height: 7px; border-radius: 50%; background: var(--od-success);
    display: inline-block; flex-shrink: 0;
  }
  .od-pulse-dot--accent { background: var(--od-accent); animation: od-pulse 1.4s ease-in-out infinite; }
  @keyframes od-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.45; transform: scale(0.8); }
  }

  .od-pill {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 2px 8px; border-radius: 999px;
    font-family: var(--od-mono); font-size: 11px; font-weight: 500;
    background: var(--od-surface-2); color: var(--od-muted);
    border: 1px solid var(--od-border);
    font-variant-numeric: tabular-nums;
  }
  .od-pill--ok { background: var(--od-success-bg); color: var(--od-success); border-color: transparent; }
  .od-pill--warn { background: var(--od-warn-bg); color: var(--od-warn); border-color: transparent; }
  .od-pill--err { background: var(--od-danger-bg); color: var(--od-danger); border-color: transparent; }
  .od-pill--accent { background: var(--od-accent-soft); color: var(--od-accent); border-color: transparent; }
  .od-pill--btn { cursor: pointer; }

  .od-label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px; color: var(--od-text); }
  .od-muted { color: var(--od-muted); font-size: 12px; }
  .od-mono { font-family: var(--od-mono); font-size: 11px; font-variant-numeric: tabular-nums; }
  .od-input, .od-select, .od-textarea {
    width: 100%;
    background: var(--od-surface);
    color: var(--od-text);
    border: 1px solid var(--od-border-strong);
    border-radius: 7px;
    padding: 7px 10px;
    font-family: inherit; font-size: 13px;
    transition: border-color 0.14s ease, box-shadow 0.14s ease;
  }
  .od-select--inline { width: auto; min-width: 148px; padding: 5px 8px; font-size: 12px; }
  .od-input:focus-visible, .od-select:focus-visible, .od-textarea:focus-visible, .od-btn:focus-visible {
    outline: 2px solid var(--od-accent); outline-offset: 1px;
  }
  .od-range { width: 100%; accent-color: var(--od-accent); cursor: pointer; }

  .od-search-wrap { position: relative; flex: 1; min-width: 220px; }
  .od-search-icon {
    position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
    color: var(--od-muted); pointer-events: none; display: inline-flex;
  }
  .od-search-wrap .od-input { padding-left: 32px; }

  .od-welcome-mat {
    background-color: var(--od-surface);
    background-image: radial-gradient(var(--od-dot) 1px, transparent 1px);
    background-size: 18px 18px;
    border: 1px solid var(--od-border);
    border-radius: 12px;
    padding: 24px;
    box-shadow: var(--od-shadow-sm);
  }
  .od-quick-ds {
    text-align: left; padding: 10px; border-radius: 8px; cursor: pointer;
    background: var(--od-surface); color: var(--od-text);
    border: 1px solid var(--od-border);
    display: flex; flex-direction: column; gap: 6px;
    transition: border-color 0.14s ease, background 0.14s ease;
  }
  .od-quick-ds:hover { border-color: var(--od-border-strong); background: var(--od-surface-hover); }
  .od-quick-ds.is-active { border-color: var(--od-accent); background: var(--od-accent-soft); }

  .od-step-strip {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;
    padding-top: 12px; border-top: 1px solid var(--od-border);
  }
  @media (max-width: 780px) { .od-step-strip { grid-template-columns: 1fr; } }
  .od-step-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; border-radius: 8px; background: var(--od-surface-2); border: 1px solid var(--od-border);
  }
  .od-step-num {
    font-family: var(--od-mono); font-size: 11px; font-weight: 700;
    color: var(--od-accent); background: var(--od-accent-soft);
    padding: 2px 6px; border-radius: 5px;
  }

  .od-canvas-grid {
    display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 14px; align-items: start;
  }
  .od-stage-shell {
    background-color: var(--od-surface-2);
    background-image: radial-gradient(var(--od-dot) 1px, transparent 1px);
    background-size: 16px 16px;
    border: 1px solid var(--od-border);
    border-radius: 10px;
    padding: 14px;
    overflow-x: auto;
    display: flex; flex-direction: column; gap: 10px;
  }
  .od-stage-frame {
    margin: 0 auto; max-width: 100%;
    background: #ffffff;
    border: 1px solid var(--od-border-strong);
    border-radius: 8px; overflow: hidden;
    box-shadow: var(--od-shadow-md);
    display: flex; flex-direction: column;
    transition: width 0.2s ease;
  }
  .od-stage-chrome {
    height: 30px; padding: 0 10px;
    background: var(--od-surface); border-bottom: 1px solid var(--od-border);
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .od-chrome-dots { display: flex; align-items: center; gap: 5px; }
  .od-chrome-dots span { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  .od-stage-body { height: 540px; width: 100%; background: #ffffff; }
  .od-iframe { width: 100%; height: 100%; border: 0; display: block; }

  .od-swatches-banner {
    display: grid; grid-template-columns: repeat(4, 1fr);
    height: 28px; border-radius: 6px; overflow: hidden;
    border: 1px solid var(--od-border); margin: 8px 0 10px;
  }
  .od-swatches {
    display: grid; grid-template-columns: repeat(4, 1fr);
    height: 12px; border-radius: 4px; overflow: hidden;
    border: 1px solid var(--od-border);
  }
  .od-choice-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(158px, 1fr)); gap: 8px;
  }
  .od-choice {
    text-align: left; padding: 11px; border-radius: 8px; cursor: pointer;
    background: var(--od-surface); color: var(--od-text);
    border: 1px solid var(--od-border);
    display: flex; flex-direction: column; gap: 4px;
    transition: border-color 0.14s ease, background 0.14s ease;
  }
  .od-choice:hover { border-color: var(--od-border-strong); background: var(--od-surface-hover); }
  .od-choice.is-active { border-color: var(--od-accent); background: var(--od-accent-soft); }

  .od-meter-track {
    width: 100%; height: 6px; border-radius: 999px; background: var(--od-surface-2); overflow: hidden;
  }
  .od-meter-fill { height: 100%; border-radius: 999px; background: var(--od-accent); transition: width 0.2s ease; }

  .od-pre {
    margin: 0; padding: 12px;
    background: var(--od-surface-2);
    border: 1px solid var(--od-border);
    border-radius: 8px;
    font-family: var(--od-mono); font-size: 12px; line-height: 1.55;
    max-height: 360px; overflow: auto;
    white-space: pre-wrap; word-break: break-word;
  }
  .od-scroll { max-height: 410px; overflow-y: auto; }
  .od-banner {
    padding: 9px 12px; border-radius: 8px;
    background: var(--od-accent-soft); border: 1px solid var(--od-border);
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px;
  }
  .od-list-item {
    padding: 10px 0; border-top: 1px solid var(--od-border);
    display: flex; flex-direction: column; gap: 5px;
  }
  .od-list-item:first-child { border-top: 0; padding-top: 0; }

  .od-issue-card {
    padding: 10px 12px; border-radius: 8px;
    border: 1px solid var(--od-border); background: var(--od-surface-hover);
    border-left: 3px solid var(--od-warn);
    display: flex; flex-direction: column; gap: 5px;
  }
  .od-issue-card.is-error { border-left-color: var(--od-danger); }

  .od-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .od-table th, .od-table td {
    text-align: left; padding: 8px; border-bottom: 1px solid var(--od-border); vertical-align: middle;
  }
  .od-table th { font-family: var(--od-mono); font-size: 11px; color: var(--od-muted); position: sticky; top: 0; background: var(--od-surface); }
  .od-table tr:hover td { background: var(--od-surface-hover); }
  .od-chip {
    display: inline-block; width: 13px; height: 13px; border-radius: 3px;
    border: 1px solid var(--od-border-strong); vertical-align: middle; margin-right: 6px;
  }
  .od-copy-token {
    cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
    padding: 2px 6px; border-radius: 5px; border: 1px solid transparent;
    font-family: var(--od-mono); font-size: 11px; background: transparent; color: var(--od-text);
  }
  .od-copy-token:hover { background: var(--od-surface-2); border-color: var(--od-border); }

  .od-svg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; }
  .od-svg-tile {
    padding: 10px 8px; border: 1px solid var(--od-border); border-radius: 8px; background: var(--od-surface-2);
    display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer;
    font-family: var(--od-mono); font-size: 10px; color: var(--od-muted); text-align: center; word-break: break-all;
    transition: border-color 0.14s ease, color 0.14s ease;
  }
  .od-svg-tile:hover { border-color: var(--od-accent); color: var(--od-text); }
  .od-svg-tile svg { width: 24px; height: 24px; color: var(--od-text); }

  .od-comp-list {
    display: flex; flex-direction: column; gap: 4px; max-height: 340px; overflow-y: auto;
    padding-right: 4px;
  }
  .od-comp-btn {
    text-align: left; border: 1px solid transparent; background: transparent; color: var(--od-text);
    padding: 7px 10px; border-radius: 7px; font-size: 12px; font-family: var(--od-mono);
    cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 6px;
  }
  .od-comp-btn:hover { background: var(--od-surface-2); }
  .od-comp-btn.is-active { background: var(--od-accent-soft); border-color: var(--od-accent); color: var(--od-accent); font-weight: 600; }

  .od-ring-wrap { position: relative; width: 84px; height: 84px; flex-shrink: 0; }
  .od-ring-val {
    position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: var(--od-mono); font-weight: 700; font-size: 20px; line-height: 1; font-variant-numeric: tabular-nums;
  }

  .od-toast {
    position: fixed; right: 18px; bottom: 18px; z-index: 60;
    padding: 9px 14px; border-radius: 8px;
    background: var(--od-text); color: var(--od-surface);
    font-size: 12px; font-weight: 500; box-shadow: var(--od-shadow-md);
    display: inline-flex; align-items: center; gap: 7px;
  }
`;
document.head.appendChild(styleEl);

function toFileUri(filePath: string): string {
  const norm = String(filePath || '').replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(norm)) return `file:///${norm}`;
  return norm.startsWith('/') ? `file://${norm}` : `file:///${norm}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, any> | null = {},
  ...children: Array<Node | string | number | null | undefined | false>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'className') node.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'value' && ('value' in node)) {
      (node as any).value = String(v);
    } else if (k === 'disabled' && typeof v === 'boolean') {
      (node as any).disabled = v;
    } else if (k === 'innerHTML') {
      node.innerHTML = String(v);
    } else {
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const ch of children.flat(Infinity as 1)) {
    if (ch === null || ch === undefined || ch === false) continue;
    node.appendChild(typeof ch === 'string' || typeof ch === 'number' ? document.createTextNode(String(ch)) : ch);
  }
  return node;
}

const state = {
  tab: 'canvas' as StudioTab,
  theme: 'light' as ThemeMode,
  manualTheme: false,
  caps: { message: false, updateModelContext: false, serverTools: false },
  designSystems: [] as any[],
  activeSystemId: '',
  injectionMode: 'auto' as 'auto' | 'always' | 'manual',
  activeDigest: '',
  upstreamCatalog: [] as any[],
  projects: [] as any[],
  activeProjectId: null as string | null,
  activeArtifactId: null as string | null,
  activeVersion: null as number | null,
  artifactDetail: null as any,
  artifactTokensCss: '',
  lintReport: null as any,
  viewport: 'auto' as ViewportPreset,
  renderMode: 'iframe' as 'iframe' | 'shadow',
  pickerEnabled: false,
  slideIndex: 0,
  sampleDsId: '',
  annTarget: '整体版面',
  annText: '',
  exportResult: null as any,
  brief: {
    title: '',
    type: 'prototype',
    designSystemId: '',
    audience: '',
    density: 55,
    variance: 40,
    notes: '',
    projectId: null as string | null,
  },
  systemFilter: 'all' as FormatFilter,
  systemSearch: '',
  showImportDrawer: false,
  inspectedDs: null as any,
  inspectorTab: 'digest' as InspectorTab,
  tokenSearch: '',
  compSearch: '',
  selectedCompName: '',
  syncTargetDir: '',
  syncResult: null as any,
  catalogSearch: '',
  catalogCategory: 'all',
  syncingSlug: null as string | null,
  importPath: '',
  importId: '',
  craftDocs: [] as Array<{ file: string; content: string }>,
  activeCraftFile: 'anti-ai-slop.md',
  skills: [] as Array<{ name: string; description: string }>,
  toast: null as string | null,
};

let toastTimer: number | null = null;
let activeIframe: HTMLIFrameElement | null = null;

function showToast(msg: string) {
  state.toast = msg;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    state.toast = null;
    render();
  }, 2600);
  render();
}

async function copyText(text: string, label = '已复制到剪贴板') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(label);
  } catch {
    showToast('当前环境不支持剪贴板写入');
  }
}

function applyTheme(next: ThemeMode, isManual: boolean) {
  if (isManual) state.manualTheme = true;
  state.theme = next;
  document.documentElement.setAttribute('data-theme', next);
  try {
    applyDocumentTheme(next);
  } catch {
    // ignore outside MCP host
  }
  render();
}

async function callAppTool(name: string, args: Record<string, unknown> = {}) {
  const res = await app.callServerTool({ name, arguments: args });
  if (res.isError) {
    const msg = res.content?.map((c: any) => c.text).join(' ') || `Tool ${name} failed`;
    throw new Error(msg);
  }
  return res.structuredContent as any;
}

async function loadArtifactDetail(projectId: string, artifactId: string, version?: number) {
  const data = await callAppTool('od_app_get_artifact', {
    projectId,
    artifactId,
    ...(version ? { version } : {}),
  });
  state.artifactDetail = data.artifact;
  state.artifactTokensCss = data.tokensCss || '';
  state.lintReport = data.lint || null;
  state.activeVersion = data.artifact?.activeVersion || null;
  state.slideIndex = 0;
  if (data.artifact?.type === 'slides' && state.viewport === 'auto') {
    state.viewport = 'slide';
  }
  render();
}

async function loadBootstrap(projectId?: string | null, artifactId?: string | null) {
  const data = await callAppTool('od_app_bootstrap', {
    ...(projectId ? { projectId } : {}),
    ...(artifactId ? { artifactId } : {}),
  });
  state.designSystems = data.designSystems || [];
  state.activeSystemId =
    data.activeSystemId || state.designSystems.find((s: any) => s.active)?.id || state.designSystems[0]?.id || '';
  if (data.injectionMode) state.injectionMode = data.injectionMode;
  if (typeof data.activeDigest === 'string') state.activeDigest = data.activeDigest;
  state.upstreamCatalog = data.upstreamCatalog || [];
  state.projects = data.projects || [];
  state.craftDocs = data.craftDocs || [];
  state.skills = data.skills || [];

  if (!state.sampleDsId) state.sampleDsId = state.activeSystemId;
  if (!state.brief.designSystemId) state.brief.designSystemId = state.activeSystemId;

  const resolvedProjId = data.activeProject?.id || data.projects?.[0]?.id || null;
  state.activeProjectId = resolvedProjId;

  if (data.activeArtifact && resolvedProjId) {
    state.activeArtifactId = data.activeArtifact.id;
    const ver = data.activeArtifact.activeVersion || data.activeArtifact.currentVersion;
    state.activeVersion = ver;
    await loadArtifactDetail(resolvedProjId, data.activeArtifact.id, ver);
  } else {
    state.activeArtifactId = null;
    state.artifactDetail = null;
    state.lintReport = null;
    render();
  }
}

async function sendToChat(contextText: string, userMessage: string) {
  if (state.caps.updateModelContext && contextText) {
    await app.updateModelContext({ content: [{ type: 'text', text: contextText }] });
  }
  if (state.caps.message) {
    const res = await app.sendMessage({
      role: 'user',
      content: [{ type: 'text', text: userMessage }],
    });
    if (!res?.isError) {
      showToast('已发送至当前对话');
      return;
    }
  }
  await copyText(`${contextText}\n\n${userMessage}`, '已复制上下文与指令到剪贴板');
}

async function handleSetActiveSystem(nextId?: string, nextMode?: 'auto' | 'always' | 'manual') {
  try {
    const res = await callAppTool('od_app_set_active_system', {
      ...(nextId ? { id: nextId } : {}),
      ...(nextMode ? { injectionMode: nextMode } : {}),
    });
    state.activeSystemId = res.activeSystemId;
    state.injectionMode = res.injectionMode;
    state.activeDigest = res.digest || '';
    state.designSystems = state.designSystems.map((s: any) => ({ ...s, active: s.id === res.activeSystemId }));
    state.sampleDsId = res.activeSystemId;
    state.brief.designSystemId = res.activeSystemId;
    showToast(`已切换系统：${res.activeSystemId}（${res.injectionMode}）`);
  } catch (e: any) {
    showToast(e.message || '切换失败');
  }
}

async function handleAttachPill(dsId?: string, digestOverride?: string) {
  const targetId = dsId || state.activeSystemId || state.designSystems[0]?.id;
  if (!targetId) return;
  let digest = digestOverride || (targetId === state.activeSystemId ? state.activeDigest : '');
  let dsName = state.designSystems.find((s: any) => s.id === targetId)?.name || targetId;
  if (!digest) {
    const comp = await callAppTool('od_app_inspect_compiled', { id: targetId });
    digest = comp.digest || '';
    dsName = comp.name || dsName;
  }
  if (state.caps.updateModelContext) {
    await app.updateModelContext({
      content: [
        { type: 'text', text: digest },
        {
          type: 'resource_link',
          uri: `ds://${targetId}/digest`,
          name: `Design System · ${dsName}`,
          mimeType: 'text/markdown',
        },
      ],
    });
    showToast(`已将「${dsName}」挂载到对话输入框`);
  } else {
    await copyText(digest, '已复制系统摘要到剪贴板');
  }
}

async function handleOpenInAuxPane(filePath: string) {
  try {
    const res: any = await app.request(
      {
        method: 'com.google.antigravity/toggle-aux-pane',
        params: { tabType: 'fileView', uri: toFileUri(filePath) },
      },
      z.object({ isError: z.boolean().optional() }).passthrough(),
    );
    if (res?.isError) showToast('当前视图不支持侧栏打开文件');
  } catch {
    showToast('当前视图不支持打开本地文件标签');
  }
}

async function handleCreateSample(overrideDsId?: string) {
  try {
    const dsId = overrideDsId || state.sampleDsId || state.activeSystemId || state.designSystems[0]?.id;
    const res = await callAppTool('od_app_create_sample_project', dsId ? { designSystemId: dsId } : {});
    await loadBootstrap(res.project.id, res.artifact.id);
    state.tab = 'canvas';
    showToast('已创建示例项目');
  } catch (e: any) {
    showToast(e.message || '创建失败');
  }
}

async function handleExport(format: 'html' | 'zip' | 'pptx') {
  if (!state.artifactDetail) return;
  try {
    const res = await callAppTool('od_app_export', {
      projectId: state.artifactDetail.projectId,
      artifactId: state.artifactDetail.id,
      version: state.activeVersion || state.artifactDetail.currentVersion,
      format,
    });
    state.exportResult = res;
    showToast(`已导出 ${format.toUpperCase()}`);
  } catch (e: any) {
    showToast(e.message || '导出失败');
  }
}

function buildShadowBox(html: string, tokensCss: string) {
  const host = el('div', { style: { width: '100%', height: '100%', overflow: 'auto', background: '#ffffff' } });
  const shadow = host.attachShadow({ mode: 'open' });
  const styleTags = [...String(html || '').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join('\n');
  const bodyM = String(html || '').match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyInner = (bodyM ? bodyM[1] : html || '').replace(/<script[\s\S]*?<\/script>/gi, '');
  const st = document.createElement('style');
  st.textContent = `${String(tokensCss || '').replace(/:root/g, ':host, :root')}\n${styleTags.replace(/\bbody\b/g, ':host, .od-shadow-body')}`;
  shadow.appendChild(st);
  const wrap = document.createElement('div');
  wrap.className = 'od-shadow-body';
  wrap.innerHTML = bodyInner;
  shadow.appendChild(wrap);
  return host;
}

function renderPaletteStrip(swatches: any, cls = 'od-swatches'): HTMLElement {
  return el(
    'div',
    { className: cls },
    el('span', { style: { background: swatches?.surface || '#FAFAFA' } }),
    el('span', { style: { background: swatches?.primary || '#2563EB' } }),
    el('span', { style: { background: swatches?.signature || '#0EA5E9' } }),
    el('span', { style: { background: swatches?.frame || '#18181B' } }),
  );
}

function renderCanvasTab(): HTMLElement {
  if (state.projects.length === 0 || !state.artifactDetail) {
    const selectedId = state.sampleDsId || state.activeSystemId || state.designSystems[0]?.id || '';
    return el(
      'div',
      { className: 'od-welcome-mat od-stack' },
      el(
        'div',
        { className: 'od-row-between' },
        el(
          'div',
          { className: 'od-stack', style: { gap: '4px' } },
          el('div', { className: 'od-row' }, el('span', { className: 'od-pill od-pill--accent' }, 'STUDIO WORKBENCH'), el('span', { className: 'od-mono od-muted' }, `${state.designSystems.length} 套设计系统已就绪`)),
          el('h2', { style: { margin: '4px 0 0', fontSize: '18px', fontWeight: '650' } }, '选定设计系统，即刻渲染交互原型与幻灯片'),
          el('p', { className: 'od-muted', style: { margin: '0' } }, '点击下方任意设计系统卡片作为试样基底，或在对话中直接提出 UI 需求由 AG 单步调用 od_render 预览。'),
        ),
        el(
          'div',
          { className: 'od-row' },
          el('button', { type: 'button', className: 'od-btn od-btn--primary', onClick: () => void handleCreateSample() }, icon('sparkles', 14), '生成示例项目'),
          el('button', { type: 'button', className: 'od-btn', onClick: () => { state.tab = 'brief'; render(); } }, icon('fileText', 14), '填写需求简报'),
        ),
      ),
      el(
        'div',
        { className: 'od-grid-auto' },
        state.designSystems.slice(0, 8).map((s: any) =>
          el(
            'button',
            {
              type: 'button',
              className: `od-quick-ds ${selectedId === s.id ? 'is-active' : ''}`,
              onClick: () => {
                state.sampleDsId = s.id;
                render();
              },
            },
            el(
              'div',
              { className: 'od-row-between', style: { width: '100%' } },
              el('strong', { style: { fontSize: '13px' } }, s.name),
              el('span', { className: 'od-mono od-muted' }, s.format.toUpperCase()),
            ),
            renderPaletteStrip(s.swatches),
            el('span', { className: 'od-muted', style: { fontSize: '11px' } }, s.category || s.id),
          ),
        ),
      ),
      el(
        'div',
        { className: 'od-step-strip' },
        [
          ['01', '激活或挂载胶囊', '通过顶部选择器切换全局默认系统，或一键挂载 ds:// 上下文胶囊到输入框。'],
          ['02', '单步 od_render 渲染', 'Agent 按需查一次组件 API 后直接渲染隔离沙盒预览，并自动运行合规体检。'],
          ['03', '点选批注 & 工作区同步', '在画布上点选 DOM 元素批注修订，定稿后同步 tokens 与组件契约到工程目录。'],
        ].map(([num, title, desc]) =>
          el(
            'div',
            { className: 'od-step-item' },
            el('span', { className: 'od-step-num' }, num),
            el('div', null, el('div', { style: { fontWeight: '600', fontSize: '12px' } }, title), el('div', { className: 'od-muted', style: { fontSize: '11px' } }, desc)),
          ),
        ),
      ),
    );
  }

  const art = state.artifactDetail;
  const annotations = art.annotations || [];
  const slides = Array.isArray(art.slides) ? art.slides : null;
  const activeDsObj = state.designSystems.find((s: any) => s.id === art.designSystemId);

  const projSel = el(
    'select',
    {
      className: 'od-select od-select--inline',
      onChange: async (e: any) => { await loadBootstrap(e.target.value, null); },
    },
    state.projects.map((p: any) => el('option', { value: p.id }, p.name)),
  );
  (projSel as HTMLSelectElement).value = state.activeProjectId || '';

  const verSel = el(
    'select',
    {
      className: 'od-select od-select--inline',
      onChange: async (e: any) => { await loadArtifactDetail(art.projectId, art.id, Number(e.target.value)); },
    },
    (art.versions || []).map((v: any) => el('option', { value: String(v.version) }, `v${v.version} · ${v.note || ''}`)),
  );
  (verSel as HTMLSelectElement).value = String(state.activeVersion || '');

  let stageChild: HTMLElement;
  if (state.renderMode === 'iframe' && art.previewUrl) {
    const iframe = el('iframe', {
      src: art.previewUrl,
      className: 'od-iframe',
      sandbox: 'allow-scripts allow-forms allow-same-origin',
      title: art.title,
      onLoad: () => {
        if (state.pickerEnabled) {
          iframe.contentWindow?.postMessage({ type: 'od-inspect-toggle', enabled: true }, '*');
        }
      },
    }) as HTMLIFrameElement;
    activeIframe = iframe;
    stageChild = iframe;
  } else {
    activeIframe = null;
    stageChild = buildShadowBox(art.html || '', state.artifactTokensCss);
  }

  const annTargetInput = el('input', {
    className: 'od-input od-mono',
    value: state.annTarget,
    placeholder: 'Header / 指标卡（或点选元素）',
    onInput: (e: any) => { state.annTarget = e.target.value; },
  });
  const annTextarea = el('textarea', {
    id: 'ann-input',
    className: 'od-textarea',
    rows: 3,
    placeholder: '描述具体的样式、文案或交互修订意见…',
    onInput: (e: any) => { state.annText = e.target.value; },
  });
  (annTextarea as HTMLTextAreaElement).value = state.annText;

  return el(
    'div',
    { className: 'od-stack' },
    el(
      'div',
      { className: 'od-card od-card-compact od-row-between' },
      el(
        'div',
        { className: 'od-row' },
        projSel,
        verSel,
        el('span', { className: 'od-pill' }, art.type),
        activeDsObj ? el('span', { className: 'od-pill' }, activeDsObj.name) : null,
        el(
          'button',
          {
            type: 'button',
            className: `od-pill od-pill--btn ${state.lintReport?.passed ? 'od-pill--ok' : 'od-pill--err'}`,
            title: '点击查看详细体检报告',
            onClick: () => { state.tab = 'linter'; render(); },
          },
          icon('shield', 11),
          state.lintReport ? `${state.lintReport.score} 分` : '未体检',
        ),
        state.activeVersion !== art.currentVersion
          ? el('button', {
              type: 'button',
              className: 'od-btn od-btn--sm',
              onClick: async () => {
                await callAppTool('od_app_rollback', { projectId: art.projectId, artifactId: art.id, version: state.activeVersion });
                await loadArtifactDetail(art.projectId, art.id, state.activeVersion || undefined);
                showToast(`已回滚至 v${state.activeVersion}`);
              },
            }, icon('rotateCcw', 12), '设为当前版本')
          : null,
      ),
      el(
        'div',
        { className: 'od-row' },
        el('button', { type: 'button', className: 'od-btn od-btn--sm', onClick: () => void handleExport('html') }, icon('download', 12), 'HTML'),
        el('button', { type: 'button', className: 'od-btn od-btn--sm', onClick: () => void handleExport('zip') }, icon('package', 12), 'ZIP'),
        el('button', { type: 'button', className: 'od-btn od-btn--sm od-btn--primary', onClick: () => void handleExport('pptx') }, icon('presentation', 12), '导出 PPTX'),
        el('button', { type: 'button', className: 'od-btn od-btn--sm', onClick: () => void handleCreateSample() }, icon('plus', 12), '示例'),
      ),
    ),

    state.exportResult
      ? el(
          'div',
          { className: 'od-banner' },
          el('span', { className: 'od-mono' }, `已导出 ${String(state.exportResult.format).toUpperCase()}：${state.exportResult.outputPath}（${(state.exportResult.bytes / 1024).toFixed(1)} KB）`),
          el(
            'div',
            { className: 'od-row' },
            el('button', { type: 'button', className: 'od-btn od-btn--sm', onClick: () => void handleOpenInAuxPane(state.exportResult.outputPath) }, icon('folder', 12), '在 AG 侧栏打开'),
            el('button', {
              type: 'button',
              className: 'od-btn od-btn--sm',
              onClick: () => void copyText(state.exportResult.outputPath, '已复制导出路径'),
            }, icon('copy', 12), '复制路径'),
          ),
        )
      : null,

    el(
      'div',
      { className: 'od-row-between' },
      el(
        'div',
        { className: 'od-seg', role: 'group', 'aria-label': 'Viewport Presets' },
        ([
          ['auto', '自适应'],
          ['desktop', '1440'],
          ['laptop', '1280'],
          ['tablet', '768'],
          ['mobile', '390'],
          ['slide', '16:9'],
        ] as Array<[ViewportPreset, string]>).map(([id, label]) =>
          el('button', {
            type: 'button',
            className: `od-seg-btn ${state.viewport === id ? 'is-active' : ''}`,
            onClick: () => { state.viewport = id; render(); },
          }, label),
        ),
      ),
      el(
        'div',
        { className: 'od-row' },
        state.renderMode === 'iframe'
          ? el(
              'button',
              {
                type: 'button',
                className: `od-btn od-btn--sm ${state.pickerEnabled ? 'is-picking' : ''}`,
                onClick: () => {
                  state.pickerEnabled = !state.pickerEnabled;
                  activeIframe?.contentWindow?.postMessage({ type: 'od-inspect-toggle', enabled: state.pickerEnabled }, '*');
                  render();
                  showToast(state.pickerEnabled ? '点击画布中任意元素即可自动拾取定位' : '已退出元素点选');
                },
              },
              state.pickerEnabled ? el('span', { className: 'od-pulse-dot od-pulse-dot--accent' }) : icon('crosshair', 12),
              state.pickerEnabled ? '正在拾取元素…' : '点选元素',
            )
          : null,
        el(
          'div',
          { className: 'od-seg', role: 'group', 'aria-label': 'Render Mode' },
          el('button', {
            type: 'button',
            className: `od-seg-btn ${state.renderMode === 'iframe' ? 'is-active' : ''}`,
            onClick: () => { state.renderMode = 'iframe'; render(); },
          }, '沙盒服务'),
          el('button', {
            type: 'button',
            className: `od-seg-btn ${state.renderMode === 'shadow' ? 'is-active' : ''}`,
            onClick: () => { state.renderMode = 'shadow'; state.pickerEnabled = false; render(); },
          }, 'Shadow 兜底'),
        ),
      ),
    ),

    el(
      'div',
      { className: 'od-canvas-grid' },
      el(
        'div',
        { className: 'od-stage-shell' },
        el(
          'div',
          { className: 'od-stage-frame', style: { width: VIEWPORT_WIDTHS[state.viewport] } },
          el(
            'div',
            { className: 'od-stage-chrome' },
            el(
              'div',
              { className: 'od-chrome-dots' },
              el('span', { style: { background: '#ef4444' } }),
              el('span', { style: { background: '#f59e0b' } }),
              el('span', { style: { background: '#22c55e' } }),
            ),
            el('span', { className: 'od-mono od-muted', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, `${art.title || art.id} · v${state.activeVersion}`),
            el('span', { className: 'od-mono od-muted' }, VIEWPORT_WIDTHS[state.viewport]),
          ),
          el('div', { className: 'od-stage-body' }, stageChild),
        ),
        slides
          ? el(
              'div',
              { className: 'od-card od-card-compact od-stack' },
              el(
                'div',
                { className: 'od-row-between' },
                el('span', { className: 'od-mono od-muted' }, `SLIDE DECK · ${state.slideIndex + 1} / ${slides.length}`),
                el(
                  'div',
                  { className: 'od-row' },
                  el('button', {
                    type: 'button',
                    className: 'od-btn od-btn--sm',
                    disabled: state.slideIndex <= 0,
                    onClick: () => {
                      const next = Math.max(0, state.slideIndex - 1);
                      state.slideIndex = next;
                      activeIframe?.contentWindow?.postMessage({ type: 'od-goto-slide', index: next }, '*');
                      render();
                    },
                  }, icon('chevronLeft', 12)),
                  slides.map((_: any, idx: number) =>
                    el('button', {
                      type: 'button',
                      className: `od-btn od-btn--sm ${state.slideIndex === idx ? 'od-btn--active' : ''}`,
                      onClick: () => {
                        state.slideIndex = idx;
                        activeIframe?.contentWindow?.postMessage({ type: 'od-goto-slide', index: idx }, '*');
                        render();
                      },
                    }, String(idx + 1)),
                  ),
                  el('button', {
                    type: 'button',
                    className: 'od-btn od-btn--sm',
                    disabled: state.slideIndex >= slides.length - 1,
                    onClick: () => {
                      const next = Math.min(slides.length - 1, state.slideIndex + 1);
                      state.slideIndex = next;
                      activeIframe?.contentWindow?.postMessage({ type: 'od-goto-slide', index: next }, '*');
                      render();
                    },
                  }, icon('chevronRight', 12)),
                ),
              ),
              el('div', { className: 'od-muted', style: { background: 'var(--od-surface-2)', padding: '8px 10px', borderRadius: '6px' } }, `演讲备注：${slides[state.slideIndex]?.notes || '无'}`),
            )
          : null,
      ),
      el(
        'aside',
        { className: 'od-card od-stack od-sticky-side' },
        el(
          'div',
          { className: 'od-row-between' },
          el('span', { className: 'od-mono od-muted' }, 'PIN & REVISE'),
          el('span', { className: 'od-pill od-pill--accent' }, `${annotations.filter((a: any) => !a.resolved).length} 待改`),
        ),
        el('div', null, el('label', { className: 'od-label' }, '目标元素 / 区域'), annTargetInput),
        el('div', null, el('label', { className: 'od-label', for: 'ann-input' }, '修订批注'), annTextarea),
        el('button', {
          type: 'button',
          className: 'od-btn od-btn--full',
          onClick: async () => {
            if (!state.annText.trim()) { showToast('请先输入批注内容'); return; }
            const res = await callAppTool('od_app_save_annotation', {
              projectId: art.projectId,
              artifactId: art.id,
              action: 'add',
              target: state.annTarget.trim() || '整体版面',
              text: state.annText.trim(),
            });
            art.annotations = res.annotations;
            state.annText = '';
            render();
          },
        }, icon('plus', 13), '记入批注清单'),
        annotations.length === 0
          ? el('div', { className: 'od-muted', style: { padding: '6px 0' } }, '暂无修订记录。开启「点选元素」可直接在画布取样目标节点。')
          : el(
              'div',
              { style: { maxHeight: '260px', overflowY: 'auto' } },
              annotations.map((a: any) =>
                el(
                  'div',
                  { className: 'od-list-item' },
                  el(
                    'div',
                    { className: 'od-row-between' },
                    el('span', { className: 'od-mono', style: { maxWidth: '175px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, a.target),
                    el('span', { className: `od-pill ${a.resolved ? 'od-pill--ok' : 'od-pill--warn'}` }, a.resolved ? '已解决' : '待修订'),
                  ),
                  el('div', { style: { fontSize: '12px' } }, a.text),
                  el('button', {
                    type: 'button',
                    className: 'od-btn od-btn--sm',
                    style: { alignSelf: 'flex-start' },
                    onClick: async () => {
                      const res = await callAppTool('od_app_save_annotation', {
                        projectId: art.projectId,
                        artifactId: art.id,
                        action: 'resolve',
                        annotationId: a.id,
                        resolved: !a.resolved,
                      });
                      art.annotations = res.annotations;
                      render();
                    },
                  }, icon('check', 11), a.resolved ? '重新打开' : '标为已解决'),
                ),
              ),
            ),
        el('button', {
          type: 'button',
          className: 'od-btn od-btn--primary od-btn--full',
          onClick: async () => {
            const openAnns = (art.annotations || []).filter((a: any) => !a.resolved);
            if (openAnns.length === 0) { showToast('请先添加至少一条未解决批注'); return; }
            const ctx = [
              '# Open Design Studio 修订任务',
              `Project ID: ${art.projectId}`,
              `Artifact ID: ${art.id} (v${art.activeVersion})`,
              `Design System: ${art.designSystemId}`,
              '## 待修改批注',
              ...openAnns.map((a: any, i: number) => `${i + 1}. [${a.target}] ${a.text}`),
            ].join('\n');
            await sendToChat(
              ctx,
              `请根据上述批注修改 Open Design Studio 产物 ${art.projectId}/${art.id}（系统：${art.designSystemId}），直接调用单步 od_render 更新下一版本并确保 lint.errors === 0。`,
            );
          },
        }, icon('send', 13), '将批注发回对话迭代'),
      ),
    ),
  );
}

function buildBriefSummaryCard(): HTMLElement {
  const dsId = state.brief.designSystemId || state.activeSystemId || state.designSystems[0]?.id || 'editorial-paper';
  const dsObj = state.designSystems.find((s: any) => s.id === dsId);
  const typeObj = DELIVERABLE_TYPES.find((t) => t.id === state.brief.type) || DELIVERABLE_TYPES[0];

  return el(
    'aside',
    { id: 'od-brief-summary-live', className: 'od-card od-stack od-sticky-side' },
    el(
      'div',
      { className: 'od-row-between' },
      el('span', { className: 'od-mono od-muted' }, 'LIVE BRIEF PREVIEW'),
      el('span', { className: 'od-pill od-pill--accent' }, typeObj.code),
    ),
    el('div', { style: { fontSize: '15px', fontWeight: '650' } }, state.brief.title.trim() || '未命名设计产物'),
    el('div', { className: 'od-muted' }, `受众 / 场景：${state.brief.audience.trim() || '通用展示与审查'}`),
    dsObj
      ? el(
          'div',
          { className: 'od-stack', style: { gap: '6px', padding: '10px', borderRadius: '8px', background: 'var(--od-surface-2)' } },
          el('div', { className: 'od-row-between' }, el('strong', { style: { fontSize: '12px' } }, dsObj.name), el('span', { className: 'od-mono od-muted' }, dsObj.format.toUpperCase())),
          renderPaletteStrip(dsObj.swatches),
        )
      : null,
    el(
      'div',
      { className: 'od-stack', style: { gap: '6px' } },
      el('div', { className: 'od-row-between' }, el('span', { className: 'od-muted' }, '信息密度 Density'), el('span', { className: 'od-mono' }, `${state.brief.density}%`)),
      el('div', { className: 'od-meter-track' }, el('div', { className: 'od-meter-fill', style: { width: `${state.brief.density}%` } })),
      el('div', { className: 'od-row-between' }, el('span', { className: 'od-muted' }, '版式自由度 Variance'), el('span', { className: 'od-mono' }, `${state.brief.variance}%`)),
      el('div', { className: 'od-meter-track' }, el('div', { className: 'od-meter-fill', style: { width: `${state.brief.variance}%` } })),
    ),
    state.brief.notes.trim()
      ? el('div', { className: 'od-muted', style: { fontSize: '12px', borderTop: '1px solid var(--od-border)', paddingTop: '8px' } }, state.brief.notes.trim())
      : null,
  );
}

function refreshBriefSummaryLive() {
  const existing = document.getElementById('od-brief-summary-live');
  if (existing && existing.parentNode) {
    existing.parentNode.replaceChild(buildBriefSummaryCard(), existing);
  }
}

function renderBriefTab(): HTMLElement {
  const dsSel = el(
    'select',
    {
      className: 'od-select',
      onChange: (e: any) => {
        state.brief.designSystemId = e.target.value;
        refreshBriefSummaryLive();
      },
    },
    state.designSystems.map((s: any) => el('option', { value: s.id }, `${s.name} (${s.format}) — ${s.category}`)),
  );
  (dsSel as HTMLSelectElement).value = state.brief.designSystemId;

  const notesEl = el('textarea', {
    className: 'od-textarea',
    rows: 4,
    placeholder: '写明核心模块、关键指标、页数或交互要求…',
    onInput: (e: any) => {
      state.brief.notes = e.target.value;
      refreshBriefSummaryLive();
    },
  });
  (notesEl as HTMLTextAreaElement).value = state.brief.notes;

  return el(
    'div',
    { className: 'od-brief-layout' },
    el(
      'div',
      { className: 'od-card od-stack' },
      el(
        'div',
        { className: 'od-grid-2' },
        el('div', null, el('label', { className: 'od-label' }, '项目 / 产物标题'), el('input', {
          className: 'od-input',
          value: state.brief.title,
          placeholder: '例如：季度产品架构与指标看板',
          onInput: (e: any) => {
            state.brief.title = e.target.value;
            refreshBriefSummaryLive();
          },
        })),
        el('div', null, el('label', { className: 'od-label' }, '目标读者与场景'), el('input', {
          className: 'od-input',
          value: state.brief.audience,
          placeholder: '例如：内部研发评审 / 对外方案汇报',
          onInput: (e: any) => {
            state.brief.audience = e.target.value;
            refreshBriefSummaryLive();
          },
        })),
      ),
      el(
        'div',
        null,
        el('label', { className: 'od-label' }, '交付物类型'),
        el(
          'div',
          { className: 'od-choice-grid' },
          DELIVERABLE_TYPES.map((t) =>
            el(
              'button',
              {
                type: 'button',
                className: `od-choice ${state.brief.type === t.id ? 'is-active' : ''}`,
                onClick: () => { state.brief.type = t.id; render(); },
              },
              el('div', { className: 'od-row-between', style: { width: '100%' } }, icon(t.icon, 15), el('span', { className: 'od-mono od-muted' }, t.code)),
              el('strong', null, t.label),
              el('span', { className: 'od-muted', style: { fontSize: '11px' } }, t.desc),
            ),
          ),
        ),
      ),
      el('div', null, el('label', { className: 'od-label' }, '绑定设计系统'), dsSel),
      el(
        'div',
        { className: 'od-grid-2' },
        el(
          'div',
          null,
          el('label', { className: 'od-label' }, `信息密度 Density · ${state.brief.density}%`),
          el('input', {
            type: 'range', min: 10, max: 95, value: String(state.brief.density), className: 'od-range',
            onInput: (e: any) => {
              state.brief.density = Number(e.target.value);
              const lbl = (e.target as HTMLElement).previousElementSibling;
              if (lbl) lbl.textContent = `信息密度 Density · ${state.brief.density}%`;
              refreshBriefSummaryLive();
            },
          }),
          el('div', { className: 'od-row-between od-muted', style: { fontSize: '11px' } }, el('span', null, '呼吸留白'), el('span', null, '高密读数')),
        ),
        el(
          'div',
          null,
          el('label', { className: 'od-label' }, `版式自由度 Variance · ${state.brief.variance}%`),
          el('input', {
            type: 'range', min: 10, max: 95, value: String(state.brief.variance), className: 'od-range',
            onInput: (e: any) => {
              state.brief.variance = Number(e.target.value);
              const lbl = (e.target as HTMLElement).previousElementSibling;
              if (lbl) lbl.textContent = `版式自由度 Variance · ${state.brief.variance}%`;
              refreshBriefSummaryLive();
            },
          }),
          el('div', { className: 'od-row-between od-muted', style: { fontSize: '11px' } }, el('span', null, '严格栅格'), el('span', null, '自由编排')),
        ),
      ),
      el('div', null, el('label', { className: 'od-label' }, '核心内容、栏目与特殊要求'), notesEl),
      el(
        'div',
        { className: 'od-row-between' },
        el('span', { className: 'od-muted' }, '保存简报后会把绑定系统与完整参数送入当前对话，触发单步 od_render。'),
        el('button', {
          type: 'button',
          className: 'od-btn od-btn--primary',
          onClick: async () => {
            try {
              const dsId = state.brief.designSystemId || state.activeSystemId || state.designSystems[0]?.id || 'editorial-paper';
              const nextBrief = { ...state.brief, designSystemId: dsId };
              const res = await callAppTool('od_app_save_brief', {
                projectId: state.brief.projectId || undefined,
                brief: nextBrief,
              });
              await loadBootstrap(res.project.id, null);
              await sendToChat(
                JSON.stringify({ projectId: res.project.id, brief: nextBrief }, null, 2),
                `请根据这份 Open Design 需求简报，使用设计系统 "${dsId}"（需要精确组件 Props 或 token 时先调一次 od_query_system）直接调用单步 od_render 在项目 ${res.project.id} 中生成 "${nextBrief.type}" 产物并确保 Lint 通过。`,
              );
            } catch (e: any) {
              showToast(e.message || '提交简报失败');
            }
          },
        }, icon('sparkles', 14), '保存简报并让 AG 生成'),
      ),
    ),
    buildBriefSummaryCard(),
  );
}

function renderSystemsTab(): HTMLElement {
  const sysQ = state.systemSearch.trim().toLowerCase();
  const filteredSystems = state.designSystems.filter((s: any) => {
    const fmtOk = state.systemFilter === 'all' || s.format === state.systemFilter;
    const textOk =
      !sysQ ||
      String(s.name || '').toLowerCase().includes(sysQ) ||
      String(s.id || '').toLowerCase().includes(sysQ) ||
      String(s.category || '').toLowerCase().includes(sysQ);
    return fmtOk && textOk;
  });

  const q = state.catalogSearch.trim().toLowerCase();
  const catCategories = ['all', ...Array.from(new Set(state.upstreamCatalog.map((c: any) => c.category).filter(Boolean))).slice(0, 7)];
  const filteredCat = state.upstreamCatalog.filter((c: any) => {
    const catOk = state.catalogCategory === 'all' || c.category === state.catalogCategory;
    const qOk = !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
    return catOk && qOk;
  });

  let inspectorNode: HTMLElement | null = null;
  if (state.inspectedDs) {
    const ds = state.inspectedDs;
    const tq = state.tokenSearch.trim().toLowerCase();
    const filteredTokens = (ds.tokens || []).filter(
      (t: any) => !tq || t.name.toLowerCase().includes(tq) || (t.usage || '').toLowerCase().includes(tq) || (t.group || '').toLowerCase().includes(tq),
    );
    const cq = state.compSearch.trim().toLowerCase();
    const filteredComps = (ds.components || []).filter(
      (c: any) => !cq || c.name.toLowerCase().includes(cq) || (c.summary || '').toLowerCase().includes(cq),
    );
    const activeCompDetail =
      ds.componentDetails?.[state.selectedCompName] ||
      (filteredComps[0] ? ds.componentDetails?.[filteredComps[0].name] : null);

    let subBody: HTMLElement;
    if (state.inspectorTab === 'digest') {
      subBody = el(
        'div',
        { className: 'od-stack' },
        el(
          'div',
          { className: 'od-row-between' },
          el('span', { className: 'od-muted' }, '系统摘要契约（Compact Digest）'),
          el('button', { type: 'button', className: 'od-btn od-btn--sm', onClick: () => void copyText(ds.digest || ds.docContent || '', '已复制摘要契约') }, icon('copy', 12), '复制摘要'),
        ),
        el('pre', { className: 'od-pre' }, ds.digest || ds.docContent || ''),
        ds.runtimeHeadSnippet
          ? el(
              'div',
              { className: 'od-stack', style: { gap: '6px' } },
              el(
                'div',
                { className: 'od-row-between' },
                el('span', { className: 'od-muted' }, '运行时引入头（HTML Head Snippet）'),
                el('button', { type: 'button', className: 'od-btn od-btn--sm', onClick: () => void copyText(ds.runtimeHeadSnippet, '已复制 Head 片段') }, icon('copy', 12), '复制片段'),
              ),
              el('pre', { className: 'od-pre' }, ds.runtimeHeadSnippet),
            )
          : null,
      );
    } else if (state.inspectorTab === 'tokens') {
      subBody = el(
        'div',
        { className: 'od-stack' },
        el(
          'div',
          { className: 'od-search-wrap' },
          el('span', { className: 'od-search-icon' }, icon('search', 14)),
          el('input', {
            className: 'od-input',
            value: state.tokenSearch,
            placeholder: '筛选变量名或用途（如 surface、primary、font），点击变量名可复制…',
            onInput: (e: any) => { state.tokenSearch = e.target.value; render(); },
          }),
        ),
        el(
          'div',
          { className: 'od-scroll' },
          el(
            'table',
            { className: 'od-table' },
            el('thead', null, el('tr', null, el('th', null, 'TOKEN (CLICK TO COPY)'), el('th', null, 'LIGHT'), el('th', null, 'DARK'), el('th', null, 'USAGE'))),
            el(
              'tbody',
              null,
              filteredTokens.slice(0, 100).map((t: any) =>
                el(
                  'tr',
                  null,
                  el('td', null, el('button', { type: 'button', className: 'od-copy-token', onClick: () => void copyText(`var(${t.name})`, `已复制 var(${t.name})`) }, t.name, icon('copy', 11))),
                  el('td', null, /^#|rgb/i.test(t.light) ? el('span', { className: 'od-chip', style: { background: t.light } }) : null, t.light),
                  el('td', null, /^#|rgb/i.test(t.dark) ? el('span', { className: 'od-chip', style: { background: t.dark } }) : null, t.dark || '—'),
                  el('td', null, t.usage || t.group || ''),
                ),
              ),
            ),
          ),
        ),
      );
    } else if (state.inspectorTab === 'components') {
      subBody = el(
        'div',
        { className: 'od-stack' },
        el(
          'div',
          { className: 'od-search-wrap' },
          el('span', { className: 'od-search-icon' }, icon('search', 14)),
          el('input', {
            className: 'od-input',
            value: state.compSearch,
            placeholder: '搜索组件名或功能…',
            onInput: (e: any) => { state.compSearch = e.target.value; render(); },
          }),
        ),
        filteredComps.length === 0
          ? el('div', { className: 'od-muted' }, '未匹配到组件 API 文档。')
          : el(
              'div',
              { className: 'od-comp-layout' },
              el(
                'div',
                { className: 'od-comp-list' },
                filteredComps.map((c: any) =>
                  el(
                    'button',
                    {
                      type: 'button',
                      className: `od-comp-btn ${activeCompDetail?.name === c.name ? 'is-active' : ''}`,
                      onClick: () => { state.selectedCompName = c.name; render(); },
                    },
                    el('span', null, c.name),
                    el('span', { className: 'od-muted', style: { fontSize: '10px' } }, c.group || ''),
                  ),
                ),
              ),
              activeCompDetail
                ? el(
                    'div',
                    { className: 'od-stack', style: { gap: '8px' } },
                    el(
                      'div',
                      { className: 'od-row-between' },
                      el('div', null, el('strong', null, activeCompDetail.name), ' ', el('span', { className: 'od-muted' }, `· ${activeCompDetail.summary || activeCompDetail.group || ''}`)),
                      el('button', { type: 'button', className: 'od-btn od-btn--sm', onClick: () => void copyText(activeCompDetail.apiDoc || activeCompDetail.dts || '', `已复制 ${activeCompDetail.name} API`) }, icon('copy', 12), '复制 API'),
                    ),
                    el('pre', { className: 'od-pre' }, activeCompDetail.apiDoc || activeCompDetail.dts || '暂无详细文档'),
                  )
                : el('div', { className: 'od-muted' }, '请选择左侧组件查看 Props 与示例。'),
            ),
      );
    } else {
      subBody = el(
        'div',
        { className: 'od-stack' },
        el(
          'div',
          { className: 'od-grid-2' },
          el('input', {
            className: 'od-input',
            value: state.syncTargetDir,
            placeholder: '/path/to/your-project',
            onInput: (e: any) => { state.syncTargetDir = e.target.value; },
          }),
          el(
            'div',
            { className: 'od-row' },
            el('button', {
              type: 'button',
              className: 'od-btn od-btn--primary',
              onClick: async () => {
                if (!state.syncTargetDir.trim()) { showToast('请先填写目标工作区目录路径'); return; }
                try {
                  const res = await callAppTool('od_app_sync_to_workspace', {
                    targetDir: state.syncTargetDir.trim(),
                    mode: 'design-system',
                    designSystemId: ds.id,
                    bindWorkspace: true,
                  });
                  state.syncResult = res;
                  showToast(`已同步 ${res.filesWrittenCount} 个文件并绑定工作区`);
                } catch (e: any) {
                  showToast(e.message || '同步失败');
                }
              },
            }, icon('folder', 13), '同步并绑定工作区'),
            state.syncResult?.boundConfigPath
              ? el('button', { type: 'button', className: 'od-btn', onClick: () => void handleOpenInAuxPane(state.syncResult.boundConfigPath) }, '打开绑定配置')
              : null,
          ),
        ),
        ds.svgAssets?.length > 0
          ? el(
              'div',
              { className: 'od-svg-grid' },
              ds.svgAssets.map((a: any) =>
                el(
                  'button',
                  {
                    type: 'button',
                    className: 'od-svg-tile',
                    title: '点击复制 SVG 源码',
                    onClick: () => void copyText(a.svg || a.name, `已复制 SVG：${a.name}`),
                  },
                  el('span', { innerHTML: a.svg }),
                  el('span', null, a.name.replace(/\.svg$/, '')),
                ),
              ),
            )
          : el('div', { className: 'od-muted' }, '该系统包内无内置 SVG 矢量目录。'),
      );
    }

    inspectorNode = el(
      'div',
      { className: 'od-card od-stack', style: { borderColor: 'var(--od-accent)' } },
      el(
        'div',
        { className: 'od-row-between' },
        el('div', { className: 'od-row' }, el('span', { className: 'od-pill od-pill--accent' }, 'INSPECTOR'), el('strong', null, ds.name), el('span', { className: 'od-mono od-muted' }, `${ds.id} · ${ds.format}`)),
        el(
          'div',
          { className: 'od-row' },
          el('button', { type: 'button', className: 'od-btn od-btn--sm', onClick: () => void handleSetActiveSystem(ds.id) }, '设为默认'),
          el('button', { type: 'button', className: 'od-btn od-btn--sm', onClick: () => void handleAttachPill(ds.id, ds.digest) }, icon('link', 12), '挂载胶囊'),
          el('button', {
            type: 'button',
            className: 'od-btn od-btn--sm',
            onClick: async () => {
              const res = await callAppTool('od_app_export', { format: 'design-system', designSystemId: ds.id });
              showToast(`已导出至 ${res.outputPath}`);
            },
          }, icon('download', 12), '导出包'),
          el('button', { type: 'button', className: 'od-btn od-btn--sm od-btn--ghost', onClick: () => { state.inspectedDs = null; render(); } }, '收起'),
        ),
      ),
      el(
        'div',
        { className: 'od-seg', style: { alignSelf: 'flex-start' } },
        ([
          ['digest', '摘要契约'],
          ['tokens', `Tokens (${ds.tokens?.length || 0})`],
          ['components', `组件 API (${ds.components?.length || 0})`],
          ['assets', `SVG & 工作区同步 (${ds.svgAssets?.length || 0})`],
        ] as Array<[InspectorTab, string]>).map(([id, label]) =>
          el('button', {
            type: 'button',
            className: `od-seg-btn ${state.inspectorTab === id ? 'is-active' : ''}`,
            onClick: () => { state.inspectorTab = id; render(); },
          }, label),
        ),
      ),
      subBody,
    );
  }

  return el(
    'div',
    { className: 'od-stack' },
    el(
      'div',
      { className: 'od-row-between' },
      el(
        'div',
        { className: 'od-row', style: { flex: '1' } },
        el(
          'div',
          { className: 'od-search-wrap', style: { maxWidth: '340px' } },
          el('span', { className: 'od-search-icon' }, icon('search', 14)),
          el('input', {
            className: 'od-input',
            value: state.systemSearch,
            placeholder: '筛选已安装系统（名称 / ID / 分类）…',
            onInput: (e: any) => { state.systemSearch = e.target.value; render(); },
          }),
        ),
        el(
          'div',
          { className: 'od-seg' },
          ([
            ['all', `全部 (${state.designSystems.length})`],
            ['od-v1', 'OD-V1'],
            ['claude-v3', 'CLAUDE-V3'],
          ] as Array<[FormatFilter, string]>).map(([id, label]) =>
            el('button', {
              type: 'button',
              className: `od-seg-btn ${state.systemFilter === id ? 'is-active' : ''}`,
              onClick: () => { state.systemFilter = id; render(); },
            }, label),
          ),
        ),
      ),
      el(
        'button',
        {
          type: 'button',
          className: `od-btn ${state.showImportDrawer ? 'od-btn--active' : ''}`,
          onClick: () => { state.showImportDrawer = !state.showImportDrawer; render(); },
        },
        icon('upload', 14),
        state.showImportDrawer ? '收起导入面板' : '导入本地系统',
      ),
    ),

    state.showImportDrawer
      ? el(
          'div',
          { className: 'od-card od-stack' },
          el('div', { className: 'od-label' }, '导入本地设计系统包（兼容 Open Design v1 与 Claude Design v3）'),
          el(
            'div',
            { className: 'od-grid-2' },
            el('input', {
              className: 'od-input',
              value: state.importPath,
              placeholder: '/path/to/design-system-folder-or.zip',
              onInput: (e: any) => { state.importPath = e.target.value; },
            }),
            el('input', {
              className: 'od-input',
              value: state.importId,
              placeholder: '自定义系统 slug（可选，留空自动识别）',
              onInput: (e: any) => { state.importId = e.target.value; },
            }),
          ),
          el(
            'div',
            { className: 'od-row' },
            el('button', {
              type: 'button',
              className: 'od-btn od-btn--primary',
              onClick: async () => {
                if (!state.importPath.trim()) { showToast('请填写本地目录或 .zip 路径'); return; }
                try {
                  const res = await callAppTool('od_app_import_ds', {
                    sourcePath: state.importPath.trim(),
                    ...(state.importId.trim() ? { id: state.importId.trim() } : {}),
                  });
                  state.importPath = '';
                  state.importId = '';
                  state.showImportDrawer = false;
                  await loadBootstrap(state.activeProjectId, state.activeArtifactId);
                  showToast(`已导入 ${res.system?.name || ''}`);
                } catch (e: any) {
                  showToast(e.message || '导入失败');
                }
              },
            }, '导入并编译至 Studio 库'),
          ),
        )
      : null,

    el(
      'div',
      { className: 'od-grid-auto' },
      filteredSystems.map((s: any) =>
        el(
          'div',
          { className: `od-card od-card-hover ${state.inspectedDs?.id === s.id || s.active ? 'is-selected' : ''}` },
          el(
            'div',
            { className: 'od-row-between' },
            el('span', { className: 'od-mono od-muted' }, s.format.toUpperCase()),
            s.active
              ? el('span', { className: 'od-pill od-pill--ok' }, el('span', { className: 'od-pulse-dot' }), '当前激活')
              : el('span', { className: 'od-pill' }, s.id),
          ),
          el('div', { style: { fontWeight: '650', fontSize: '14px', marginTop: '6px' } }, s.name),
          renderPaletteStrip(s.swatches, 'od-swatches-banner'),
          el('div', { className: 'od-muted', style: { minHeight: '36px' } }, s.description || s.category),
          el(
            'div',
            { className: 'od-row', style: { marginTop: '12px' } },
            !s.active ? el('button', { type: 'button', className: 'od-btn od-btn--sm', onClick: () => void handleSetActiveSystem(s.id) }, '设为默认') : null,
            el('button', { type: 'button', className: 'od-btn od-btn--sm', onClick: () => void handleAttachPill(s.id) }, icon('link', 11), '挂载'),
            el('button', {
              type: 'button',
              className: 'od-btn od-btn--sm od-btn--primary',
              onClick: async () => {
                try {
                  const res = await callAppTool('od_app_inspect_compiled', { id: s.id });
                  state.inspectedDs = res;
                  state.inspectorTab = 'digest';
                  state.tokenSearch = '';
                  state.compSearch = '';
                  state.selectedCompName = res.components?.[0]?.name || '';
                  state.syncResult = null;
                  render();
                } catch (e: any) {
                  showToast(e.message || '读取失败');
                }
              },
            }, '深入检视'),
          ),
        ),
      ),
    ),

    inspectorNode,

    el(
      'div',
      { className: 'od-card od-stack' },
      el(
        'div',
        { className: 'od-row-between' },
        el('div', { className: 'od-label', style: { marginBottom: '0' } }, `官方上游目录 (${state.upstreamCatalog.length} 套设计系统按需拉取)`),
        el(
          'div',
          { className: 'od-row' },
          catCategories.map((cat) =>
            el('button', {
              type: 'button',
              className: `od-btn od-btn--sm ${state.catalogCategory === cat ? 'od-btn--active' : ''}`,
              onClick: () => { state.catalogCategory = cat; render(); },
            }, cat === 'all' ? '全部分类' : cat),
          ),
        ),
      ),
      el(
        'div',
        { className: 'od-search-wrap' },
        el('span', { className: 'od-search-icon' }, icon('search', 14)),
        el('input', {
          className: 'od-input',
          value: state.catalogSearch,
          placeholder: '输入品牌名或分类（如 stripe、linear、notion）…',
          onInput: (e: any) => { state.catalogSearch = e.target.value; render(); },
        }),
      ),
      el(
        'div',
        { className: 'od-scroll' },
        el(
          'div',
          { className: 'od-grid-2' },
          filteredCat.slice(0, 60).map((c: any) =>
            el(
              'div',
              { className: 'od-card od-card-compact', style: { background: 'var(--od-surface-2)' } },
              el(
                'div',
                { className: 'od-row-between' },
                el('div', null, el('strong', { style: { fontSize: '12px' } }, c.name), ' ', el('span', { className: 'od-mono od-muted' }, c.slug)),
                c.installed
                  ? el('span', { className: 'od-pill od-pill--ok' }, '已安装')
                  : el('button', {
                      type: 'button',
                      className: 'od-btn od-btn--sm',
                      disabled: state.syncingSlug === c.slug,
                      onClick: async () => {
                        state.syncingSlug = c.slug;
                        render();
                        try {
                          await callAppTool('od_app_sync_upstream', { slug: c.slug });
                          await loadBootstrap(state.activeProjectId, state.activeArtifactId);
                          showToast(`已安装 ${c.slug}`);
                        } catch (e: any) {
                          showToast(e.message || '拉取失败');
                        } finally {
                          state.syncingSlug = null;
                          render();
                        }
                      },
                    }, state.syncingSlug === c.slug ? '拉取中…' : '拉取安装'),
              ),
              el('div', { className: 'od-muted', style: { fontSize: '11px', marginTop: '4px' } }, `${c.category} · ${c.description || c.slug}`),
            ),
          ),
        ),
      ),
    ),
  );
}

function renderScoreRing(score: number, passed: boolean): HTMLElement {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = c - (pct / 100) * c;
  const stroke = passed ? 'var(--od-success)' : score >= 70 ? 'var(--od-warn)' : 'var(--od-danger)';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '84');
  svg.setAttribute('height', '84');
  svg.setAttribute('viewBox', '0 0 84 84');
  svg.innerHTML = `
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--od-border)" stroke-width="6"/>
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="${stroke}" stroke-width="6"
      stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
      transform="rotate(-90 42 42)"/>
  `;

  return el(
    'div',
    { className: 'od-ring-wrap' },
    svg,
    el('div', { className: 'od-ring-val', style: { color: stroke } }, String(score)),
  );
}

function renderLinterTab(): HTMLElement {
  const activeDoc = state.craftDocs.find((d) => d.file === state.activeCraftFile) || state.craftDocs[0];
  const rpt = state.lintReport;
  const errorsCount = (rpt?.issues || []).filter((i: any) => i.severity === 'error').length;
  const warnsCount = (rpt?.issues || []).filter((i: any) => i.severity !== 'error').length;

  return el(
    'div',
    { className: 'od-stack' },
    el(
      'div',
      { className: 'od-card od-stack' },
      el(
        'div',
        { className: 'od-row-between' },
        el(
          'div',
          { className: 'od-row', style: { gap: '16px' } },
          rpt ? renderScoreRing(rpt.score ?? 0, Boolean(rpt.passed)) : null,
          el(
            'div',
            { className: 'od-stack', style: { gap: '4px' } },
            el('div', { className: 'od-mono od-muted' }, 'DETERMINISTIC LINTER · 确定性工艺合规审计'),
            el('h3', { style: { margin: '0', fontSize: '16px' } }, !rpt ? '尚未选定预览产物' : rpt.passed ? '已通过 Anti-AI-Slop 与系统规范门禁' : '检测到规范违规项，建议立即修复'),
            rpt
              ? el(
                  'div',
                  { className: 'od-row' },
                  el('span', { className: `od-pill ${errorsCount === 0 ? 'od-pill--ok' : 'od-pill--err'}` }, `${errorsCount} 错误`),
                  el('span', { className: `od-pill ${warnsCount === 0 ? 'od-pill--ok' : 'od-pill--warn'}` }, `${warnsCount} 建议`),
                )
              : el('div', { className: 'od-muted' }, '请先在「画布」选定或创建产物，系统会自动执行静态规则检查。'),
          ),
        ),
        rpt && rpt.issues?.length > 0 && state.artifactDetail
          ? el('button', {
              type: 'button',
              className: 'od-btn od-btn--primary',
              onClick: () =>
                void sendToChat(
                  [
                    '# Open Design Linter 修复任务',
                    `Project: ${state.artifactDetail.projectId}, Artifact: ${state.artifactDetail.id}, DesignSystem: ${state.artifactDetail.designSystemId}`,
                    ...rpt.issues.map((i: any) => `- [${i.severity}] ${i.rule}: ${i.message}（建议：${i.hint}）`),
                  ].join('\n'),
                  `请读取产物 ${state.artifactDetail.projectId}/${state.artifactDetail.id} 并修复以上全部 Linter 违规项，直接调用单步 od_render 更新版本并确保 lint.errors === 0。`,
                ),
            }, icon('send', 13), '发给 AG 一键修复')
          : null,
      ),
      rpt && rpt.issues.length > 0
        ? el(
            'div',
            { className: 'od-stack', style: { gap: '8px' } },
            rpt.issues.map((iss: any) =>
              el(
                'div',
                { className: `od-issue-card ${iss.severity === 'error' ? 'is-error' : ''}` },
                el('div', { className: 'od-row' }, el('span', { className: `od-pill ${iss.severity === 'error' ? 'od-pill--err' : 'od-pill--warn'}` }, iss.severity.toUpperCase()), el('span', { className: 'od-mono' }, iss.rule)),
                el('strong', null, iss.message),
                el('div', { className: 'od-muted' }, iss.hint),
              ),
            ),
          )
        : null,
    ),

    el(
      'div',
      { className: 'od-card od-stack' },
      el(
        'div',
        { className: 'od-row-between' },
        el('div', { className: 'od-label', style: { marginBottom: '0' } }, `上游工艺准则 (${state.craftDocs.length} 篇)`),
        activeDoc ? el('button', { type: 'button', className: 'od-btn od-btn--sm', onClick: () => void copyText(activeDoc.content, '已复制准则全文') }, icon('copy', 12), '复制准则') : null,
      ),
      state.craftDocs.length > 0
        ? el(
            'div',
            { className: 'od-seg', style: { alignSelf: 'flex-start', flexWrap: 'wrap' } },
            state.craftDocs.map((d) =>
              el('button', {
                type: 'button',
                className: `od-seg-btn ${d.file === activeDoc?.file ? 'is-active' : ''}`,
                onClick: () => { state.activeCraftFile = d.file; render(); },
              }, d.file.replace(/\.md$/, '')),
            ),
          )
        : el('div', { className: 'od-muted' }, '正在加载或暂无上游工艺准则文档。'),
      activeDoc ? el('pre', { className: 'od-pre' }, activeDoc.content) : null,
    ),
  );
}

function renderSkillsTab(): HTMLElement {
  if (state.skills.length === 0) {
    return el('div', { className: 'od-card od-muted' }, '正在加载工作流技能目录…');
  }
  return el(
    'div',
    { className: 'od-grid-2' },
    state.skills.map((sk, idx) =>
      el(
        'div',
        { className: 'od-card od-card-hover od-stack', style: { justifyContent: 'space-between' } },
        el(
          'div',
          { className: 'od-stack', style: { gap: '8px' } },
          el(
            'div',
            { className: 'od-row-between' },
            el('span', { className: 'od-pill od-pill--accent' }, `SKILL 0${idx + 1}`),
            el('button', {
              type: 'button',
              className: 'od-btn od-btn--sm',
              onClick: () =>
                void sendToChat(
                  `Skill: ${sk.name}`,
                  `请激活技能 ${sk.name}，在 Open Design Studio 中开始设计任务（优先使用当前激活系统并调 od_render 预览）。`,
                ),
            }, icon('sparkles', 12), '在对话中使用'),
          ),
          el('div', { style: { fontWeight: '650', fontSize: '14px' } }, sk.name),
          el('div', { className: 'od-muted' }, sk.description),
        ),
      ),
    ),
  );
}

function render() {
  const root = document.getElementById('od-studio-root');
  if (!root) return;
  root.innerHTML = '';

  const activeDs = state.designSystems.find((s: any) => s.id === state.activeSystemId);
  const lintBadge = state.lintReport
    ? `${state.lintReport.score}`
    : null;

  const tabsList: Array<{ id: StudioTab; iconName: string; label: string; badge?: string | null }> = [
    { id: 'canvas', iconName: 'layout', label: '画布' },
    { id: 'brief', iconName: 'fileText', label: '简报' },
    { id: 'systems', iconName: 'palette', label: '系统库', badge: state.designSystems.length ? String(state.designSystems.length) : null },
    { id: 'linter', iconName: 'shield', label: '规范体检', badge: lintBadge },
    { id: 'skills', iconName: 'zap', label: '工作流技能', badge: state.skills.length ? String(state.skills.length) : null },
  ];

  let body: HTMLElement;
  if (state.tab === 'canvas') body = renderCanvasTab();
  else if (state.tab === 'brief') body = renderBriefTab();
  else if (state.tab === 'systems') body = renderSystemsTab();
  else if (state.tab === 'linter') body = renderLinterTab();
  else body = renderSkillsTab();

  const dsSelect = el(
    'select',
    {
      className: 'od-sys-select',
      'aria-label': 'Active Design System',
      onChange: (e: any) => {
        if (e.target.value) void handleSetActiveSystem(e.target.value);
      },
    },
    state.designSystems.length > 0
      ? state.designSystems.map((s: any) => el('option', { value: s.id }, s.name))
      : el('option', { value: state.activeSystemId || '' }, state.activeSystemId || 'Loading…'),
  );
  (dsSelect as HTMLSelectElement).value = state.activeSystemId || '';

  const shell = el(
    'div',
    { className: 'od-shell' },
    el(
      'header',
      { className: 'od-topbar' },
      el(
        'div',
        { className: 'od-topbar-row' },
        el(
          'div',
          { className: 'od-brand' },
          brandLogoSvg(24),
          el('h1', { className: 'od-title' }, 'Open Design Studio'),
          el('span', { className: 'od-ver-tag' }, 'v2.0'),
          el(
            'div',
            { className: 'od-sys-switcher', title: '快速切换当前全局激活设计系统' },
            el('span', { className: 'od-sys-dot', style: { background: activeDs?.swatches?.primary || 'var(--od-accent)' } }),
            dsSelect,
          ),
        ),
        el(
          'div',
          { className: 'od-row' },
          el(
            'div',
            { className: 'od-seg', title: 'PreInvocation 上下文自动注入策略' },
            (['auto', 'always', 'manual'] as const).map((m) =>
              el('button', {
                type: 'button',
                className: `od-seg-btn ${state.injectionMode === m ? 'is-active' : ''}`,
                onClick: () => void handleSetActiveSystem(undefined, m),
              }, m.toUpperCase()),
            ),
          ),
          el('button', {
            type: 'button',
            className: 'od-btn od-btn--sm od-btn--active',
            title: '将当前激活设计系统挂载到 AG 对话输入框上下文胶囊',
            onClick: () => void handleAttachPill(),
          }, icon('link', 12), '挂载到对话'),
          el('button', {
            type: 'button',
            className: 'od-btn od-btn--sm',
            'aria-label': '切换浅色/深色主题',
            onClick: () => applyTheme(state.theme === 'dark' ? 'light' : 'dark', true),
          }, icon(state.theme === 'dark' ? 'moon' : 'sun', 13), state.theme === 'dark' ? 'Dark' : 'Light'),
        ),
      ),
      el(
        'nav',
        { className: 'od-tabs', 'aria-label': 'Studio Navigation' },
        tabsList.map((t) =>
          el(
            'button',
            {
              type: 'button',
              className: `od-tab ${state.tab === t.id ? 'is-active' : ''}`,
              onClick: () => { state.tab = t.id; render(); },
            },
            icon(t.iconName, 14),
            t.label,
            t.badge ? el('span', { className: 'od-tab-badge' }, t.badge) : null,
          ),
        ),
      ),
    ),
    el('main', { className: 'od-main' }, body),
    state.toast ? el('div', { className: 'od-toast', role: 'status' }, icon('check', 13), state.toast) : null,
  );

  root.appendChild(shell);
}

app.ontoolinput = (params) => {
  const args = (params?.arguments || {}) as any;
  if (args.tab) state.tab = args.tab;
  if (args.designSystemId) state.brief.designSystemId = args.designSystemId;
  render();
};

app.ontoolresult = async (result) => {
  const sc = (result?.structuredContent || {}) as any;
  if (sc.tab) state.tab = sc.tab;
  if (sc.briefDraft) state.brief = { ...state.brief, ...sc.briefDraft };
  if (sc.projectId || sc.artifactId) {
    try {
      await loadBootstrap(sc.projectId, sc.artifactId);
    } catch {
      render();
    }
  } else {
    render();
  }
};

app.onhostcontextchanged = (ctx) => {
  if (!state.manualTheme && (ctx?.theme === 'light' || ctx?.theme === 'dark')) {
    applyTheme(ctx.theme, false);
  }
  if (ctx?.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
};

window.addEventListener('message', (e: MessageEvent) => {
  if (e.data && e.data.type === 'od-element-picked') {
    const sel = String(e.data.selector || e.data.tagName || 'element');
    const txt = String(e.data.textPreview || '').trim();
    state.annTarget = txt ? `${sel} ("${txt}")` : sel;
    state.pickerEnabled = false;
    activeIframe?.contentWindow?.postMessage({ type: 'od-inspect-toggle', enabled: false }, '*');
    render();
    showToast(`已选中元素：${sel}`);
    document.getElementById('ann-input')?.focus();
  }
});

render();

(async () => {
  try {
    await app.connect();
    const hc = app.getHostCapabilities();
    state.caps = {
      message: Boolean(hc?.message),
      updateModelContext: Boolean(hc?.updateModelContext),
      serverTools: Boolean(hc?.serverTools),
    };
    const ctx = app.getHostContext();
    if (ctx?.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
    if (!state.manualTheme && (ctx?.theme === 'light' || ctx?.theme === 'dark')) {
      applyTheme(ctx.theme, false);
    }
    if (state.caps.serverTools) {
      await loadBootstrap();
    }
  } catch {
    render();
  }
})();
