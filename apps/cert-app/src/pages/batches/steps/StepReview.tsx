import { FileSpreadsheet, Presentation, Layers } from "lucide-react";

interface Props {
  name: string;
  sheetName: string;
  emailColumn: string;
  nameColumn: string;
  templateName: string;
  multiTemplateMode: boolean;
  categoryColumn: string;
  categorySlideMap: Record<string, number>;
  columnMap: Record<string, string>;
  emailSubject: string;
}

export function StepReview({ name, sheetName, emailColumn, nameColumn, templateName, multiTemplateMode, categoryColumn, categorySlideMap, columnMap, emailSubject }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-mono font-black uppercase tracking-widest mb-2">Review & Confirm</h2>
        <p className="text-sm text-muted-foreground font-mono">You're almost there. Double check your settings before creating this batch.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border-2 border-foreground bg-background p-4 font-mono">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Batch Name</div>
          <div className="font-bold text-base">{name}</div>
        </div>

        <div className="border-2 border-foreground bg-background p-4 font-mono">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Data Source</div>
          <div className="font-bold flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 shrink-0" /> {sheetName}</div>
          <div className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">Emails: {emailColumn} · Names: {nameColumn}</div>
        </div>

        <div className="border-2 border-foreground bg-background p-4 font-mono">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Template</div>
          {multiTemplateMode ? (
            <>
              <div className="font-bold flex items-center gap-2"><Layers className="w-4 h-4 shrink-0" /> Multi Template</div>
              <div className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">
                Column: {categoryColumn} · {Object.keys(categorySlideMap).length} mapped
              </div>
            </>
          ) : (
            <>
              <div className="font-bold flex items-center gap-2"><Presentation className="w-4 h-4 shrink-0" /> {templateName}</div>
              <div className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">{Object.keys(columnMap).length} fields mapped</div>
            </>
          )}
        </div>

        <div className="border-2 border-foreground bg-background p-4 font-mono">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Email Subject</div>
          <div className="font-bold">"{emailSubject}"</div>
        </div>
      </div>
    </div>
  );
}
