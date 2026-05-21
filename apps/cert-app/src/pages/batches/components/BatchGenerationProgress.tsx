import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Loader2, X } from "lucide-react";

interface GenProgress {
  phase: "preparing" | "generating" | "uploading" | "error" | "done";
  current: number;
  total: number;
  message: string;
}

interface Props {
  isGenerating: boolean;
  genProgress: GenProgress | null;
  isApproved: boolean;
  onCancel: () => void;
}

export function BatchGenerationProgress({ isGenerating, genProgress, isApproved, onCancel }: Props) {
  return (
    <>
      {isGenerating && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Generation in progress — do not close or reload this page. Your progress will be lost.</span>
        </div>
      )}

      {genProgress && genProgress.phase !== "done" && (
        <Card className="border-border/50 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-300">
          <CardContent className="p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">
                    {genProgress.phase === "preparing" && "Preparing..."}
                    {genProgress.phase === "generating" && "Generating Certificates"}
                    {genProgress.phase === "uploading" && (isApproved ? "Uploading to Cloud" : "Saving to Google Drive")}
                    {genProgress.phase === "error" && "Error"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {genProgress.total > 0 && (
                    <span className="text-xs text-muted-foreground font-mono">{genProgress.current}/{genProgress.total}</span>
                  )}
                  <Button variant="ghost" size="sm" onClick={onCancel} className="px-2 h-7" title="Cancel generation">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {genProgress.total > 0 && (
                <Progress value={(genProgress.current / genProgress.total) * 100} className="h-2" />
              )}
              <p className="text-xs text-muted-foreground truncate">{genProgress.message}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
