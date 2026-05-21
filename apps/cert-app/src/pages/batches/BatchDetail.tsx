import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useClientGenerate } from "@/hooks/useClientGenerate";
import { LockedFeature } from "@/components/LockedFeature";
import { useApproval } from "@/hooks/use-approval";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBatch,
  useSendBatch,
  useShareBatchFolder,
  getGetBatchQueryKey,
  useSendBatchWhatsapp,
  useSendCertEmail,
  useOpenCertSlide,
  useSendCertWhatsapp,
  useSyncBatch,
  useGetWalletBalance,
  customFetch,
} from "@workspace/api-client-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Play, Send, MailCheck, Loader2, FileText, CheckCircle2, XCircle, Clock, Share2, ExternalLink, QrCode, Copy, Check, MessageCircle, CheckCheck, Truck, RefreshCcw, Grid, Layout, Mail, Layers, Presentation, FileSpreadsheet, AlertCircle, X, Upload, Award, CalendarDays, ShieldCheck, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function QrCodePopover({ batchId, certId }: { batchId: string; certId: string }) {
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



export default function BatchDetail() {
  const [, params] = useRoute("/batches/:id");
  const batchId = params?.id ?? "";

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isApproved } = useApproval();

  const { data: batch, isLoading, refetch } = useGetBatch(batchId as any, {
    query: {
      enabled: !!batchId,
      refetchInterval: (query: any) => {
        const status = (query.state.data as any)?.status;
        return status === "generating" || status === "sending" ? 2000 : false;
      }
    } as any
  });

  const [selectedCertIds, setSelectedCertIds] = useState<string[]>([]);
  const [bannerUploading, setBannerUploading] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);
  const [bannerPreviewFile, setBannerPreviewFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [bannerOverlayOpacity, setBannerOverlayOpacity] = useState(0.70);
  const [bannerTextColor, setBannerTextColor] = useState<string>("default");
  const [bannerCropZoom, setBannerCropZoom] = useState(1.0);
  const [bannerCropX, setBannerCropX] = useState(50);
  const [bannerCropY, setBannerCropY] = useState(50);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const [imageBounds, setImageBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const handleBannerUpload = async (file: File) => {
    setBannerUploading(true);
    try {
      await customFetch(`/api/batches/${batchId}/banner`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      queryClient.invalidateQueries({ queryKey: getGetBatchQueryKey(batchId) });
      toast({ title: "Banner updated" });
    } catch (err: any) {
      toast({ title: "Banner upload failed", description: err.message, variant: "destructive" });
    } finally {
      setBannerUploading(false);
    }
  };

  const handleBannerEditorOpen = () => {
    setBannerPreviewFile(null);
    setBannerPreviewUrl((batch as any).bannerUrl ?? null);
    setBannerOverlayOpacity((batch as any).bannerOverlayOpacity ?? 0.70);
    setBannerTextColor((batch as any).bannerTextColor ?? "default");
    setBannerCropZoom((batch as any).bannerCropZoom ?? 1.0);
    setBannerCropX((batch as any).bannerCropX ?? 50);
    setBannerCropY((batch as any).bannerCropY ?? 50);
    setBannerEditorOpen(true);
  };

  const handleBannerEditorFileChange = (file: File) => {
    setBannerPreviewFile(file);
    const url = URL.createObjectURL(file);
    setBannerPreviewUrl(url);
    setBannerCropZoom(1.0);
    setBannerCropX(50);
    setBannerCropY(50);
    // Auto-detect best text colour via WCAG contrast ratio
    const img = new Image();
    img.onload = () => {
      const W = 64, H = 32;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, W, H);
      const { data } = ctx.getImageData(0, 0, W, H);
      let rSum = 0, gSum = 0, bSum = 0;
      const px = W * H;
      for (let i = 0; i < data.length; i += 4) {
        rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
      }
      const avgR = rSum / px / 255, avgG = gSum / px / 255, avgB = bSum / px / 255;
      const lin = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      const bgLum = 0.2126 * lin(avgR) + 0.7152 * lin(avgG) + 0.0722 * lin(avgB);
      const contrast = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const fgLum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        const hi = Math.max(bgLum, fgLum), lo = Math.min(bgLum, fgLum);
        return (hi + 0.05) / (lo + 0.05);
      };
      const palette = ["#FFFFFF", "#000000", "#FFD700", "#00E5FF", "#FF6B6B", "#CCFF00", "#FF9800", "#E040FB"];
      const best = palette.reduce((a, b) => contrast(a) >= contrast(b) ? a : b);
      setBannerTextColor(best);
    };
    img.src = url;
  };

  const updateImageBounds = () => {
    if (!cropImageRef.current || !cropContainerRef.current) return;
    const imgRect = cropImageRef.current.getBoundingClientRect();
    const containerRect = cropContainerRef.current.getBoundingClientRect();
    setImageBounds({
      left: imgRect.left - containerRect.left,
      top: imgRect.top - containerRect.top,
      width: imgRect.width,
      height: imgRect.height,
    });
  };

  // Aspect ratio matches a typical profile-page card: ~300px wide / minHeight 140px
  const CARD_BANNER_ASPECT = 300 / 140;

  const handleCropRectDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!imageBounds) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startCropX = bannerCropX;
    const startCropY = bannerCropY;
    const { width: iw, height: ih } = imageBounds;
    const zoom = bannerCropZoom;
    // Crop rect half-size as % of full image — used to keep rect inside image bounds
    const oc_w = Math.min(iw, ih * CARD_BANNER_ASPECT);
    const oc_h = oc_w / CARD_BANNER_ASPECT;
    const halfX = (oc_w / (2 * zoom)) / iw * 100;
    const halfY = (oc_h / (2 * zoom)) / ih * 100;
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / iw * 100;
      const dy = (ev.clientY - startY) / ih * 100;
      setBannerCropX(Math.max(halfX, Math.min(100 - halfX, startCropX + dx)));
      setBannerCropY(Math.max(halfY, Math.min(100 - halfY, startCropY + dy)));
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleCropRectTouchStart = (e: React.TouchEvent) => {
    if (!imageBounds || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const startCropX = bannerCropX;
    const startCropY = bannerCropY;
    const { width: iw, height: ih } = imageBounds;
    const zoom = bannerCropZoom;
    const oc_w = Math.min(iw, ih * CARD_BANNER_ASPECT);
    const oc_h = oc_w / CARD_BANNER_ASPECT;
    const halfX = (oc_w / (2 * zoom)) / iw * 100;
    const halfY = (oc_h / (2 * zoom)) / ih * 100;
    const onMove = (ev: TouchEvent) => {
      ev.preventDefault();
      if (ev.touches.length !== 1) return;
      const t = ev.touches[0];
      const dx = (t.clientX - startX) / iw * 100;
      const dy = (t.clientY - startY) / ih * 100;
      setBannerCropX(Math.max(halfX, Math.min(100 - halfX, startCropX + dx)));
      setBannerCropY(Math.max(halfY, Math.min(100 - halfY, startCropY + dy)));
    };
    const onUp = () => { window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp); };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  };

  const handleBannerEditorConfirm = async () => {
    setBannerUploading(true);
    try {
      if (bannerPreviewFile) {
        await customFetch(`/api/batches/${batchId}/banner`, {
          method: "POST",
          headers: { "Content-Type": bannerPreviewFile.type },
          body: bannerPreviewFile,
        });
      }
      await customFetch(`/api/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bannerOverlayOpacity, bannerTextColor, bannerCropZoom, bannerCropX, bannerCropY }),
      });
      queryClient.invalidateQueries({ queryKey: getGetBatchQueryKey(batchId) });
      toast({ title: "Banner updated" });
    } catch (err: any) {
      toast({ title: "Banner update failed", description: err.message, variant: "destructive" });
    } finally {
      setBannerUploading(false);
    }
    setBannerEditorOpen(false);
    if (bannerPreviewUrl && bannerPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(bannerPreviewUrl);
    }
  };

  // Certs still needing generation (used for resume path)
  const allCerts = (batch?.certificates || []) as any[];
  
  const sortedCertificates = [...allCerts].sort((a, b) => {
    const priority: Record<string, number> = {
      sent: 1,
      generated: 2,
      failed: 3,
      outdated: 4,
      generating: 5,
      pending: 6,
    };
    const pA = priority[a.status.toLowerCase()] || 99;
    const pB = priority[b.status.toLowerCase()] || 99;
    if (pA !== pB) return pA - pB;
    return (a.recipientName || "").localeCompare(b.recipientName || "");
  });

  const pendingCerts = allCerts.filter((c: any) => ["pending", "failed"].includes(c.status));
  const pendingCount = pendingCerts.length;

  // Calculate unpaid count from selected certificates
  const targetCerts = selectedCertIds.length > 0
    ? allCerts.filter((c: any) => selectedCertIds.includes(c.id))
    : allCerts;
  const unpaidCount = targetCerts.filter((c: any) => !c.isPaid).length;
  const visualRegenCount = targetCerts.filter((c: any) => c.isPaid && c.status === "outdated" && c.requiresVisualRegen).length;
  const infoRegenCount = targetCerts.filter((c: any) => c.isPaid && c.status === "outdated" && !c.requiresVisualRegen).length;

  const RATE = Number(import.meta.env.VITE_CERT_GENERATION_RATE || 1);
  const REGEN_RATE = Number(import.meta.env.VITE_CERT_REGENERATION_RATE || 0.2);
  const totalCost = (unpaidCount * RATE) + (visualRegenCount * REGEN_RATE);

  // Whether clicking Generate with no selection is valid (resume all remaining)
  const canResumeAll = selectedCertIds.length === 0 && pendingCount > 0;

  const generateBtnText = selectedCertIds.length > 0
    ? (unpaidCount > 0 ? `Generate Selected (${selectedCertIds.length})` : `Regenerate Selected (${selectedCertIds.length})`)
    : batch?.status === "partial"
      ? `Resume (${pendingCount} remaining)`
      : `Generate All (${pendingCount})`;

  const { data: balanceData, refetch: refetchBalance } = useGetWalletBalance();
  const currentBalance = balanceData?.currentBalance ?? 0;
  
  // Dynamic capacity based on what's available
  const generationLimit = Math.floor(currentBalance / RATE);

  // Client-side generation hook
  const { generate: clientGenerateFn, cancel: cancelGeneration, isGenerating, progress: genProgress, error: genError } = useClientGenerate();

  const handleGenerate = async () => {
    try {
      const result = await clientGenerateFn(batchId, selectedCertIds.length > 0 ? selectedCertIds : undefined);
      toast({ 
        title: result.failed === 0 ? "Generation complete!" : "Generation partially complete",
        description: result.failed === 0 
          ? `All ${result.generated} certificates generated successfully.`
          : `${result.generated} generated, ${result.failed} failed.`,
        variant: result.failed > 0 ? "destructive" : undefined,
      });
      refetch();
      refetchBalance();
    } catch (err: any) {
      const isCancelled = err.message === "Generation cancelled";
      const isLowBalance = err.message?.includes('Insufficient funds') || err.message?.includes('402');
      toast({ 
        title: isCancelled ? "Generation cancelled" : isLowBalance ? "Insufficient Balance" : "Generation failed", 
        description: isCancelled
          ? "Generation was cancelled. Certificates processed so far have been saved."
          : isLowBalance 
          ? "Your wallet balance is too low to generate this batch. Please add credits to continue."
          : (err.message || "An unexpected error occurred"),
        variant: isCancelled ? undefined : "destructive",
        action: isLowBalance ? (
          <Button variant="outline" size="sm" onClick={() => window.location.href = '/wallet'}>
            Top Up
          </Button>
        ) : undefined
      });
      // Small delay so the server's client-complete write lands before we re-read
      setTimeout(() => { refetch(); refetchBalance(); }, 600);
    }
  };


  const { mutate: syncData, isPending: isSyncing } = useSyncBatch({
    mutation: {
      onSuccess: (data: any) => {
        toast({ 
          title: "Batch Synced!", 
          description: data.message || "Spreadsheet data synced successfully." 
        });
        refetch();
      },
      onError: (err: any) => toast({ title: "Sync failed", description: err.message || err.data?.error, variant: "destructive" })
    }
  });





  const { mutate: sendCerts, isPending: isSending } = useSendBatch({
    mutation: {
      onSuccess: () => {
        toast({ title: "Sending started!" });
        setSendModalOpen(false);
        refetch();
      },
      onError: (err: any) => toast({ title: "Send failed", description: err.message, variant: "destructive" })
    }
  });

  const uploadingToastDismiss = useRef<(() => void) | null>(null);
  const { mutate: shareFolder, isPending: isSharing } = useShareBatchFolder({
    mutation: {
      onMutate: () => {
        if (!batch?.pdfFolderId) {
          const { dismiss } = toast({
            title: "Uploading to Drive...",
            description: "Uploading certificates to Google Drive. This may take a moment.",
            duration: Infinity,
          });
          uploadingToastDismiss.current = dismiss;
        }
      },
      onSuccess: (data: any) => {
        uploadingToastDismiss.current?.();
        uploadingToastDismiss.current = null;
        toast({
          title: "Folder Shared!",
          description: "Anyone with the link can now view the PDF certificates.",
          action: (
            <Button variant="outline" size="sm" asChild>
              <a href={data.shareLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" /> Open Link
              </a>
            </Button>
          )
        });
      },
      onError: (err: any) => {
        uploadingToastDismiss.current?.();
        uploadingToastDismiss.current = null;
        toast({ title: "Sharing failed", description: err.message, variant: "destructive" });
      }
    }
  });

  const { mutate: sendWhatsapp, isPending: isSendingWhatsapp } = useSendBatchWhatsapp({
    mutation: {
      onSuccess: () => {
        toast({ title: "WhatsApp sending started!" });
        setWaModalOpen(false);
        refetch();
      },
      onError: (err: any) => toast({ title: "WhatsApp send failed", description: err.message, variant: "destructive" })
    }
  });

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waVar1, setWaVar1] = useState("");
  const [waVar2, setWaVar2] = useState("");
  const [waVar3, setWaVar3] = useState("<<EmailPrefix>>");

  // Individual certificate send
  const [indivEmailCert, setIndivEmailCert] = useState<any | null>(null);
  const [indivEmailSubject, setIndivEmailSubject] = useState("");
  const [indivEmailBody, setIndivEmailBody] = useState("");
  const [indivWaCert, setIndivWaCert] = useState<any | null>(null);
  const [indivWaVar1, setIndivWaVar1] = useState("");
  const [indivWaVar2, setIndivWaVar2] = useState("");
  const [indivWaVar3, setIndivWaVar3] = useState("<<EmailPrefix>>");

  const [openingSlideCertId, setOpeningSlideCertId] = useState<string | null>(null);
  const { mutateAsync: openCertSlideAsync } = useOpenCertSlide();

  const handleOpenSlide = async (cert: any) => {
    if (cert.slideUrl) {
      window.open(cert.slideUrl, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      setOpeningSlideCertId(cert.id);
      const res = await openCertSlideAsync({ batchId, certId: cert.id });
      refetch();
      if (res?.slideUrl) window.open(res.slideUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast({ title: "Open Slides failed", description: err?.message || err?.data?.error, variant: "destructive" });
    } finally {
      setOpeningSlideCertId(null);
    }
  };

  const { mutate: sendOneCertEmail, isPending: isSendingOne } = useSendCertEmail({
    mutation: {
      onSuccess: () => {
        toast({ title: "Certificate sent!" });
        setIndivEmailCert(null);
        refetch();
      },
      onError: (err: any) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
    },
  });

  const { mutate: sendOneCertWa, isPending: isSendingOneWa } = useSendCertWhatsapp({
    mutation: {
      onSuccess: () => {
        toast({ title: "WhatsApp sent!" });
        setIndivWaCert(null);
        refetch();
      },
      onError: (err: any) => toast({ title: "WhatsApp send failed", description: err.message, variant: "destructive" }),
    },
  });

  const handleOpenIndivEmail = (cert: any) => {
    setIndivEmailCert(cert);
    setIndivEmailSubject((batch as any).emailSubject || "");
    setIndivEmailBody((batch as any).emailBody || "");
  };

  const handleOpenIndivWa = (cert: any) => {
    setIndivWaCert(cert);
    setIndivWaVar1((batch as any).nameColumn ? `<<${(batch as any).nameColumn}>>` : "");
    setIndivWaVar2((batch as any).name || "");
  };

  interface ReportDetail { message: string; phone: string; created_at: string; }
  const [reportsByCertKey, setReportsByCertKey] = useState<Map<string, ReportDetail>>(new Map());
  const [activeReport, setActiveReport] = useState<{ cert: any; report: ReportDetail } | null>(null);
  const seenReportKeysRef = useRef<Set<string>>(new Set());
  const initialReportsLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    const workerUrl = import.meta.env.VITE_WA_WORKER_URL?.replace(/\/$/, '');
    const token = import.meta.env.VITE_WA_ANALYTICS_TOKEN;
    if (!workerUrl || !token) return;

    let cancelled = false;
    const loadReports = () => {
      fetch(`${workerUrl}/reports?token=${token}`)
        .then(r => r.json())
        .then((data: { cert_key?: string; message: string; phone: string; created_at: string }[]) => {
          if (cancelled) return;
          const scoped = data.filter(r => r.cert_key);
          const map = new Map<string, ReportDetail>();
          scoped.forEach(r => map.set(r.cert_key!, { message: r.message, phone: r.phone, created_at: r.created_at }));
          setReportsByCertKey(map);

          // Notify on new reports (after the initial load)
          const seen = seenReportKeysRef.current;
          const currentBatchCertKeys = new Set<string>(
              ((batch?.certificates as any[]) || [])
                .map((c: any) => {
                  if (!c.r2PdfUrl) return null;
                  try { return decodeURIComponent(new URL(c.r2PdfUrl).pathname.slice(1)); } catch { return null; }
                })
                .filter((k): k is string => !!k)
          );

          const newReports: { cert_key: string; message: string; phone: string; created_at: string }[] = [];
          for (const r of scoped) {
            const dedupKey = `${r.cert_key}|${r.created_at}`;
            if (!seen.has(dedupKey)) {
              seen.add(dedupKey);
              if (initialReportsLoadedRef.current && currentBatchCertKeys.has(r.cert_key!)) {
                newReports.push(r as any);
              }
            }
          }

          if (!initialReportsLoadedRef.current) {
            initialReportsLoadedRef.current = true;
          } else if (newReports.length > 0) {
            if (newReports.length === 1) {
              const r = newReports[0];
              const certName = r.cert_key.split('/').pop() || r.cert_key;
              toast({
                title: "New issue reported",
                description: `${certName}: "${r.message}"`,
              });
            } else {
              toast({
                title: `${newReports.length} new issue reports`,
                description: "Recipients reported issues with their certificates via WhatsApp.",
              });
            }
          }
        })
        .catch(() => {});
    };

    loadReports();
    const intervalId = window.setInterval(loadReports, 15000);
    const onFocus = () => loadReports();
    const onVisibility = () => { if (document.visibilityState === 'visible') loadReports(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [batch, toast]);

  // ── Stuck-batch auto-recovery ─────────────────────────────────────────────
  // If the tab was force-closed (device off, browser killed, network drop)
  // during generation, the batch stays at status="generating" permanently.
  // Detect this: status="generating" but isGenerating=false (no local run).
  // Wait 2 s to let any in-flight sendBeacon from the *previous* session land,
  // then call recover-stuck which recomputes status from cert rows.
  useEffect(() => {
    if (batch?.status !== "generating" || isGenerating) return;

    const timer = setTimeout(async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;

        const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
        const wsId = localStorage.getItem("cephlow_active_workspace");
        const res = await fetch(`${apiBaseUrl}/api/batches/${batchId}/recover-stuck`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(wsId ? { "x-workspace-id": wsId } : {}),
          },
        });
        if (!res.ok) return;

        const data = await res.json();
        if (data.recovered) {
          refetch();
          toast({
            title: "Generation interrupted",
            description:
              data.status === "partial"
                ? `Previous session was interrupted. ${data.doneCount}/${data.totalCount} certificates were saved. Click Resume to continue.`
                : data.status === "generated"
                ? "All certificates were already generated — status has been corrected."
                : "No certificates were saved from the previous session. You can start again.",
          });
        }
      } catch { /* best-effort */ }
    }, 2000);

    return () => clearTimeout(timer);
  }, [batch?.status, isGenerating, batchId, refetch, toast]);

  // ── Auto-sync student profiles for approved orgs ──────────────────────────
  // Fires once per batch view when the batch is sent/generated and user is
  // approved. Idempotent on the server — safe to call every time.
  useEffect(() => {
    if (!isApproved) return;
    if (!batchId) return;
    const status = batch?.status;
    if (status !== "sent" && status !== "generated" && status !== "partial") return;

    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
        const wsId = localStorage.getItem("cephlow_active_workspace");
        await fetch(`${apiBase}/api/batches/${batchId}/sync-profiles`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(wsId ? { "x-workspace-id": wsId } : {}),
          },
        });
      } catch { /* best-effort */ }
    })();
  }, [batchId, batch?.status, isApproved]);
  // ──────────────────────────────────────────────────────────────────────────

  // Recompute image bounds when editor opens, image URL changes, or container resizes
  useEffect(() => {
    if (!bannerEditorOpen || !bannerPreviewUrl) { setImageBounds(null); return; }
    const timer = setTimeout(updateImageBounds, 80);
    return () => clearTimeout(timer);
  }, [bannerEditorOpen, bannerPreviewUrl]);

  useEffect(() => {
    if (!bannerEditorOpen || !cropContainerRef.current) return;
    const observer = new ResizeObserver(updateImageBounds);
    observer.observe(cropContainerRef.current);
    return () => observer.disconnect();
  }, [bannerEditorOpen]);

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>;
  if (!batch) return <div className="p-8 text-center text-muted-foreground">Batch not found</div>;


  const handleOpenSend = () => {
    setEmailSubject(batch.emailSubject || "");
    setEmailBody(batch.emailBody || "");
    setSendModalOpen(true);
  };

  const handleOpenWa = () => {
    setWaVar1(batch.nameColumn ? `<<${batch.nameColumn}>>` : "");
    setWaVar2(batch.name || "");
    setWaModalOpen(true);
  };

  const getCertKey = (cert: any): string | null => {
    if (!cert.r2PdfUrl) return null;
    try { return decodeURIComponent(new URL(cert.r2PdfUrl).pathname.slice(1)); } catch { return null; }
  };
  const certHasReport = (cert: any): boolean => {
    const key = getCertKey(cert);
    return !!key && reportsByCertKey.has(key);
  };
  const getCertReport = (cert: any): ReportDetail | null => {
    const key = getCertKey(cert);
    return key ? (reportsByCertKey.get(key) ?? null) : null;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-foreground text-background border-foreground';
      case 'generated': return 'bg-secondary text-secondary-foreground border-border';
      case 'generating': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'outdated': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'failed': return 'bg-background text-foreground border-foreground';
      default: return 'bg-background text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-display font-bold">{batch.name}</h1>
            <Badge className={`uppercase ${getStatusColor(batch.status)}`}>
              {batch.status.toLowerCase() === 'outdated' ? (
                batch.certificates?.some((c: any) => c.status === 'outdated' && c.requiresVisualRegen) 
                  ? "Outdated (Visual)" 
                  : "Outdated (Info)"
              ) : batch.status}
            </Badge>
          </div>
          <p className="text-muted-foreground flex items-center gap-4 text-sm">
            <span>Created {format(new Date(batch.createdAt), 'MMM d, yyyy')}</span>
            <span>•</span>
            <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> {batch.sheetName}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <Button
            variant="outline"
            size="sm"
            asChild
            className="hover-elevate bg-background"
            title="Edit Google Sheet"
          >
            <a href={`https://docs.google.com/spreadsheets/d/${batch.sheetId}/edit`} target="_blank" rel="noopener noreferrer">
              <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
              Edit Sheet
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncData({ batchId })}
            disabled={isSyncing || batch.status === 'generating'}
            className="hover-elevate bg-background"
            title="Pull latest data from Google Sheet"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
            Sync Data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => shareFolder({ batchId })}
            disabled={isSharing || batch.generatedCount === 0}
            className="hover-elevate bg-background"
          >
            {isSharing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
            Share PDFs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBannerEditorOpen}
            disabled={bannerUploading}
            className="hover-elevate bg-background"
          >
            {bannerUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
            {(batch as any).bannerUrl ? "Edit Banner" : "Add Banner"}
          </Button>
          <div className="relative flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating || batch.status === 'generating' || (!canResumeAll && selectedCertIds.length === 0)}
              className="hover-elevate bg-background relative"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {isGenerating ? 'Generating...' : generateBtnText}
            </Button>
            {isGenerating && (
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelGeneration}
                className="px-2"
                title="Cancel generation"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[10px] text-muted-foreground whitespace-nowrap">
              Generation Limit: {generationLimit.toLocaleString()}
            </span>
          </div>
          <Button
            onClick={handleOpenSend}
            disabled={isSending || batch.status === 'sending' || batch.generatedCount === 0}
            className="hover-elevate"
          >
            {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Emails
          </Button>
          <LockedFeature feature="WhatsApp delivery" inline>
            <Button
              variant="outline"
              onClick={handleOpenWa}
              disabled={isSendingWhatsapp || batch.status === 'sending' || batch.generatedCount === 0}
              className="hover-elevate bg-background"
            >
              {isSendingWhatsapp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
              Send via WhatsApp
            </Button>
          </LockedFeature>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border/50 bg-card shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-secondary rounded-xl"><FileText className="w-6 h-6 text-muted-foreground" /></div>
            <div>
              <div className="text-2xl font-bold font-display">{batch.totalCount}</div>
              <div className="text-sm font-medium text-muted-foreground">Total Recipients</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-secondary rounded-xl"><CheckCircle2 className="w-6 h-6 text-muted-foreground" /></div>
            <div>
              <div className="text-2xl font-bold font-display">{batch.generatedCount}</div>
              <div className="text-sm font-medium text-muted-foreground">Generated</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-secondary rounded-xl"><MailCheck className="w-6 h-6 text-muted-foreground" /></div>
            <div>
              <div className="text-2xl font-bold font-display">{batch.sentCount}</div>
              <div className="text-sm font-medium text-muted-foreground">Successfully Sent</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* In-app warning shown while generation is active */}
      {isGenerating && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Generation in progress — do not close or reload this page. Your progress will be lost.</span>
        </div>
      )}

      {/* Client-side generation progress bar */}
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
                {genProgress.total > 0 && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {genProgress.current}/{genProgress.total}
                  </span>
                )}
              </div>
              {genProgress.total > 0 && (
                <Progress
                  value={(genProgress.current / genProgress.total) * 100}
                  className="h-2"
                />
              )}
              <p className="text-xs text-muted-foreground truncate">
                {genProgress.message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="w-[50px] text-center">
                  <Checkbox 
                    checked={batch.certificates?.length > 0 && selectedCertIds.length === batch.certificates.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCertIds(batch.certificates?.map((c: any) => c.id) || []);
                      } else {
                        setSelectedCertIds([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead>Status</TableHead>
                {batch.categoryColumn && batch.categoryTemplateMap && (
                  <TableHead className="hidden lg:table-cell">Template</TableHead>
                )}
                <TableHead className="hidden md:table-cell">Sent At</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCertificates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={batch.categoryColumn && batch.categoryTemplateMap ? 7 : 6} className="h-32 text-center text-muted-foreground">No recipients found.</TableCell>
                </TableRow>
              ) : (
                sortedCertificates.map((cert: any) => (
                  <TableRow key={cert.id} className={certHasReport(cert) ? 'bg-foreground text-background [&_*]:text-background [&_*]:border-background hover:bg-foreground' : 'hover:bg-muted/50 transition-colors'}>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={selectedCertIds.includes(cert.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCertIds(prev => [...prev, cert.id]);
                          } else {
                            setSelectedCertIds(prev => prev.filter(id => id !== cert.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {cert.recipientName}
                        {cert.isPaid && <Badge variant="secondary" className={`text-[10px] px-1 py-0 h-4 ${certHasReport(cert) ? 'bg-background/20 text-background border-background/30' : ''}`}>Paid</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{cert.recipientEmail}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={getStatusColor(cert.status)}>
                          {cert.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                          {cert.status === 'generating' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                          {cert.status.toLowerCase() === 'outdated' && (
                            <>
                              {cert.requiresVisualRegen ? (
                                <><AlertCircle className="w-3 h-3 mr-1" /> Outdated (Visual)</>
                              ) : (
                                <><Loader2 className="w-3 h-3 mr-1" /> Outdated (Info)</>
                              )}
                            </>
                          )}
                          {cert.status === 'generated' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {cert.status === 'sent' && <MailCheck className="w-3 h-3 mr-1" />}
                          {cert.status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                          {cert.status.toLowerCase() !== 'outdated' && cert.status}
                        </Badge>
                        {cert.status === 'failed' && cert.errorMessage && (
                          <span className="text-[11px] text-muted-foreground max-w-[200px] truncate" title={cert.errorMessage}>
                            {cert.errorMessage}
                          </span>
                        )}
                        {cert.whatsappStatus && (
                          <Badge variant="outline" className={
                            certHasReport(cert)
                              ? 'bg-transparent text-background border-background/40'
                              : cert.whatsappStatus === 'read'
                              ? 'border-blue-400 text-blue-600 bg-blue-50'
                              : cert.whatsappStatus === 'delivered'
                              ? 'border-green-400 text-green-600 bg-green-50'
                              : cert.whatsappStatus === 'wa_failed'
                              ? 'border-red-400 text-red-600 bg-red-50'
                              : 'border-border text-muted-foreground'
                          }>
                            {cert.whatsappStatus === 'read' && <CheckCheck className="w-3 h-3 mr-1" />}
                            {cert.whatsappStatus === 'delivered' && <Truck className="w-3 h-3 mr-1" />}
                            {cert.whatsappStatus === 'wa_failed' && <XCircle className="w-3 h-3 mr-1" />}
                            {cert.whatsappStatus === 'sent' && <MessageCircle className="w-3 h-3 mr-1" />}
                            WA: {cert.whatsappStatus === 'wa_failed' ? 'failed' : cert.whatsappStatus}
                          </Badge>
                        )}
                        {getCertReport(cert) && (
                          <span
                            onClick={() => setActiveReport({ cert, report: getCertReport(cert)! })}
                            className="text-[11px] opacity-80 italic normal-case tracking-normal font-normal line-clamp-2 max-w-[220px] cursor-pointer underline underline-offset-2"
                          >
                            "{getCertReport(cert)!.message}"
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {batch.categoryColumn && batch.categoryTemplateMap && (() => {
                      const condVal = cert.rowData?.[batch.categoryColumn] ?? "";
                      const mapped = condVal && batch.categoryTemplateMap[condVal];
                      const tplName = mapped ? mapped.templateName : batch.templateName;
                      const isRouted = !!(condVal && mapped);
                      return (
                        <TableCell className="hidden lg:table-cell">
                          <span className={`text-xs font-mono px-1.5 py-0.5 border ${isRouted ? "border-amber-400/60 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "border-border text-muted-foreground"}`}>
                            {tplName || "—"}
                          </span>
                        </TableCell>
                      );
                    })()}
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {cert.sentAt ? format(new Date(cert.sentAt), 'MMM d, h:mm a') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {(cert.status === 'generated' || cert.status === 'sent') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover-elevate"
                            disabled={openingSlideCertId === cert.id}
                            onClick={() => handleOpenSlide(cert)}
                          >
                            {openingSlideCertId === cert.id ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : null}
                            Slides
                          </Button>
                        )}
                        {(cert.r2PdfUrl || cert.pdfUrl) && (
                          <Button variant="outline" size="sm" asChild className="hover-elevate">
                            <a href={`${(cert.r2PdfUrl || cert.pdfUrl)}${(cert.r2PdfUrl || cert.pdfUrl).includes('?') ? '&' : '?'}v=${cert.updatedAt ? encodeURIComponent(cert.updatedAt) : Date.now()}`} target="_blank" rel="noopener noreferrer">PDF</a>
                          </Button>
                        )}
                        {(cert.status === 'generated' || cert.status === 'sent' || cert.status === 'failed') && cert.slideUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="hover-elevate"
                            title="Send email"
                            onClick={() => handleOpenIndivEmail(cert as any)}
                          >
                            <Send className="w-3.5 h-3.5 mr-1" />
                            Email
                          </Button>
                        )}
                        {(cert.status === 'generated' || cert.status === 'sent' || cert.status === 'failed') && (cert as any).r2PdfUrl && (
                          <LockedFeature feature="WhatsApp delivery" inline>
                            <Button
                              variant="outline"
                              size="sm"
                              className="hover-elevate"
                              title="Send via WhatsApp"
                              onClick={() => handleOpenIndivWa(cert as any)}
                            >
                              <MessageCircle className="w-3.5 h-3.5 mr-1" />
                              WA
                            </Button>
                          </LockedFeature>
                        )}
                        {(cert.status === 'generated' || cert.status === 'sent') && (
                          <QrCodePopover batchId={batchId} certId={cert.id} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
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
                  onChange={e => setEmailSubject(e.target.value)} 
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
                      const newValue = emailSubject.substring(0, start) + text + emailSubject.substring(end);
                      setEmailSubject(newValue);
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Body</label>
                <Textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
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
                      const newValue = emailBody.substring(0, start) + text + emailBody.substring(end);
                      setEmailBody(newValue);
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 h-full">
                <label className="text-sm font-semibold mb-3 block">Placeholders</label>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Drag and drop to insert
                </p>
                
                <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[250px] pr-1">
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", batch.name);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="bg-background border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground px-2 py-1 rounded-md text-[11px] font-mono cursor-grab active:cursor-grabbing transition-all flex items-center gap-1.5 group shadow-sm"
                  >
                    <div className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                    Batch Name
                  </div>
                  {batch.certificates[0]?.rowData ? (
                    Object.keys(batch.certificates[0].rowData).map(header => (
                      <div
                        key={header}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", `<<${header}>>`);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className="bg-background border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground px-2 py-1 rounded-md text-[11px] font-mono cursor-grab active:cursor-grabbing transition-all flex items-center gap-1.5 group shadow-sm"
                      >
                        <div className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                        {header}
                      </div>
                    ))
                  ) : (
                    <div className="text-[10px] text-muted-foreground italic text-center w-full py-4">
                      No data fields available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => sendCerts({ batchId: batchId as any, data: { emailSubject, emailBody } })}
              disabled={isSending || !emailSubject || !emailBody}
            >
              {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individual Email Send Modal */}
      <Dialog open={!!indivEmailCert} onOpenChange={(open) => { if (!open) setIndivEmailCert(null); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Send Certificate — {(indivEmailCert as any)?.recipientName}</DialogTitle>
            <DialogDescription>
              Sending to <strong>{(indivEmailCert as any)?.recipientEmail}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject Line</label>
              <Input value={indivEmailSubject} onChange={e => setIndivEmailSubject(e.target.value)} placeholder="e.g. Your certificate is ready!" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Body</label>
              <Textarea value={indivEmailBody} onChange={e => setIndivEmailBody(e.target.value)} rows={6} className="resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIndivEmailCert(null)}>Cancel</Button>
            <Button
              onClick={() => sendOneCertEmail({ batchId, certId: (indivEmailCert as any)?.id, data: { emailSubject: indivEmailSubject, emailBody: indivEmailBody } })}
              disabled={isSendingOne || !indivEmailSubject || !indivEmailBody}
            >
              {isSendingOne ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individual WhatsApp Send Modal */}
      <Dialog open={!!indivWaCert} onOpenChange={(open) => { if (!open) setIndivWaCert(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send via WhatsApp — {(indivWaCert as any)?.recipientName}</DialogTitle>
            <DialogDescription>
              Uses the <strong>document_senderv2</strong> template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 text-sm font-mono text-muted-foreground">
              Hi <span className="text-foreground font-semibold">{indivWaVar1 || "{{1}}"}</span>, your certificate for <span className="text-foreground font-semibold">{indivWaVar2 || "{{2}}"}</span> is attached below. you can always download this certificate by sending /cert to this bot. you can visit www.cephloe.com/<span className="text-foreground font-semibold">{indivWaVar3 || "{{3}}"}</span> it will act as a profile where you can see all your event certificates generated by Caphloe
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{"{{1}}"} — Participant Name</label>
              <Input value={indivWaVar1} onChange={e => setIndivWaVar1(e.target.value)} placeholder="e.g. <<Name>>" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{"{{2}}"} — Event Name</label>
              <Input value={indivWaVar2} onChange={e => setIndivWaVar2(e.target.value)} placeholder="e.g. batch name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{"{{3}}"} — Email Prefix (Profile URL)</label>
              <Input value={indivWaVar3} onChange={e => setIndivWaVar3(e.target.value)} placeholder="e.g. <<EmailPrefix>>" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIndivWaCert(null)}>Cancel</Button>
            <Button
              onClick={() => sendOneCertWa({ batchId, certId: (indivWaCert as any)?.id, data: { var1Template: indivWaVar1, var2Template: indivWaVar2, var3Template: indivWaVar3 } })}
              disabled={isSendingOneWa || !indivWaVar1 || !indivWaVar2}
              className=""
            >
              {isSendingOneWa ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
              Send via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Send Modal */}
      <Dialog open={waModalOpen} onOpenChange={setWaModalOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Send via WhatsApp</DialogTitle>
            <DialogDescription>
              Uses the <strong>document_senderv2</strong> template. The PDF certificate will be attached and sent to each recipient's phone number.
            </DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-3 gap-6 py-4">
            <div className="md:col-span-2 space-y-4">
              <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 text-sm font-mono text-muted-foreground mb-2">
                Hi <span className="text-foreground font-semibold">{waVar1 || "{{1}}"}</span>, your certificate for <span className="text-foreground font-semibold">{waVar2 || "{{2}}"}</span> is attached below. you can always download this certificate by sending /cert to this bot. you can visit www.cephloe.com/<span className="text-foreground font-semibold">{waVar3 || "{{3}}"}</span> it will act as a profile where you can see all your event certificates generated by Caphloe
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{"{{1}}"} — Participant Name</label>
                <Input
                  value={waVar1}
                  onChange={e => setWaVar1(e.target.value)}
                  placeholder="e.g. <<Name>>"
                  className="transition-all duration-200"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    const target = e.target as HTMLInputElement;
                    target.focus();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const text = e.dataTransfer.getData("text/plain");
                    if (text) setWaVar1(text);
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{"{{2}}"} — Event Name</label>
                <Input
                  value={waVar2}
                  onChange={e => setWaVar2(e.target.value)}
                  placeholder="e.g. batch name or <<EventName>>"
                  className="transition-all duration-200"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    const target = e.target as HTMLInputElement;
                    target.focus();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const text = e.dataTransfer.getData("text/plain");
                    if (text) setWaVar2(text);
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{"{{3}}"} — Email Prefix (Profile URL)</label>
                <Input
                  value={waVar3}
                  onChange={e => setWaVar3(e.target.value)}
                  placeholder="e.g. <<EmailPrefix>>"
                  className="transition-all duration-200"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    const target = e.target as HTMLInputElement;
                    target.focus();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const text = e.dataTransfer.getData("text/plain");
                    if (text) setWaVar3(text);
                  }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 h-full">
                <label className="text-sm font-semibold mb-3 block">Placeholders</label>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Drag and drop to insert
                </p>
                <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[250px] pr-1">
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", batch.name);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="bg-background border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground px-2 py-1 rounded-md text-[11px] font-mono cursor-grab active:cursor-grabbing transition-all flex items-center gap-1.5 group shadow-sm"
                  >
                    <div className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                    Batch Name
                  </div>
                  {batch.certificates[0]?.rowData ? (
                    Object.keys(batch.certificates[0].rowData).map(header => (
                      <div
                        key={header}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", `<<${header}>>`);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className="bg-background border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground px-2 py-1 rounded-md text-[11px] font-mono cursor-grab active:cursor-grabbing transition-all flex items-center gap-1.5 group shadow-sm"
                      >
                        <div className="w-1 h-1 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                        {header}
                      </div>
                    ))
                  ) : (
                    <div className="text-[10px] text-muted-foreground italic text-center w-full py-4">
                      No data fields available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => sendWhatsapp({ batchId, data: { var1Template: waVar1, var2Template: waVar2, var3Template: waVar3 } })}
              disabled={isSendingWhatsapp || !waVar1 || !waVar2}
              className=""
            >
              {isSendingWhatsapp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
              Send via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Banner Editor / Preview Dialog */}
      <Dialog open={bannerEditorOpen} onOpenChange={(open) => {
        if (!open && bannerPreviewUrl && bannerPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(bannerPreviewUrl);
        setBannerEditorOpen(open);
      }}>
        <DialogContent className="w-[95vw] max-h-[95vh] lg:h-[95vh] max-w-none flex flex-col p-4 sm:p-6 gap-0 overflow-hidden">
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle>Event Banner</DialogTitle>
            <DialogDescription>
              Upload a banner image and preview exactly how it will appear on each student's certificate card.
            </DialogDescription>
          </DialogHeader>

          {/* Body — stacks vertically on mobile/tablet, two columns on desktop */}
          <div className="flex flex-col lg:flex-row flex-1 gap-4 lg:gap-6 min-h-0 overflow-y-auto lg:overflow-hidden">

            {/* Left: upload + crop zone (crop zone grows to fill on desktop, fixed height on mobile) */}
            <div className="flex flex-col gap-3 w-full lg:flex-1 lg:min-h-0">

              {/* Image upload — compact strip */}
              <label
                className="shrink-0 flex items-center gap-3 border-2 border-dashed border-border rounded-lg px-4 py-3 cursor-pointer hover:border-foreground transition-colors text-muted-foreground"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith("image/")) handleBannerEditorFileChange(file);
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBannerEditorFileChange(file);
                    e.target.value = "";
                  }}
                />
                <Upload className="w-4 h-4 shrink-0" />
                <span className="text-xs">{bannerPreviewFile ? bannerPreviewFile.name : "Click or drag & drop an image"}</span>
              </label>

              {/* Crop zone — shows full image; draggable crop rectangle defines the banner area */}
              <div
                ref={cropContainerRef}
                className="h-48 sm:h-64 lg:flex-1 lg:min-h-0 relative overflow-hidden rounded border-2 border-border select-none bg-muted/20 flex items-center justify-center"
              >
                {bannerPreviewUrl ? (
                  <>
                    <img
                      ref={cropImageRef}
                      src={bannerPreviewUrl}
                      alt=""
                      draggable={false}
                      onLoad={updateImageBounds}
                      className="max-w-full max-h-full w-auto h-auto pointer-events-none block"
                    />
                    {imageBounds && (() => {
                      const { left: il, top: it, width: iw, height: ih } = imageBounds;
                      // Crop rect size = CARD_ASPECT box, 1/zoom of image coverage
                      const oc_w = Math.min(iw, ih * CARD_BANNER_ASPECT);
                      const oc_h = oc_w / CARD_BANNER_ASPECT;
                      const cw = oc_w / bannerCropZoom;
                      const ch = oc_h / bannerCropZoom;
                      // Center = cropX/Y as % of FULL IMAGE (free to go anywhere)
                      const cx = il + (bannerCropX / 100) * iw;
                      const cy = it + (bannerCropY / 100) * ih;
                      const rl = Math.max(il, cx - cw / 2);
                      const rt = Math.max(it, cy - ch / 2);
                      const rr = Math.min(il + iw, rl + cw);
                      const rb = Math.min(it + ih, rt + ch);
                      return (
                        <>
                          {/* Single-tier dark overlay outside the crop rect */}
                          <div className="absolute left-0 right-0 bg-black/55 pointer-events-none" style={{ top: 0, height: rt }} />
                          <div className="absolute left-0 right-0 bg-black/55 pointer-events-none" style={{ top: rb, bottom: 0 }} />
                          <div className="absolute bg-black/55 pointer-events-none" style={{ top: rt, height: rb - rt, left: 0, width: rl }} />
                          <div className="absolute bg-black/55 pointer-events-none" style={{ top: rt, height: rb - rt, left: rr, right: 0 }} />
                          {/* Draggable crop rectangle */}
                          <div
                            className="absolute border-2 border-white cursor-move"
                            style={{ top: rt, left: rl, width: rr - rl, height: rb - rt }}
                            onMouseDown={handleCropRectDragStart}
                            onTouchStart={handleCropRectTouchStart}
                          >
                            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white" />
                            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white" />
                            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white" />
                            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white" />
                          </div>
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">Upload an image to crop</div>
                )}
              </div>

              {/* Zoom slider */}
              <div className="shrink-0 flex items-center gap-3">
                <span className="text-xs text-muted-foreground shrink-0">Zoom</span>
                <Slider
                  min={100} max={300} step={5}
                  value={[Math.round(bannerCropZoom * 100)]}
                  onValueChange={([v]) => {
                    const z = v / 100;
                    setBannerCropZoom(z);
                    const minXY = 50 / z;
                    setBannerCropX(x => Math.max(minXY, Math.min(100 - minXY, x)));
                    setBannerCropY(y => Math.max(minXY, Math.min(100 - minXY, y)));
                  }}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground font-mono w-8 text-right">{Math.round(bannerCropZoom * 100)}%</span>
              </div>
              <p className="shrink-0 text-[10px] text-muted-foreground">Drag the crop box to reposition · slider to resize it</p>
            </div>

            {/* Right: appearance controls + live card preview */}
            <div className="flex flex-col gap-4 sm:gap-5 w-full lg:w-64 lg:shrink-0">

              {/* Overlay opacity */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Overlay opacity</p>
                  <span className="text-xs text-muted-foreground font-mono">{Math.round(bannerOverlayOpacity * 100)}%</span>
                </div>
                <Slider
                  min={0} max={100} step={1}
                  value={[Math.round(bannerOverlayOpacity * 100)]}
                  onValueChange={([v]) => setBannerOverlayOpacity(v / 100)}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground">0% = fully visible · 100% = hidden</p>
              </div>

              {/* Text colour */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Text &amp; icon colour</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    onClick={() => setBannerTextColor("default")}
                    className={`px-3 py-1.5 text-xs font-semibold border-2 rounded transition-all ${bannerTextColor === "default" ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:border-foreground/50"}`}
                  >Default</button>
                  {["#FFFFFF","#000000","#FFD700","#00E5FF","#FF6B6B","#CCFF00","#FF9800","#E040FB"].map((hex) => (
                    <button
                      key={hex}
                      title={hex}
                      onClick={() => setBannerTextColor(hex)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: hex,
                        borderColor: bannerTextColor === hex ? "#000" : "#ccc",
                        boxShadow: bannerTextColor === hex ? "0 0 0 2px #fff, 0 0 0 4px #000" : undefined,
                      }}
                    />
                  ))}
                  {/* Full spectrum picker */}
                  <label
                    title="Custom colour"
                    className="w-7 h-7 rounded-full border-2 cursor-pointer overflow-hidden shrink-0 transition-all"
                    style={{
                      background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
                      borderColor: (bannerTextColor.startsWith("#") && !["#FFFFFF","#000000","#FFD700","#00E5FF","#FF6B6B","#CCFF00","#FF9800","#E040FB"].includes(bannerTextColor)) ? "#000" : "#ccc",
                      boxShadow: (bannerTextColor.startsWith("#") && !["#FFFFFF","#000000","#FFD700","#00E5FF","#FF6B6B","#CCFF00","#FF9800","#E040FB"].includes(bannerTextColor)) ? "0 0 0 2px #fff, 0 0 0 4px #000" : undefined,
                    }}
                  >
                    <input
                      type="color"
                      className="opacity-0 w-full h-full cursor-pointer"
                      value={bannerTextColor.startsWith("#") ? bannerTextColor : "#ffffff"}
                      onChange={(e) => setBannerTextColor(e.target.value.toUpperCase())}
                    />
                  </label>
                </div>
                {bannerTextColor.startsWith("#") && (
                  <p className="text-[10px] text-muted-foreground font-mono">{bannerTextColor}</p>
                )}
              </div>

              {/* Live card preview */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Preview</p>
                {(() => {
                  const tc = bannerTextColor;
                  const isHex = tc.startsWith("#");
                  const colorStyle = isHex ? { color: tc } : {};
                  const borderColorStyle = isHex ? { borderColor: tc, color: tc } : {};
                  const mutedColorStyle = isHex ? { color: tc, opacity: 0.75 } : {};
                  const bgBadge = isHex
                    ? undefined
                    : tc === "white" ? "rgba(0,0,0,0.35)" : tc === "black" ? "rgba(255,255,255,0.45)" : undefined;
                  const borderClass = !isHex ? (tc === "white" ? "border-white" : tc === "black" ? "border-black" : "border-foreground") : "";
                  return (
                    <div className="border-2 border-foreground bg-background flex flex-col font-mono text-foreground w-full">
                      <div className="px-3 py-3 flex flex-col gap-2 border-b-2 border-foreground relative overflow-hidden" style={{ aspectRatio: "300 / 140", ...colorStyle }}>
                        {bannerPreviewUrl && (
                          <>
                            <img src={bannerPreviewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: `${bannerCropX}% ${bannerCropY}%`, transform: `scale(${bannerCropZoom})`, transformOrigin: `${bannerCropX}% ${bannerCropY}%` }} />
                            <div className="absolute inset-0" style={{ backgroundColor: `rgba(255,255,255,${bannerOverlayOpacity})` }} />
                          </>
                        )}
                        <div className="relative flex items-start justify-between gap-2">
                          <div className={`border p-1.5 shrink-0 ${borderClass}`} style={{ ...borderColorStyle, ...(bgBadge ? { backgroundColor: bgBadge } : {}) }}>
                            <Award className="h-3.5 w-3.5" />
                          </div>
                          <span className={`border-2 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${borderClass}`} style={{ ...borderColorStyle, ...(bgBadge ? { backgroundColor: bgBadge } : {}) }}>generated</span>
                        </div>
                        <div className="relative flex-1" />
                        <div className="relative flex items-end justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <CalendarDays className="h-3 w-3 shrink-0" />
                            <span className="font-bold uppercase tracking-widest">
                              {batch.createdAt ? new Date(batch.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className={`text-[9px] font-bold uppercase tracking-widest ${!isHex && tc !== "white" && tc !== "black" ? "text-muted-foreground" : ""}`} style={mutedColorStyle}>Issued For</p>
                            <p className="text-xs font-bold break-words leading-snug">{batch.name}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex">
                        <span className="flex-1 flex items-center justify-center gap-1 bg-foreground text-background border-r-2 border-foreground px-2 py-2 text-[9px] font-black uppercase tracking-widest">
                          <ExternalLink className="h-3 w-3 shrink-0" /> View
                        </span>
                        <span className="flex-1 flex items-center justify-center gap-1 bg-background px-2 py-2 text-[9px] font-black uppercase tracking-widest">
                          <ShieldCheck className="h-3 w-3 shrink-0" /> Verify
                        </span>
                      </div>
                    </div>
                  );
                })()}
                <p className="text-[10px] text-muted-foreground">Live preview of the student's public profile card.</p>
              </div>

            </div>
          </div>
          <div className="shrink-0 flex justify-end gap-2 pt-4 border-t border-border mt-2">
            <Button variant="outline" onClick={() => setBannerEditorOpen(false)}>Cancel</Button>
            <Button onClick={handleBannerEditorConfirm} disabled={bannerUploading}>
              {bannerUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {bannerUploading ? "Uploading…" : "Save Banner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue Report Detail */}
      <Dialog open={!!activeReport} onOpenChange={(open) => { if (!open) setActiveReport(null); }}>
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

    </div>
  );
}
