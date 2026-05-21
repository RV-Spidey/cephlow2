import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Send } from "lucide-react";

interface Props {
  cert: any | null;
  onClose: () => void;
  emailSubject: string;
  onSubjectChange: (v: string) => void;
  emailBody: string;
  onBodyChange: (v: string) => void;
  isSending: boolean;
  onSend: () => void;
}

export function BatchIndivEmailModal({ cert, onClose, emailSubject, onSubjectChange, emailBody, onBodyChange, isSending, onSend }: Props) {
  return (
    <Dialog open={!!cert} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Certificate — {cert?.recipientName}</DialogTitle>
          <DialogDescription>
            Sending to <strong>{cert?.recipientEmail}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject Line</label>
            <Input value={emailSubject} onChange={e => onSubjectChange(e.target.value)} placeholder="e.g. Your certificate is ready!" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Body</label>
            <Textarea value={emailBody} onChange={e => onBodyChange(e.target.value)} rows={6} className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSend} disabled={isSending || !emailSubject || !emailBody}>
            {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
