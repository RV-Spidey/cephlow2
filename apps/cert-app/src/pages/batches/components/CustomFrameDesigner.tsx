import { useState, useMemo, useId } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight, Share2 } from "lucide-react";
import {
  CustomFrameConfig,
  GradientFrameConfig,
  HudFrameConfig,
  CssFrameConfig,
  CustomFrameRenderer,
  HudGridSvg,
  HudCommandSvg,
  MAX_FRAME_CSS,
} from "@/components/CustomFrameRenderer";

// ─── Preview card (simplified) ────────────────────────────────────────────────

function PreviewCard() {
  return (
    <div className="border-2 border-foreground bg-background flex flex-col font-mono text-foreground cert-card-inner" style={{ position: "relative" }}>
      <div className="px-3 py-3 flex flex-col gap-2 border-b-2 border-foreground relative" style={{ aspectRatio: "300/140" }}>
        <div className="relative flex items-start justify-between gap-2">
          <div className="border p-1.5 shrink-0 border-foreground">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <span className="border-2 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border-foreground">preview</span>
        </div>
        <div className="relative flex-1" />
        <div className="relative flex items-end justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest">Custom Frame</span>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Issued For</p>
            <p className="text-xs font-bold">Your Batch</p>
          </div>
        </div>
      </div>
      <div className="flex">
        <span className="flex-1 flex items-center justify-center gap-1 bg-foreground text-background px-2 py-2 text-[9px] font-black uppercase tracking-widest border-r-2 border-foreground">View</span>
        <span className="flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[9px] font-black uppercase tracking-widest">Verify</span>
      </div>
    </div>
  );
}

const BATMAN_STARTER = `/* Batman theme: dark Gotham night with rotating bat-signal beams */

@keyframes bat-sweep {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes bat-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.02); }
}

@keyframes city-flicker {
  0%, 94%, 100% { opacity: 1; }
  95% { opacity: 0.55; }
  97% { opacity: 0.85; }
}

__FRAME__ {
  padding: 4px;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  animation: bat-pulse 4s ease-in-out infinite, city-flicker 8s infinite;
}

__FRAME__::before {
  content: '';
  position: absolute;
  width: 200%; height: 200%;
  top: -50%; left: -50%;
  z-index: -1;
  transform-origin: 50% 50%;
  background: conic-gradient(
    #f5c518 0deg 8deg,
    #1a1a1a 8deg 52deg,
    #f5c518 52deg 60deg,
    #0d0d0d 60deg 300deg,
    #f5c518 300deg 308deg,
    #1a1a1a 308deg 352deg,
    #f5c518 352deg 360deg
  );
  animation: bat-sweep 6s linear infinite;
}

__FRAME__::after {
  content: '';
  position: absolute;
  inset: 4px;
  z-index: -1;
  background: #0d0d0d;
  box-shadow:
    inset 0 0 20px rgba(245,197,24,0.15),
    0 0 30px rgba(245,197,24,0.3),
    0 0 60px rgba(245,197,24,0.1);
}

__FRAME__ .cert-card-inner {
  box-shadow:
    0 0 12px rgba(245,197,24,0.4),
    0 0 40px rgba(245,197,24,0.15),
    inset 0 0 8px rgba(0,0,0,0.8);
  background: linear-gradient(135deg, #111 0%, #1a1a1a 50%, #0d0d0d 100%);
}
`;

const CSS_STARTER = `/* __FRAME__ is your frame's class name — use it to target any element */

/* Wrapper: controls border thickness */
__FRAME__ {
  padding: 3px;
  position: relative;
  overflow: hidden;
  isolation: isolate;
}

/* ::before spins as the gradient border layer */
__FRAME__::before {
  content: '';
  position: absolute;
  width: 200%; height: 200%;
  top: -50%; left: -50%;
  z-index: -1;
  transform-origin: 50% 50%;
  background: conic-gradient(#ff0080, #ff8c00, #40e0d0, #ff0080);
  animation: frame-spin 3s linear infinite;
}

/* You can add a second layer with ::after */
/* __FRAME__::after { ... } */

/* Target the card itself */
/* __FRAME__ .cert-card-inner { box-shadow: 0 0 8px rgba(255,0,128,0.4); } */
`;

// ─── Tab: Gradient ─────────────────────────────────────────────────────────────

function GradientTab({ config, onChange }: { config: GradientFrameConfig; onChange: (c: GradientFrameConfig) => void }) {
  const setColors = (colors: string[]) => onChange({ ...config, colors });
  const addColor = () => { if (config.colors.length < 8) setColors([...config.colors, "#ffffff"]); };
  const removeColor = (i: number) => { if (config.colors.length > 2) setColors(config.colors.filter((_, idx) => idx !== i)); };
  const updateColor = (i: number, val: string) => setColors(config.colors.map((c, idx) => idx === i ? val : c));

  return (
    <div className="space-y-4">
      {/* Color stops */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest">Color stops ({config.colors.length}/8)</p>
        <div className="flex flex-wrap gap-2">
          {config.colors.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <label className="w-8 h-8 rounded border-2 border-border cursor-pointer overflow-hidden shrink-0" style={{ backgroundColor: c }}>
                <input type="color" className="opacity-0 w-full h-full cursor-pointer" value={c}
                  onChange={e => updateColor(i, e.target.value)} />
              </label>
              {config.colors.length > 2 && (
                <button onClick={() => removeColor(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {config.colors.length < 8 && (
            <button onClick={addColor}
              className="w-8 h-8 rounded border-2 border-dashed border-border flex items-center justify-center hover:border-foreground transition-colors">
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">Colors rotate around the card border in order</p>
      </div>

      {/* Animation style */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest">Animation</p>
        <div className="flex gap-1">
          {(["spin", "pulse", "static"] as const).map(s => (
            <button key={s} onClick={() => onChange({ ...config, animationStyle: s })}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest border-2 transition-colors
                ${config.animationStyle === s ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/50"}`}>
              {s === "pulse" ? "pulse+spin" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Speed */}
      {config.animationStyle !== "static" && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <p className="text-xs font-bold uppercase tracking-widest">Speed</p>
            <span className="text-xs text-muted-foreground font-mono">{config.duration}s</span>
          </div>
          <Slider min={1} max={10} step={0.5} value={[config.duration]}
            onValueChange={([v]) => onChange({ ...config, duration: v })} />
          <p className="text-[10px] text-muted-foreground">Lower = faster rotation</p>
        </div>
      )}

      {/* Thickness */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <p className="text-xs font-bold uppercase tracking-widest">Border thickness</p>
          <span className="text-xs text-muted-foreground font-mono">{config.thickness}px</span>
        </div>
        <Slider min={1} max={8} step={1} value={[config.thickness]}
          onValueChange={([v]) => onChange({ ...config, thickness: v })} />
      </div>
    </div>
  );
}

// ─── Tab: HUD ─────────────────────────────────────────────────────────────────

function HudTab({ config, onChange }: { config: HudFrameConfig; onChange: (c: HudFrameConfig) => void }) {
  return (
    <div className="space-y-4">
      {/* HUD type */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest">Style</p>
        <div className="flex gap-2">
          {(["grid", "command"] as const).map(type => {
            const selected = config.hudType === type;
            const miniColor = selected ? config.color : "#888888";
            return (
              <button key={type} onClick={() => onChange({ ...config, hudType: type })}
                className={`flex-1 flex flex-col items-center gap-2 p-2 border-2 transition-colors
                  ${selected ? "border-foreground" : "border-border hover:border-foreground/40"}`}>
                <div className="relative" style={{ width: 36, height: 48 }}>
                  <svg viewBox="0 0 180 240" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} xmlns="http://www.w3.org/2000/svg">
                    {type === "grid" ? (
                      <>
                        <rect x="0" y="0" width="180" height="240" fill="none" stroke={miniColor} strokeWidth="2"/>
                        <path d="M 0 50 L 0 0 L 50 0" fill="none" stroke={miniColor} strokeWidth="9"/>
                        <path d="M 130 0 L 180 0 L 180 50" fill="none" stroke={miniColor} strokeWidth="9"/>
                        <path d="M 0 190 L 0 240 L 50 240" fill="none" stroke={miniColor} strokeWidth="9"/>
                        <path d="M 130 240 L 180 240 L 180 190" fill="none" stroke={miniColor} strokeWidth="9"/>
                      </>
                    ) : (
                      <>
                        <rect x="0" y="0" width="180" height="28" fill={miniColor} opacity="0.9"/>
                        <line x1="0" y1="28" x2="0" y2="240" stroke={miniColor} strokeWidth="2.5"/>
                        <line x1="180" y1="28" x2="180" y2="240" stroke={miniColor} strokeWidth="2.5"/>
                        <line x1="0" y1="240" x2="180" y2="240" stroke={miniColor} strokeWidth="2.5"/>
                      </>
                    )}
                  </svg>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest">{type}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest">Color</p>
        <div className="flex items-center gap-3">
          <label className="w-9 h-9 rounded border-2 border-border cursor-pointer overflow-hidden shrink-0" style={{ backgroundColor: config.color }}>
            <input type="color" className="opacity-0 w-full h-full cursor-pointer" value={config.color}
              onChange={e => onChange({ ...config, color: e.target.value })} />
          </label>
          <span className="text-xs font-mono text-muted-foreground">{config.color}</span>
        </div>
      </div>

      {/* Glow */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <p className="text-xs font-bold uppercase tracking-widest">Glow intensity</p>
          <span className="text-xs text-muted-foreground font-mono">{Math.round(config.glowOpacity * 100)}%</span>
        </div>
        <Slider min={0} max={100} step={5} value={[Math.round(config.glowOpacity * 100)]}
          onValueChange={([v]) => onChange({ ...config, glowOpacity: v / 100 })} />
      </div>
    </div>
  );
}

// ─── Tab: CSS ─────────────────────────────────────────────────────────────────

function CssTab({ config, onChange }: { config: CssFrameConfig; onChange: (c: CssFrameConfig) => void }) {
  const [starterOpen, setStarterOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-widest">Custom CSS</p>
        <p className="text-[10px] text-muted-foreground">
          Use <code className="font-mono bg-muted px-1">__FRAME__</code> as your frame's class name.
          Full CSS freedom — <code className="font-mono bg-muted px-1">::before</code>, <code className="font-mono bg-muted px-1">::after</code>,
          <code className="font-mono bg-muted px-1">@keyframes</code>, <code className="font-mono bg-muted px-1">filter</code>, <code className="font-mono bg-muted px-1">clip-path</code>, anything goes.
        </p>
      </div>

      <textarea
        className={`w-full font-mono text-[11px] border-2 bg-background p-2 resize-none outline-none transition-colors ${config.css.length > MAX_FRAME_CSS ? "border-destructive focus:border-destructive" : "border-border focus:border-foreground"}`}
        rows={16}
        spellCheck={false}
        value={config.css}
        onChange={e => onChange({ ...config, css: e.target.value })}
        placeholder={CSS_STARTER}
      />
      <div className={`flex justify-end text-[10px] font-mono ${config.css.length > MAX_FRAME_CSS ? "text-destructive font-bold" : "text-muted-foreground"}`}>
        {config.css.length.toLocaleString()} / {MAX_FRAME_CSS.toLocaleString()} chars
      </div>

      {/* Starter template collapsible */}
      <div className="border-2 border-border">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-muted transition-colors"
          onClick={() => setStarterOpen(o => !o)}
        >
          {starterOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Starter template
        </button>
        {starterOpen && (
          <div className="border-t-2 border-border">
            <pre className="font-mono text-[10px] text-muted-foreground p-3 overflow-x-auto">{CSS_STARTER}</pre>
            <div className="px-3 pb-3">
              <Button variant="outline" size="sm" className="text-[10px] h-7"
                onClick={() => onChange({ ...config, css: CSS_STARTER })}>
                Load starter into editor
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { PublishFrameDialog } from "./PublishFrameDialog";

// ─── Main designer dialog ──────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  batch?: any;
  onSaved: (frameTier: string, frameLabel: string, config: CustomFrameConfig) => void;
  standalone?: boolean;
}

const DEFAULT_GRADIENT: GradientFrameConfig = {
  type: "gradient", colors: ["#ff0080", "#ff8c00", "#40e0d0", "#ff0080"],
  duration: 3, animationStyle: "spin", thickness: 2,
};
const DEFAULT_HUD: HudFrameConfig = {
  type: "hud", hudType: "grid", color: "#00aaff", glowOpacity: 0.6,
};
const DEFAULT_CSS: CssFrameConfig = { type: "css", css: CSS_STARTER };

type Tab = "gradient" | "hud" | "css";

export function CustomFrameDesigner({ open, onOpenChange, batch, onSaved, standalone }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("gradient");
  const [name, setName] = useState("My Frame");
  const [gradient, setGradient] = useState<GradientFrameConfig>(DEFAULT_GRADIENT);
  const [hud, setHud] = useState<HudFrameConfig>(DEFAULT_HUD);
  const [css, setCss] = useState<CssFrameConfig>(DEFAULT_CSS);
  const [saving, setSaving] = useState(false);
  const [savedFrameId, setSavedFrameId] = useState<string | null>(null);
  const [savedFrameName, setSavedFrameName] = useState<string>("");
  const [publishOpen, setPublishOpen] = useState(false);

  const activeConfig: CustomFrameConfig =
    tab === "gradient" ? gradient : tab === "hud" ? hud : css;

  const rawPreviewId = useId();
  const previewId = rawPreviewId.replace(/[^a-zA-Z0-9]/g, "");

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Enter a name for your frame", variant: "destructive" }); return; }
    if (activeConfig.type === "css" && activeConfig.css.length > MAX_FRAME_CSS) {
      toast({ title: `CSS exceeds ${MAX_FRAME_CSS.toLocaleString()} character limit`, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const result = await customFetch<{ id: string; name: string }>("/api/frame-templates", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), config: activeConfig }),
      });
      setSavedFrameId(result.id);
      setSavedFrameName(result.name);
      onSaved(`custom:${result.id}`, result.name, activeConfig);
      toast({ title: `"${result.name}" saved to workspace library` });
    } catch (err: any) {
      toast({ title: "Failed to save frame", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "gradient", label: "Gradient" },
    { id: "hud", label: "HUD" },
    { id: "css", label: "Custom CSS" },
  ];

  const designerBody = (
    <>
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Left: controls */}
        <div className="flex flex-col gap-4 flex-1">
          {/* Name */}
          <div className="space-y-1.5 shrink-0">
            <p className="text-xs font-bold uppercase tracking-widest">Frame name</p>
            <input
              className="w-full border-2 border-border bg-background px-3 py-1.5 text-sm font-bold uppercase tracking-widest outline-none focus:border-foreground transition-colors"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Frame"
            />
          </div>

          {/* Tab bar */}
          <div className="shrink-0 flex border-2 border-border">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors
                  ${tab === t.id ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1">
            {tab === "gradient" && <GradientTab config={gradient} onChange={setGradient} />}
            {tab === "hud" && <HudTab config={hud} onChange={setHud} />}
            {tab === "css" && <CssTab config={css} onChange={setCss} />}
          </div>
        </div>

        {/* Right: live preview */}
        <div className="flex flex-col gap-3 w-full lg:w-56 lg:shrink-0">
          <p className="text-sm font-medium shrink-0">Live preview</p>
          <div className="shrink-0">
            <CustomFrameRenderer frameId={previewId} config={activeConfig}>
              <PreviewCard />
            </CustomFrameRenderer>
          </div>
          <p className="text-[10px] text-muted-foreground">Updates instantly as you edit.</p>
        </div>
      </div>

      <div className="flex justify-between gap-2 pt-4 border-t border-border mt-4">
        <div>
          {savedFrameId && (
            <Button variant="outline" onClick={() => setPublishOpen(true)}>
              <Share2 className="w-4 h-4 mr-2" />
              Publish to Marketplace
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {standalone ? "Close" : "Cancel"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? "Saving…" : "Save to Library"}
          </Button>
        </div>
      </div>
    </>
  );

  if (standalone) {
    if (!open) return null;
    return (
      <>
        <div className="border-2 border-foreground p-4 sm:p-6">
          <div className="flex items-center gap-2 pb-4 mb-4 border-b border-border">
            <p className="text-xs font-black uppercase tracking-widest flex-1">Frame Designer</p>
          </div>
          {designerBody}
        </div>

        {savedFrameId && (
          <PublishFrameDialog
            open={publishOpen}
            onOpenChange={setPublishOpen}
            frameId={savedFrameId}
            frameName={savedFrameName}
            frameConfig={activeConfig}
          />
        )}
      </>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[95vh] flex flex-col p-4 sm:p-6 gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>Frame Designer</DialogTitle>
          <DialogDescription>
            Design a custom frame and save it to your workspace library for reuse across batches.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto themed-scroll">
          {designerBody}
        </div>
      </DialogContent>
    </Dialog>

    {savedFrameId && (
      <PublishFrameDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        frameId={savedFrameId}
        frameName={savedFrameName}
        frameConfig={activeConfig}
      />
    )}
    </>
  );
}
