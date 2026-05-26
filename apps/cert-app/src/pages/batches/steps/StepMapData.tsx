import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Link2, FileSpreadsheet } from "lucide-react";

interface Props {
  sheetDataLoading: boolean;
  placeholdersLoading: boolean;
  sheetHeaders: string[];
  placeholders: string[];
  nameColumn: string;
  onNameColumnChange: (v: string) => void;
  emailColumn: string;
  onEmailColumnChange: (v: string) => void;
  columnMap: Record<string, string>;
  onColumnMapChange: (map: Record<string, string>) => void;
}

export function StepMapData({ sheetDataLoading, placeholdersLoading, sheetHeaders, placeholders, nameColumn, onNameColumnChange, emailColumn, onEmailColumnChange, columnMap, onColumnMapChange }: Props) {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-display font-semibold mb-2">Map Data Fields</h2>
        <p className="text-muted-foreground">Match the placeholders in your template to columns in your sheet.</p>
      </div>

      {(sheetDataLoading || placeholdersLoading) ? (
        <div className="flex items-center gap-3 text-muted-foreground p-8"><Loader2 className="animate-spin" /> Loading mapping data...</div>
      ) : sheetHeaders.length > 25 ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center border-2 border-dashed border-border rounded-2xl px-6">
          <FileSpreadsheet className="w-10 h-10 text-muted-foreground/50" />
          <div>
            <p className="font-semibold text-base mb-1">Too many columns to map here</p>
            <p className="text-sm text-muted-foreground">
              This sheet has <strong>{sheetHeaders.length}</strong> columns — more than the wizard can handle.
              Use the <strong>Advanced Workflow Builder</strong> to connect columns visually.
            </p>
          </div>
          <Button onClick={() => setLocation("/advanced")} className="mt-2">
            Open Advanced Workflow Builder
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="space-y-6">
            <div className="bg-secondary/50 p-5 rounded-2xl border border-border/50 space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" /> Recipient Config
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name Column (Required)</Label>
                  <Select value={nameColumn} onValueChange={onNameColumnChange}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Select name column" /></SelectTrigger>
                    <SelectContent>
                      {sheetHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email Column (Required)</Label>
                  <Select value={emailColumn} onValueChange={onEmailColumnChange}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Select email column" /></SelectTrigger>
                    <SelectContent>
                      {sheetHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Template Placeholders</h3>
            <div className="space-y-3 pr-2">
              {placeholders.length === 0 ? (
                <div className="text-muted-foreground text-sm p-4 bg-secondary/50 rounded-lg">No placeholders found in template (like `&lt;&lt;Name&gt;&gt;`)</div>
              ) : (
                placeholders.map(ph => (
                  <div key={ph} className="flex flex-wrap items-center gap-2 sm:gap-4 bg-background p-3 rounded-xl border border-border shadow-sm">
                    <div className="min-w-0 max-w-[40%] text-sm font-mono bg-secondary px-2 py-1 rounded text-center truncate">{ph}</div>
                    <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Select value={columnMap[ph] || ""} onValueChange={(val) => onColumnMapChange({ ...columnMap, [ph]: val })}>
                      <SelectTrigger className="flex-1 min-w-[120px] border-0 shadow-none bg-secondary/30"><SelectValue placeholder="Map to column..." /></SelectTrigger>
                      <SelectContent>
                        {sheetHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
