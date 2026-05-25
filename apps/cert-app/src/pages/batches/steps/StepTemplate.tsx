import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Presentation, PenTool, Layers } from "lucide-react";
import type { useLockedFeatureGuard } from "@/components/LockedFeature";

interface SlideInfo { index: number; objectId: string; thumbnailUrl: string | null; }

interface Props {
  templateKind: "slides" | "builtin";
  templateId: string;
  templateName: string;
  multiTemplateMode: boolean;
  categoryColumn: string;
  categorySlideMap: Record<string, number>;
  defaultSlideIndex: number;
  pickerLoading: "sheet" | "presentation" | null;
  slidesGuard: ReturnType<typeof useLockedFeatureGuard>;
  builtinTemplatesLoading: boolean;
  builtinTemplates: any[];
  slidesInfoLoading: boolean;
  slidesInfo: SlideInfo[];
  uniqueCategories: string[];
  sheetHeaders: string[];
  onTemplateKindChange: (kind: "slides" | "builtin") => void;
  onMultiTemplateModeChange: (v: boolean) => void;
  onTemplateSelect: (id: string, name: string) => void;
  onPickTemplate: () => void;
  onCategoryColumnChange: (col: string) => void;
  onCategorySlideMapChange: (map: Record<string, number>) => void;
  onDefaultSlideIndexChange: (idx: number) => void;
}

export function StepTemplate({
  templateKind, templateId, templateName, multiTemplateMode,
  categoryColumn, categorySlideMap, defaultSlideIndex,
  pickerLoading, slidesGuard,
  builtinTemplatesLoading, builtinTemplates,
  slidesInfoLoading, slidesInfo, uniqueCategories, sheetHeaders,
  onTemplateKindChange, onMultiTemplateModeChange, onTemplateSelect, onPickTemplate,
  onCategoryColumnChange, onCategorySlideMapChange, onDefaultSlideIndexChange,
}: Props) {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-3 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-display font-semibold mb-1 sm:mb-2">Template Setup</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Choose one template for all recipients, or use multiple slides from a single presentation.</p>
      </div>

      {/* Source kind toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => { onTemplateKindChange("builtin"); onTemplateSelect("", ""); onMultiTemplateModeChange(false); onCategorySlideMapChange({}); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${templateKind === "builtin" ? "border-primary bg-primary/5 text-foreground" : "border-border/50 text-muted-foreground hover:border-primary/30"}`}
        >
          <PenTool className="w-4 h-4" /> Builtin Editor
        </button>
        <button
          onClick={slidesGuard.guard(() => { onTemplateKindChange("slides"); onTemplateSelect("", ""); onCategorySlideMapChange({}); })}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${templateKind === "slides" ? "border-primary bg-primary/5 text-foreground" : "border-border/50 text-muted-foreground hover:border-primary/30"} ${!slidesGuard.isApproved ? "opacity-60" : ""}`}
        >
          <Presentation className="w-4 h-4" /> Google Slides {!slidesGuard.isApproved && "🔒"}
        </button>
      </div>
      {slidesGuard.modal}

      {/* Multi-template mode toggle (only for Slides) */}
      {templateKind === "slides" && (
        <div className="flex gap-3">
          <button
            onClick={() => { onMultiTemplateModeChange(false); onCategoryColumnChange(""); onCategorySlideMapChange({}); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${!multiTemplateMode ? "border-primary bg-primary/5 text-foreground" : "border-border/50 text-muted-foreground hover:border-primary/30"}`}
          >
            <Presentation className="w-4 h-4" /> Single Template
          </button>
          <button
            onClick={() => onMultiTemplateModeChange(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${multiTemplateMode ? "border-primary bg-primary/5 text-foreground" : "border-border/50 text-muted-foreground hover:border-primary/30"}`}
          >
            <Layers className="w-4 h-4" /> Multi Template
          </button>
        </div>
      )}

      {templateKind === "builtin" ? (
        builtinTemplatesLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground p-8"><Loader2 className="animate-spin" /> Loading builtin templates...</div>
        ) : builtinTemplates.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl p-8 text-center space-y-3">
            <PenTool className="w-8 h-8 mx-auto text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">You don't have any builtin templates yet.</p>
            <Button variant="outline" onClick={() => setLocation("/templates/builtin/new")}>
              Open Builtin Editor
            </Button>
          </div>
        ) : (
          <div>
            <Label className="text-sm mb-2 block">Select a builtin template</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-1">
              {builtinTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => onTemplateSelect(tpl.id, tpl.name)}
                  className={`group p-4 rounded-xl border-2 cursor-pointer transition-all hover-elevate flex flex-col gap-4 ${templateId === tpl.id ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-border/50 bg-card hover:border-primary/30"}`}
                >
                  {tpl.thumbnailUrl ? (
                    <img src={tpl.thumbnailUrl} alt={tpl.name} className="w-full aspect-[3/2] sm:aspect-[4/3] object-contain bg-secondary rounded-lg border border-border/50" />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-secondary rounded-lg flex items-center justify-center">
                      <PenTool className="w-10 h-10 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="font-semibold text-sm line-clamp-2">{tpl.name}</div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          {/* Template picker */}
          <div className="space-y-4">
            <Label className="text-sm block">{multiTemplateMode ? "Select the presentation containing all slide designs" : "Select a template"}</Label>
            <Button
              variant="outline"
              className="h-12 px-6 gap-2"
              disabled={pickerLoading === "presentation"}
              onClick={onPickTemplate}
            >
              {pickerLoading === "presentation" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
              {templateId ? "Change Template" : "Pick from Google Drive"}
            </Button>
            {templateId && (
              <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 border-primary bg-primary/5 ring-4 ring-primary/10 max-w-sm">
                <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                  <Presentation className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground line-clamp-1">{templateName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Presentation selected</div>
                </div>
              </div>
            )}
          </div>

          {/* Multi-template: slide mapping UI */}
          {multiTemplateMode && templateId && (
            <div className="space-y-5 border-t border-border/50 pt-5">
              {slidesInfoLoading ? (
                <div className="flex items-center gap-3 text-muted-foreground p-4"><Loader2 className="animate-spin w-4 h-4" /> Loading slides...</div>
              ) : slidesInfo.length > 0 && (
                <div>
                  <Label className="text-sm mb-2 block">Slides in this presentation ({slidesInfo.length})</Label>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {slidesInfo.map(slide => (
                      <div key={slide.index} className="shrink-0 w-36">
                        {slide.thumbnailUrl ? (
                          <img src={slide.thumbnailUrl} alt={`Slide ${slide.index + 1}`} className="w-full aspect-[4/3] object-cover rounded-lg border border-border/50" />
                        ) : (
                          <div className="w-full aspect-[4/3] bg-secondary rounded-lg flex items-center justify-center">
                            <Presentation className="w-6 h-6 text-muted-foreground/50" />
                          </div>
                        )}
                        <p className="text-xs text-center mt-1 font-medium text-muted-foreground">Slide {slide.index + 1}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category column selector */}
              <div className="space-y-2 max-w-sm">
                <Label>Category Column</Label>
                <Select value={categoryColumn} onValueChange={(val) => { onCategoryColumnChange(val); onCategorySlideMapChange({}); }}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Which column holds the category/role?" /></SelectTrigger>
                  <SelectContent>
                    {sheetHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">e.g. a column with values like "Winner", "Coordinator", "Participant"</p>
              </div>

              {/* Category → Slide mapping */}
              {categoryColumn && slidesInfo.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Map Categories → Slides</Label>
                    <span className="text-xs text-muted-foreground">{uniqueCategories.length} categories detected</span>
                  </div>
                  <div className="space-y-2">
                    {uniqueCategories.map(cat => (
                      <div key={cat} className="flex items-center gap-4 bg-secondary/30 p-3 rounded-xl border border-border/50">
                        <div className="w-40 shrink-0 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{cat}</span>
                        </div>
                        <Select
                          value={categorySlideMap[cat] != null ? String(categorySlideMap[cat]) : ""}
                          onValueChange={(val) => onCategorySlideMapChange({ ...categorySlideMap, [cat]: parseInt(val, 10) })}
                        >
                          <SelectTrigger className="bg-background flex-1"><SelectValue placeholder="Select slide..." /></SelectTrigger>
                          <SelectContent>
                            {slidesInfo.map(slide => (
                              <SelectItem key={slide.index} value={String(slide.index)}>Slide {slide.index + 1}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {categorySlideMap[cat] != null && slidesInfo[categorySlideMap[cat]]?.thumbnailUrl && (
                          <img src={slidesInfo[categorySlideMap[cat]].thumbnailUrl!} alt={`Slide ${categorySlideMap[cat] + 1}`} className="w-16 aspect-[4/3] object-cover rounded-md border border-border/50 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Default slide */}
                  <div className="pt-3 border-t border-border/50 space-y-2">
                    <Label className="text-sm">Default Slide <span className="font-normal text-muted-foreground">(for empty or unmatched categories)</span></Label>
                    <div className="flex items-center gap-4">
                      <Select value={String(defaultSlideIndex)} onValueChange={(val) => onDefaultSlideIndexChange(parseInt(val, 10))}>
                        <SelectTrigger className="bg-background max-w-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {slidesInfo.map(slide => (
                            <SelectItem key={slide.index} value={String(slide.index)}>Slide {slide.index + 1}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {slidesInfo[defaultSlideIndex]?.thumbnailUrl && (
                        <img src={slidesInfo[defaultSlideIndex].thumbnailUrl!} alt="Default slide" className="w-16 aspect-[4/3] object-cover rounded-md border border-border/50 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
