import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Check } from "lucide-react";

const FRAME_OPTIONS: { value: string; label: string; cost: number; hudType?: string; hudColor?: string }[] = [
  { value: 'none',              label: 'None',        cost: 0  },
  { value: 'bronze',            label: 'Bronze',      cost: 5  },
  { value: 'silver',            label: 'Silver',      cost: 10 },
  { value: 'gold',              label: 'Gold',        cost: 20 },
  { value: 'cyberpunk',         label: 'Cyberpunk',   cost: 15 },
  { value: 'fire',              label: 'Fire',        cost: 15 },
  { value: 'ice',               label: 'Ice',         cost: 15 },
  { value: 'matrix',            label: 'Matrix',      cost: 15 },
  { value: 'holographic',       label: 'Holographic', cost: 25 },
  { value: 'neon-pulse',        label: 'Neon Pulse',  cost: 20 },
  { value: 'hud-grid-blue',     label: 'Grid Blue',   cost: 25, hudType: 'grid',    hudColor: '#00aaff' },
  { value: 'hud-grid-purple',   label: 'Grid Purple', cost: 25, hudType: 'grid',    hudColor: '#aa55ff' },
  { value: 'hud-grid-gold',     label: 'Grid Gold',   cost: 25, hudType: 'grid',    hudColor: '#ffaa00' },
  { value: 'hud-command-blue',  label: 'Cmd Blue',    cost: 30, hudType: 'command', hudColor: '#00aaff' },
  { value: 'hud-command-gold',  label: 'Cmd Gold',    cost: 30, hudType: 'command', hudColor: '#ffaa00' },
];

interface Props {
  name: string;
  onNameChange: (v: string) => void;
  bannerFile: File | null;
  bannerPreviewUrl: string;
  onBannerFileChange: (file: File) => void;
  onBannerClear: () => void;
  frameTier: string;
  onFrameTierChange: (v: string) => void;
}

export function StepName({ name, onNameChange, bannerFile, bannerPreviewUrl, onBannerFileChange, onBannerClear, frameTier, onFrameTierChange }: Props) {
  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-display font-semibold mb-1 sm:mb-2">Name this batch</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Give your automation a recognizable name to find it later.</p>
      </div>
      <div className="space-y-3">
        <Label htmlFor="name">Batch Name</Label>
        <Input
          id="name"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="e.g. Q3 Leadership Training"
          className="h-12 text-lg px-4"
        />
      </div>
      <div className="space-y-3">
        <Label>Event Banner <span className="text-muted-foreground font-normal">(optional)</span></Label>
        {bannerPreviewUrl ? (
          <div className="relative">
            <img
              src={bannerPreviewUrl}
              alt="Banner preview"
              className="w-full rounded-lg object-cover border border-border"
              style={{ maxHeight: 180 }}
            />
            <button
              type="button"
              onClick={onBannerClear}
              className="absolute top-2 right-2 bg-background border border-border rounded-full p-1 hover:bg-secondary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {bannerFile && (
              <p className="text-xs text-muted-foreground mt-1">{bannerFile.name}</p>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-8 cursor-pointer hover:border-foreground transition-colors">
            <Upload className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Click to upload a banner image</span>
            <span className="text-xs text-muted-foreground/60">Shown on student certificate cards</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                onBannerFileChange(file);
              }}
            />
          </label>
        )}
      </div>

      {/* Frame Picker */}
      <div className="space-y-3">
        <div>
          <Label>Certificate Frame <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <p className="text-xs text-muted-foreground mt-1">Animated border shown on student profile certificate cards. Extra credits deducted at batch creation.</p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 themed-scroll">
          {FRAME_OPTIONS.map((opt) => {
            const selected = frameTier === opt.value;
            const isHud = !!opt.hudType;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onFrameTierChange(opt.value)}
                className={`shrink-0 flex flex-col items-center gap-1.5 p-1 rounded transition-colors ${selected ? 'ring-2 ring-foreground' : 'opacity-70 hover:opacity-100'}`}
              >
                {/* Thumbnail */}
                <div className="relative" style={{ width: 52, height: 70 }}>
                  {opt.value === 'none' ? (
                    <div className="w-full h-full border-2 border-dashed border-border rounded" />
                  ) : isHud ? (
                    <div className="w-full h-full rounded relative overflow-hidden" style={{ background: `${opt.hudColor}12` }}>
                      <svg viewBox="0 0 180 240" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
                        {opt.hudType === 'grid' ? (<>
                          <rect x="0" y="0" width="180" height="240" fill="none" stroke={opt.hudColor} strokeWidth="2"/>
                          <path d="M 0 50 L 0 0 L 50 0" fill="none" stroke={opt.hudColor} strokeWidth="9"/>
                          <path d="M 130 0 L 180 0 L 180 50" fill="none" stroke={opt.hudColor} strokeWidth="9"/>
                          <path d="M 0 190 L 0 240 L 50 240" fill="none" stroke={opt.hudColor} strokeWidth="9"/>
                          <path d="M 130 240 L 180 240 L 180 190" fill="none" stroke={opt.hudColor} strokeWidth="9"/>
                          <rect x="0" y="0" width="18" height="18" fill={opt.hudColor}/>
                          <rect x="162" y="0" width="18" height="18" fill={opt.hudColor}/>
                          <rect x="0" y="222" width="18" height="18" fill={opt.hudColor}/>
                          <rect x="162" y="222" width="18" height="18" fill={opt.hudColor}/>
                          {[55,75,90,105,125].map((cx, i) => (
                            <circle key={cx} cx={cx} cy="10" r="5" fill={opt.hudColor}>
                              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" begin={`${i*0.3}s`} repeatCount="indefinite"/>
                            </circle>
                          ))}
                        </>) : opt.hudType === 'command' ? (<>
                          <rect x="0" y="0" width="180" height="28" fill={opt.hudColor} opacity="0.9"/>
                          {[8,16,24,32,40,48,56].map(x => <rect key={x} x={x} y="5" width="5" height="18" fill={opt.hudColor} opacity="0.22"/>)}
                          <line x1="0" y1="28" x2="0" y2="240" stroke={opt.hudColor} strokeWidth="2.5"/>
                          <line x1="180" y1="28" x2="180" y2="240" stroke={opt.hudColor} strokeWidth="2.5"/>
                          <line x1="0" y1="240" x2="180" y2="240" stroke={opt.hudColor} strokeWidth="2.5"/>
                          {[106,118,130,142].map(y => (
                            <rect key={y} x="0" y={y} width="12" height="8" fill="none" stroke={opt.hudColor} strokeWidth="1.5"/>
                          ))}
                          <line x1="126" y1="240" x2="152" y2="210" stroke={opt.hudColor} strokeWidth="3"/>
                          <line x1="144" y1="240" x2="170" y2="210" stroke={opt.hudColor} strokeWidth="3"/>
                        </>) : null}
                      </svg>
                    </div>
                  ) : (
                    <div className={`cert-frame-wrapper frame-${opt.value}`} style={{ width: '100%', height: '100%', borderRadius: 2 }}>
                      <div style={{ width: '100%', height: '100%', background: 'var(--background)', borderRadius: 1 }} />
                    </div>
                  )}
                  {selected && (
                    <div className="absolute -top-1.5 -right-1.5 bg-foreground text-background rounded-full w-4 h-4 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>
                {/* Label + cost */}
                <span className="text-[10px] font-medium text-center leading-tight">{opt.label}</span>
                <span className="text-[9px] text-muted-foreground">{opt.cost === 0 ? 'Free' : `+${opt.cost} cr`}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
