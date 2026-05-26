import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { format } from "date-fns";

export interface ReportDetail { message: string; phone: string; created_at: string; }

interface Props {
  activeReport: { cert: any; report: ReportDetail } | null;
  onClose: () => void;
  getCertKey: (cert: any) => string | null;
}

export function BatchIssueReportDialog({ activeReport, onClose, getCertKey }: Props) {
  return (
    <Dialog open={!!activeReport} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Issue Report
          </DialogTitle>
          <DialogDescription>
            Submitted by <strong>{activeReport?.cert?.recipientName}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-border p-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipient</p>
              <p className="text-sm font-medium">{activeReport?.cert?.recipientName}</p>
            </div>
            <div className="border border-border p-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reported At</p>
              <p className="text-sm font-medium">
                {activeReport?.report?.created_at ? format(new Date(activeReport.report.created_at), 'MMM d, yyyy · HH:mm') : '—'}
              </p>
            </div>
            <div className="border border-border p-3 space-y-1 col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Certificate</p>
              <p className="text-sm font-medium font-mono break-all">
                {activeReport?.cert?.r2PdfUrl ? getCertKey(activeReport.cert)?.split('/').pop() : '—'}
              </p>
            </div>
          </div>
          <div className="border border-border p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Issue Description</p>
            <p className="text-sm leading-relaxed">{activeReport?.report?.message}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
