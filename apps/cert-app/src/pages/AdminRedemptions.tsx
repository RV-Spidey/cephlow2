import { useState, useEffect, useCallback } from "react";
import { Loader2, Check, X, ChevronLeft, ChevronRight, RefreshCw, Gift, ShieldOff } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RedemptionRequest {
  id: string;
  user_id: string;
  amount: number;
  brand: "amazon" | "flipkart";
  status: "pending" | "fulfilled" | "rejected";
  voucher_code: string | null;
  admin_note: string | null;
  user_email: string;
  creator_name: string | null;
  created_at: string;
  updated_at: string;
}

type StatusFilter = "pending" | "fulfilled" | "rejected" | "all";

const STATUS_COLORS: Record<string, string> = {
  pending: "border-yellow-500 text-yellow-500",
  fulfilled: "border-green-600 text-green-600",
  rejected: "border-red-500 text-red-500",
};

const BRAND_LABELS: Record<string, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
};

// ─── Fulfill inline form ──────────────────────────────────────────────────────

function FulfillForm({ request, onDone, onCancel }: {
  request: RedemptionRequest;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setSaving(true);
    try {
      await customFetch(`/api/admin/redemptions/${request.id}/fulfill`, {
        method: "PATCH",
        body: JSON.stringify({ voucherCode: code.trim() }),
      });
      toast({ title: `Fulfilled — voucher sent to ${request.user_email}` });
      onDone();
    } catch (err: any) {
      toast({ title: "Fulfill failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-2 border border-green-600/40 bg-green-600/5 p-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-green-600">
        Enter {BRAND_LABELS[request.brand]} voucher code
      </p>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          className="flex-1 border border-border bg-background px-2 py-1 text-xs font-mono outline-none focus:border-foreground transition-colors tracking-widest uppercase"
          placeholder="e.g. ABCD-EFGH-1234"
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
        />
        <button onClick={submit} disabled={saving || !code.trim()} className="text-green-600 hover:text-green-700 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Reject inline form ───────────────────────────────────────────────────────

function RejectForm({ request, onDone, onCancel }: {
  request: RedemptionRequest;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await customFetch(`/api/admin/redemptions/${request.id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ adminNote: note.trim() || undefined }),
      });
      toast({ title: "Request rejected — credits refunded to user" });
      onDone();
    } catch (err: any) {
      toast({ title: "Reject failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-2 border border-red-500/40 bg-red-500/5 p-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-red-500">
        Reject reason (optional — sent to user)
      </p>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          className="flex-1 border border-border bg-background px-2 py-1 text-xs font-mono outline-none focus:border-foreground transition-colors"
          placeholder="e.g. Could not process at this time"
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
        />
        <button onClick={submit} disabled={saving} className="text-red-500 hover:text-red-600 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

function AdminPanel() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<RedemptionRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [page, setPage] = useState(1);
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const limit = 20;

  const load = useCallback((p = 1, status = statusFilter) => {
    setLoading(true);
    customFetch<{ requests: RedemptionRequest[]; total: number }>(
      `/api/admin/redemptions?status=${status}&page=${p}&limit=${limit}`
    )
      .then(d => { setRequests(d.requests ?? []); setTotal(d.total ?? 0); setPage(p); })
      .catch((err: any) => {
        if (err?.status === 403 || /forbidden|403/i.test(err?.message ?? "")) {
          setUnauthorized(true);
        } else {
          toast({ title: "Failed to load", description: err.message, variant: "destructive" });
        }
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(1, statusFilter); }, [statusFilter]);

  const totalPages = Math.ceil(total / limit);

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-background font-mono flex items-center justify-center">
        <div className="border-2 border-foreground p-8 flex flex-col items-center gap-4 text-center max-w-sm">
          <ShieldOff className="w-8 h-8" />
          <div>
            <p className="text-sm font-black uppercase tracking-widest">Access Denied</p>
            <p className="text-[10px] text-muted-foreground mt-1">You must be signed in as the admin account to view this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-mono">
      <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="bg-foreground text-background p-2.5 shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-widest">Gift Voucher Requests</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Admin — Redemption Management</p>
            </div>
          </div>
          <button onClick={() => load(page)} className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex border-2 border-foreground w-fit overflow-hidden">
          {(["pending", "fulfilled", "rejected", "all"] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap
                ${statusFilter === s ? "bg-foreground text-background" : "hover:bg-muted"}`}>
              {s}
            </button>
          ))}
        </div>

        {statusFilter === "pending" && !loading && (
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-500">
            {total} pending request{total !== 1 ? "s" : ""} awaiting action
          </p>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 border-2 border-border">
            <Gift className="w-8 h-8 text-muted-foreground opacity-30" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              No {statusFilter === "all" ? "" : statusFilter} requests
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map(r => (
              <div key={r.id} className="border-2 border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black">₹{r.amount}</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 border ${STATUS_COLORS[r.status] ?? "border-foreground text-foreground"}`}>
                        {r.status.toUpperCase()}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground border border-border px-1.5 py-0.5">
                        {BRAND_LABELS[r.brand]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.creator_name && <span className="font-bold text-foreground">{r.creator_name} · </span>}
                      {r.user_email}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("en-IN", {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {r.status === "pending" && fulfillingId !== r.id && rejectingId !== r.id && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" className="text-[10px] h-7 bg-green-600 hover:bg-green-700 text-white border-0"
                        onClick={() => { setFulfillingId(r.id); setRejectingId(null); }}>
                        Fulfill
                      </Button>
                      <Button size="sm" variant="outline" className="text-[10px] h-7 text-red-500 border-red-500/40 hover:bg-red-500/10"
                        onClick={() => { setRejectingId(r.id); setFulfillingId(null); }}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                {r.status === "fulfilled" && r.voucher_code && (
                  <div className="flex items-center gap-2 border border-green-600/30 bg-green-600/5 px-3 py-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">Code:</span>
                    <span className="text-xs font-mono font-bold tracking-widest">{r.voucher_code}</span>
                  </div>
                )}

                {r.status === "rejected" && r.admin_note && (
                  <p className="text-[10px] text-muted-foreground border border-red-500/20 px-3 py-1.5">
                    Note: {r.admin_note}
                  </p>
                )}

                {fulfillingId === r.id && (
                  <FulfillForm request={r}
                    onDone={() => { setFulfillingId(null); load(page); }}
                    onCancel={() => setFulfillingId(null)} />
                )}

                {rejectingId === r.id && (
                  <RejectForm request={r}
                    onDone={() => { setRejectingId(null); load(page); }}
                    onCancel={() => setRejectingId(null)} />
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button disabled={page === 1} onClick={() => load(page - 1)}
              className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-muted-foreground">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => load(page + 1)}
              className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminRedemptions() {
  return <AdminPanel />;
}
