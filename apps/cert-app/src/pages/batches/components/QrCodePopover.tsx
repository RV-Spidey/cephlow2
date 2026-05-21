import { useState } from "react";
import { useApproval } from "@/hooks/use-approval";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QrCode, Copy, Check } from "lucide-react";

export function QrCodePopover({ batchId, certId }: { batchId: string; certId: string }) {
  const [copied, setCopied] = useState(false);
  const { isApproved } = useApproval();
  const verifyUrl = `${window.location.origin}/verify/${batchId}/${certId}`;
  const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const qrSrc = `${apiBase}/api/verify/${batchId}/${certId}/qr`;

  // Free tier doesn't get public verification pages — hide the QR popover
  // entirely so users don't share a URL that won't resolve.
  if (!isApproved) return null;

  const copyUrl = () => {
    navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="hover-elevate" title="View QR Code">
          <QrCode className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4 text-center space-y-3" align="end">
        <p className="text-sm font-semibold text-foreground">Scan to Verify</p>
        <img src={qrSrc} alt="Certificate QR Code" className="w-40 h-40 mx-auto rounded-lg border" />
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={verifyUrl}
            className="flex-1 text-xs bg-muted rounded px-2 py-1 text-muted-foreground truncate border"
          />
          <Button variant="ghost" size="sm" onClick={copyUrl} className="shrink-0 px-2">
            {copied ? <Check className="w-3.5 h-3.5 text-foreground" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
