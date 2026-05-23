import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GradientFrameConfig {
  type: "gradient";
  colors: string[];         // 2–8 hex color stops for conic-gradient
  duration: number;         // animation duration in seconds
  animationStyle: "spin" | "pulse" | "static";
  thickness: number;        // border width in px
}

export interface HudFrameConfig {
  type: "hud";
  hudType: "grid" | "command";
  color: string;            // hex color
  glowOpacity: number;      // 0–1
}

export interface CssFrameConfig {
  type: "css";
  css: string;              // full CSS; use __FRAME__ as the class placeholder
}

export type CustomFrameConfig = GradientFrameConfig | HudFrameConfig | CssFrameConfig;

// ─── HUD SVG components (shared between editor, designer, and student profile) ─

export function HudGridSvg({ color, glow }: { color: string; glow: string }) {
  return (
    <svg
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 5,
        filter: `drop-shadow(0 0 4px ${glow}) drop-shadow(0 0 14px ${glow})`,
      }}
      viewBox="0 0 180 240" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="180" height="240" fill="none" stroke={color} strokeWidth="1"/>
      <path d="M 0 42 L 0 0 L 42 0" fill="none" stroke={color} strokeWidth="3.5"/>
      <path d="M 138 0 L 180 0 L 180 42" fill="none" stroke={color} strokeWidth="3.5"/>
      <path d="M 0 198 L 0 240 L 42 240" fill="none" stroke={color} strokeWidth="3.5"/>
      <path d="M 138 240 L 180 240 L 180 198" fill="none" stroke={color} strokeWidth="3.5"/>
      <rect x="0" y="0" width="10" height="10" fill={color}/>
      <rect x="170" y="0" width="10" height="10" fill={color}/>
      <rect x="0" y="230" width="10" height="10" fill={color}/>
      <rect x="170" y="230" width="10" height="10" fill={color}/>
      <rect x="10" y="14" width="160" height="212" fill="none" stroke={color} strokeWidth="0.6" opacity="0.3"/>
      {[60,70,80,90,100,110,120].map((cx, i) => (
        <circle key={cx} cx={cx} cy="7" r="2" fill={color}>
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" begin={`${i*0.2}s`} repeatCount="indefinite"/>
        </circle>
      ))}
      {[55,63,71,79,87,95,103,111].map((x, i) => (
        i % 2 === 0
          ? <rect key={x} x={x} y="234" width="5" height="5" fill="none" stroke={color} strokeWidth="1"/>
          : <rect key={x} x={x} y="234" width="5" height="5" fill={color} opacity="0.6"/>
      ))}
      <line x1="0" y1="120" x2="10" y2="120" stroke={color} strokeWidth="1"/>
      <circle cx="10" cy="120" r="2" fill={color} opacity="0.6"/>
      <line x1="180" y1="120" x2="170" y2="120" stroke={color} strokeWidth="1"/>
      <circle cx="170" cy="120" r="2" fill={color} opacity="0.6"/>
    </svg>
  );
}

export function HudCommandSvg({ color, glow }: { color: string; glow: string }) {
  return (
    <svg
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 5,
        filter: `drop-shadow(0 0 4px ${glow})`,
      }}
      viewBox="0 0 180 240" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="180" height="20" fill={color} opacity="0.9"/>
      {[6,10,14,18,22,26,30,34].map(x => (
        <rect key={x} x={x} y="5" width="2" height="10" fill="var(--background)"/>
      ))}
      <polygon points="120,0 180,0 180,20 140,20" fill="var(--background)" opacity="0.5"/>
      <line x1="130" y1="0" x2="148" y2="20" stroke="var(--background)" strokeWidth="2.5"/>
      <line x1="140" y1="0" x2="158" y2="20" stroke="var(--background)" strokeWidth="2.5"/>
      <line x1="150" y1="0" x2="168" y2="20" stroke="var(--background)" strokeWidth="2.5"/>
      <line x1="160" y1="0" x2="178" y2="20" stroke="var(--background)" strokeWidth="2.5"/>
      <line x1="0" y1="20" x2="0" y2="240" stroke={color} strokeWidth="1.5"/>
      <line x1="180" y1="20" x2="180" y2="240" stroke={color} strokeWidth="1.5"/>
      <line x1="0" y1="240" x2="180" y2="240" stroke={color} strokeWidth="1.5"/>
      {[106,114,122,130].map(y => (
        <rect key={y} x="0" y={y} width="8" height="6" fill="var(--background)" stroke={color} strokeWidth="1"/>
      ))}
      {[5,9,13,17,21].map(x => (
        <rect key={x} x={x} y="234" width="2" height="6" fill={color}/>
      ))}
      <line x1="136" y1="240" x2="154" y2="226" stroke={color} strokeWidth="2"/>
      <line x1="144" y1="240" x2="162" y2="226" stroke={color} strokeWidth="2"/>
      <line x1="152" y1="240" x2="170" y2="226" stroke={color} strokeWidth="2"/>
      <line x1="160" y1="240" x2="178" y2="226" stroke={color} strokeWidth="2"/>
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

// ─── Sub-renderers ────────────────────────────────────────────────────────────

function GradientFrame({ config, children }: { config: GradientFrameConfig; children: React.ReactNode }) {
  const gradient = `conic-gradient(${config.colors.join(", ")})`;
  const animation =
    config.animationStyle === "static"
      ? "none"
      : config.animationStyle === "pulse"
      ? `frame-spin ${config.duration}s linear infinite, frame-pulse 1.5s ease-in-out infinite`
      : `frame-spin ${config.duration}s linear infinite`;

  return (
    <div style={{ padding: config.thickness, position: "relative", overflow: "hidden", isolation: "isolate", contain: "layout paint" }}>
      <div
        style={{
          position: "absolute",
          width: "200%",
          height: "200%",
          top: "-50%",
          left: "-50%",
          transformOrigin: "50% 50%",
          zIndex: -1,
          background: gradient,
          animation,
        }}
      />
      {children}
    </div>
  );
}

function HudFrame({ config, children }: { config: HudFrameConfig; children: React.ReactNode }) {
  const glow = hexToRgba(config.color, config.glowOpacity);
  return (
    <div style={{ position: "relative", overflow: "hidden", contain: "layout paint" }}>
      {config.hudType === "grid"
        ? <HudGridSvg color={config.color} glow={glow} />
        : <HudCommandSvg color={config.color} glow={glow} />}
      {children}
    </div>
  );
}

// ─── CSS sanitizer ────────────────────────────────────────────────────────────

// Walks the CSS token stream and drops any rule block whose selector does not
// include scopeClass (at-rules such as @keyframes/@media are always kept).
function filterUnscopedBlocks(css: string, scopeClass: string): string {
  const result: string[] = [];
  let i = 0;
  const len = css.length;
  let selectorBuf = "";

  function skipString(q: string): string {
    const start = i; i++;
    while (i < len) {
      if (css[i] === "\\") { i += 2; continue; }
      if (css[i] === q) { i++; break; }
      i++;
    }
    return css.slice(start, i);
  }

  function readBlock(): string {
    const start = i; let depth = 0;
    while (i < len) {
      const c = css[i];
      if (c === "{") { depth++; i++; }
      else if (c === "}") { depth--; i++; if (depth === 0) break; }
      else if (c === '"' || c === "'") skipString(c);
      else i++;
    }
    return css.slice(start, i);
  }

  while (i < len) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      const to = end === -1 ? len : end + 2;
      selectorBuf += css.slice(i, to); i = to; continue;
    }
    if (c === '"' || c === "'") { selectorBuf += skipString(c); continue; }
    if (c === "{") {
      const sel = selectorBuf.replace(/\/\*[\s\S]*?\*\//g, "").trim();
      const block = readBlock();
      if (sel.startsWith("@") || sel.includes(scopeClass)) {
        result.push(selectorBuf, block);
      } else {
        result.push("/* rule removed: not scoped to frame */");
      }
      selectorBuf = ""; continue;
    }
    selectorBuf += c; i++;
  }
  result.push(selectorBuf);
  return result.join("");
}

export const MAX_FRAME_CSS = 20_000;

export function sanitizeFrameCss(css: string, scopeClass: string): string {
  let out = css.replace(/@import\b[^;]*;?/gi, "");
  out = out.replace(/url\(\s*['"]?https?:\/\/[^\s)'"]+['"]?\s*\)/gi, "url(about:blank)");
  return filterUnscopedBlocks(out, scopeClass);
}

// ─────────────────────────────────────────────────────────────────────────────

function CssFrame({ config, frameId, children }: { config: CssFrameConfig; frameId: string; children: React.ReactNode }) {
  const cls = `frame-cid-${frameId.replace(/-/g, "")}`;
  const css = sanitizeFrameCss(config.css.replace(/__FRAME__/g, `.${cls}`), cls);
  return (
    <div className={cls} style={{ position: "relative", isolation: "isolate", overflow: "hidden", contain: "layout paint" }}>
      {/* eslint-disable-next-line react/no-danger */}
      <style>{css}</style>
      {children}
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface CustomFrameRendererProps {
  frameId: string;
  config: CustomFrameConfig;
  children: React.ReactNode;
}

export function CustomFrameRenderer({ frameId, config, children }: CustomFrameRendererProps) {
  if (config.type === "gradient") return <GradientFrame config={config}>{children}</GradientFrame>;
  if (config.type === "hud")      return <HudFrame config={config}>{children}</HudFrame>;
  if (config.type === "css")      return <CssFrame config={config} frameId={frameId}>{children}</CssFrame>;
  return <>{children}</>;
}
