import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  emailSubject: string;
  onSubjectChange: (v: string) => void;
  emailBody: string;
  onBodyChange: (v: string) => void;
  batchName: string;
  sheetHeaders: string[];
}

export function StepEmailSettings({ emailSubject, onSubjectChange, emailBody, onBodyChange, batchName, sheetHeaders }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-semibold mb-2">Email Configuration</h2>
        <p className="text-muted-foreground">Design the email that will be sent with each certificate. Use column names like `&lt;&lt;Name&gt;&gt;` to personalize.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject Line</Label>
            <Input
              id="subject"
              value={emailSubject}
              onChange={e => onSubjectChange(e.target.value)}
              placeholder="e.g. Congratulations, your certificate is ready!"
              className="transition-all duration-200"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                const target = e.target as HTMLInputElement;
                target.focus();
                const rect = target.getBoundingClientRect();
                const x = e.clientX - rect.left - 12;
                const charWidth = 8;
                const pos = Math.max(0, Math.floor(x / charWidth));
                target.setSelectionRange(pos, pos);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const target = e.target as HTMLInputElement;
                const text = e.dataTransfer.getData("text/plain");
                if (text) {
                  const start = target.selectionStart || 0;
                  const end = target.selectionEnd || 0;
                  onSubjectChange(emailSubject.substring(0, start) + text + emailSubject.substring(end));
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Email Body</Label>
            <Textarea
              id="body"
              value={emailBody}
              onChange={e => onBodyChange(e.target.value)}
              rows={12}
              className="resize-none font-sans leading-relaxed transition-all duration-200"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                const target = e.target as HTMLTextAreaElement;
                target.focus();
                const rect = target.getBoundingClientRect();
                const x = e.clientX - rect.left - 12;
                const y = e.clientY - rect.top - 12;
                const charWidth = 8.4;
                const lineHeight = 24;
                const lineIdx = Math.max(0, Math.floor(y / lineHeight));
                const colIdx = Math.max(0, Math.floor(x / charWidth));
                const textLines = target.value.split('\n');
                let pos = 0;
                for (let i = 0; i < Math.min(lineIdx, textLines.length); i++) {
                  pos += textLines[i].length + 1;
                }
                pos += Math.min(colIdx, textLines[lineIdx]?.length || 0);
                target.setSelectionRange(pos, pos);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const target = e.target as HTMLTextAreaElement;
                const text = e.dataTransfer.getData("text/plain");
                if (text) {
                  const start = target.selectionStart || 0;
                  const end = target.selectionEnd || 0;
                  onBodyChange(emailBody.substring(0, start) + text + emailBody.substring(end));
                }
              }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-secondary/30 rounded-2xl p-5 border border-border/50 h-full">
            <Label className="text-sm font-semibold mb-3 block">Available Placeholders</Label>
            <p className="text-xs text-muted-foreground mb-4">
              Drag and drop these into your email body or subject line to personalize your message.
            </p>
            <div className="flex flex-wrap gap-2 pr-1">
              <div
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", batchName); e.dataTransfer.effectAllowed = "copy"; }}
                className="bg-background border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground px-3 py-1.5 rounded-lg text-xs font-mono cursor-grab active:cursor-grabbing transition-all flex items-center gap-2 group shadow-sm"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                Batch Name
              </div>
              {sheetHeaders.map(header => (
                <div
                  key={header}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", `<<${header}>>`); e.dataTransfer.effectAllowed = "copy"; }}
                  className="bg-background border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground px-3 py-1.5 rounded-lg text-xs font-mono cursor-grab active:cursor-grabbing transition-all flex items-center gap-2 group shadow-sm"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                  {header}
                </div>
              ))}
              {sheetHeaders.length === 0 && (
                <div className="text-xs text-muted-foreground italic p-4 text-center w-full">No headers found in your sheet.</div>
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-border/50">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">Pro Tip</p>
              <p className="text-xs text-muted-foreground">
                You can also use these placeholders in the <strong>Subject Line</strong>!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
