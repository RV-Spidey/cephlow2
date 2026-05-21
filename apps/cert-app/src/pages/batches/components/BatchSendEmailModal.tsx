import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Send } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  emailSubject: string;
  onSubjectChange: (v: string) => void;
  emailBody: string;
  onBodyChange: (v: string) => void;
  isSending: boolean;
  onSend: () => void;
  batchName: string;
  rowDataHeaders: string[];
}

export function BatchSendEmailModal({ open, onOpenChange, emailSubject, onSubjectChange, emailBody, onBodyChange, isSending, onSend, batchName, rowDataHeaders }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Send Certificates</DialogTitle>
          <DialogDescription>
            This will send emails with the generated PDF certificates attached to all recipients who haven't received them yet.
          </DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-3 gap-6 py-4">
          <div className="md:col-span-2 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject Line</label>
              <Input
                value={emailSubject}
                onChange={e => onSubjectChange(e.target.value)}
                placeholder="e.g. Your certificate is ready!"
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
              <label className="text-sm font-medium">Email Body</label>
              <Textarea
                value={emailBody}
                onChange={e => onBodyChange(e.target.value)}
                rows={8}
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
            <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 h-full">
              <label className="text-sm font-semibold mb-3 block">Placeholders</label>
              <p className="text-[10px] text-muted-foreground mb-3">Drag and drop to insert</p>
              <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[250px] pr-1">
                <div
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", batchName); e.dataTransfer.effectAllowed = "copy"; }}
                  className="bg-background border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground px-2 py-1 rounded-md text-[11px] font-mono cursor-grab active:cursor-grabbing transition-all flex items-center gap-1.5 group shadow-sm"
                >
                  <div className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                  Batch Name
                </div>
                {rowDataHeaders.map(header => (
                  <div
                    key={header}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", `<<${header}>>`); e.dataTransfer.effectAllowed = "copy"; }}
                    className="bg-background border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground px-2 py-1 rounded-md text-[11px] font-mono cursor-grab active:cursor-grabbing transition-all flex items-center gap-1.5 group shadow-sm"
                  >
                    <div className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                    {header}
                  </div>
                ))}
                {rowDataHeaders.length === 0 && (
                  <div className="text-[10px] text-muted-foreground italic text-center w-full py-4">No data fields available.</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSend} disabled={isSending || !emailSubject || !emailBody}>
            {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
