import { useState, useEffect } from "react";
import { Loader2, Search, ShoppingBag, LayoutTemplate, Coins, Star, Package, Paintbrush, Heart, Pencil, Trash2, Check, X, Copy } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CustomFrameRenderer, type CustomFrameConfig } from "@/components/CustomFrameRenderer";
import { PublishFrameDialog } from "@/pages/batches/components/PublishFrameDialog";
import { CustomFrameDesigner } from "@/pages/batches/components/CustomFrameDesigner";
import { useWorkspace } from "@/hooks/use-workspace";
// ─── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  name: string;
  description: string;
  price: number;
  purchaseCount: number;
  likeCount: number;
  totalEarned?: number;
  isActive?: boolean;
  frameConfig: CustomFrameConfig | null;
  alreadyPurchased?: boolean;
  likedByMe?: boolean;
  creatorName?: string;
  createdAt: string;
}

interface OwnedFrame {
  listingId: string;
  name: string;
  config: CustomFrameConfig | null;
}

interface WorkspaceFrame {
  id: string;
  name: string;
  config: CustomFrameConfig;
}

// ─── Preview card ─────────────────────────────────────────────────────────────

function PreviewCard() {
  return (
    <div className="border-2 border-foreground bg-background flex flex-col font-mono text-foreground cert-card-inner" style={{ position: "relative" }}>
      <div className="px-3 py-3 flex flex-col gap-2 border-b-2 border-foreground relative" style={{ aspectRatio: "300/140" }}>
        <div className="relative flex items-start justify-between gap-2">
          <div className="border p-1.5 shrink-0 border-foreground">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <span className="border-2 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest border-foreground">cert</span>
        </div>
        <div className="relative flex-1" />
        <div className="relative flex items-end justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest">Frame</span>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Issued For</p>
            <p className="text-xs font-bold">Your Batch</p>
          </div>
        </div>
      </div>
      <div className="flex">
        <span className="flex-1 flex items-center justify-center bg-foreground text-background px-2 py-1.5 text-[9px] font-black uppercase tracking-widest border-r-2 border-foreground">View</span>
        <span className="flex-1 flex items-center justify-center px-2 py-1.5 text-[9px] font-black uppercase tracking-widest">Verify</span>
      </div>
    </div>
  );
}


// ─── Tab: Browse ──────────────────────────────────────────────────────────────

function BrowseTab() {
  const { toast } = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "free" | "paid">("all");
  const [walletBalance, setWalletBalance] = useState(0);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = (p = 1) => {
    setLoading(true);
    Promise.all([
      customFetch<{ listings: Listing[]; total: number }>(`/api/marketplace/listings?page=${p}&limit=24`),
      customFetch<{ currentBalance: number }>("/api/wallet").catch(() => ({ currentBalance: 0 })),
    ])
      .then(([d, w]) => {
        setListings(d.listings ?? []);
        setTotal(d.total ?? 0);
        setWalletBalance((w as any).currentBalance ?? 0);
        setPage(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, []);

  const filtered = listings.filter(l => {
    if (filter === "free" && l.price !== 0) return false;
    if (filter === "paid" && l.price === 0) return false;
    if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleLike = async (listing: Listing) => {
    setLikingId(listing.id);
    try {
      const result = await customFetch<{ liked: boolean; likeCount: number }>(
        `/api/marketplace/listings/${listing.id}/like`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setListings(prev => prev.map(l =>
        l.id === listing.id ? { ...l, likedByMe: result.liked, likeCount: result.likeCount } : l
      ));
    } catch {
      // silent — like is non-critical
    } finally {
      setLikingId(null);
    }
  };

  const handlePurchase = async (listing: Listing) => {
    if (!listing.frameConfig) return;
    if (listing.alreadyPurchased) {
      toast({ title: `"${listing.name}" is already in your workspace` });
      return;
    }
    if (listing.price > walletBalance) {
      toast({ title: "Insufficient balance", description: `Needs ₹${listing.price}, you have ₹${walletBalance}`, variant: "destructive" });
      return;
    }
    setPurchasingId(listing.id);
    try {
      await customFetch(`/api/marketplace/listings/${listing.id}/purchase`, { method: "POST", body: JSON.stringify({}) });
      setListings(prev => prev.map(l => l.id === listing.id ? { ...l, alreadyPurchased: true } : l));
      setWalletBalance(prev => prev - listing.price);
      toast({ title: `"${listing.name}" added to your workspace` });
    } catch (err: any) {
      toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48 flex items-center gap-2 border-2 border-border px-3 py-1.5 focus-within:border-foreground transition-colors">
          <Search className="w-3 h-3 text-muted-foreground shrink-0" />
          <input className="flex-1 bg-transparent text-sm outline-none font-mono" placeholder="Search frames..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex border-2 border-border">
          {(["all", "free", "paid"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors
                ${filter === f ? "bg-foreground text-background" : "hover:bg-muted"}`}>
              {f}
            </button>
          ))}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Balance: ₹{walletBalance}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border-2 border-border">
          <ShoppingBag className="w-8 h-8 text-muted-foreground opacity-30" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">No frames found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(listing => (
            <div key={listing.id} className="border-2 border-border p-2 flex flex-col gap-2 hover:border-foreground/40 transition-colors">
              <div className="flex justify-center py-1">
                <div className="w-full max-w-[200px]">
                  {listing.frameConfig
                    ? <CustomFrameRenderer frameId={listing.id} config={listing.frameConfig}><PreviewCard /></CustomFrameRenderer>
                    : <PreviewCard />}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest truncate">{listing.name}</p>
                {listing.creatorName && (
                  <p className="text-[9px] text-muted-foreground truncate mt-0.5">by {listing.creatorName}</p>
                )}
                {listing.description && <p className="text-[9px] text-muted-foreground truncate mt-0.5">{listing.description}</p>}
                <p className="text-[9px] text-muted-foreground mt-0.5">Used in {listing.purchaseCount} event{listing.purchaseCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[9px] font-black px-1.5 py-0.5 border ${listing.price === 0 ? "border-green-600 text-green-600" : "border-foreground"}`}>
                  {listing.price === 0 ? "FREE" : `₹${listing.price}`}
                </span>
                <div className="flex items-center gap-1">
                  {listing.alreadyPurchased && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-foreground text-background">OWNED</span>
                  )}
                  <button
                    onClick={() => handleLike(listing)}
                    disabled={likingId === listing.id}
                    className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50 px-1 py-0.5"
                  >
                    <Heart className={`w-4 h-4 ${listing.likedByMe ? "fill-red-500 text-red-500" : ""}`} />
                    <span>{listing.likeCount ?? 0}</span>
                  </button>
                </div>
              </div>
              <button
                onClick={() => handlePurchase(listing)}
                disabled={purchasingId === listing.id || listing.alreadyPurchased}
                className={`w-full py-1.5 text-[9px] font-black uppercase tracking-widest border-2 transition-colors flex items-center justify-center gap-1
                  ${listing.alreadyPurchased
                    ? "border-foreground/30 text-foreground/30 cursor-default"
                    : "border-border hover:border-foreground hover:bg-foreground hover:text-background"}`}
              >
                {purchasingId === listing.id
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : listing.alreadyPurchased ? "Already Owned"
                  : listing.price === 0 ? "Get Free" : `Get ₹${listing.price}`}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 24 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => load(page - 1)}>Prev</Button>
          <span className="text-xs font-mono text-muted-foreground">{page} / {Math.ceil(total / 24)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 24)} onClick={() => load(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ─── Tab: My Listings ─────────────────────────────────────────────────────────

function MyListingsTab() {
  const { toast } = useToast();
  const { activeWorkspace } = useWorkspace();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceFrames, setWorkspaceFrames] = useState<WorkspaceFrame[]>([]);
  const [publishTarget, setPublishTarget] = useState<WorkspaceFrame | null>(null);

  // Creator name state
  const [creatorName, setCreatorName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [editingName, setEditingName] = useState(false);

  // Per-listing inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingPrice, setEditingPrice] = useState("");
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      customFetch<{ listings: Listing[] }>("/api/marketplace/my-listings"),
      customFetch<{ frames: WorkspaceFrame[] }>("/api/frame-templates"),
      customFetch<{ creatorName: string }>("/api/creator/credits"),
    ])
      .then(([d, t, c]) => {
        setListings(d.listings ?? []);
        setWorkspaceFrames(t.frames ?? []);
        setCreatorName((c as any).creatorName ?? "");
        setNameInput((c as any).creatorName ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const totalLikes = listings.reduce((sum, l) => sum + (l.likeCount ?? 0), 0);

  const handleSaveName = async () => {
    if (!nameInput.trim() || nameInput.trim() === creatorName) { setEditingName(false); return; }
    setSavingName(true);
    try {
      const result = await customFetch<{ creatorName: string }>("/api/creator/name", {
        method: "PATCH",
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      setCreatorName(result.creatorName);
      setNameInput(result.creatorName);
      setEditingName(false);
      toast({ title: "Creator name saved" });
    } catch (err: any) {
      toast({ title: "Failed to save name", description: err.message, variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  const handleToggleActive = async (listing: Listing) => {
    try {
      await customFetch(`/api/marketplace/listings/${listing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !listing.isActive }),
      });
      setListings(prev => prev.map(l => l.id === listing.id ? { ...l, isActive: !l.isActive } : l));
      toast({ title: listing.isActive ? "Listing unpublished" : "Listing re-published" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const startEdit = (listing: Listing) => {
    setEditingId(listing.id);
    setEditingValue(listing.name);
    setEditingPrice(String(listing.price));
  };

  const cancelEdit = () => { setEditingId(null); setEditingValue(""); setEditingPrice(""); };

  const handleSaveEdit = async (listing: Listing) => {
    const newName = editingValue.trim();
    const newPrice = parseInt(editingPrice, 10);
    const nameChanged = newName && newName !== listing.name;
    const priceChanged = !isNaN(newPrice) && newPrice >= 0 && newPrice !== listing.price;
    if (!nameChanged && !priceChanged) { cancelEdit(); return; }
    setSavingEditId(listing.id);
    try {
      const patch: Record<string, unknown> = {};
      if (nameChanged) patch.name = newName;
      if (priceChanged) patch.price = newPrice;
      await customFetch(`/api/marketplace/listings/${listing.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setListings(prev => prev.map(l => l.id === listing.id
        ? { ...l, ...(nameChanged ? { name: newName } : {}), ...(priceChanged ? { price: newPrice } : {}) }
        : l));
      setEditingId(null);
      toast({ title: "Listing updated" });
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    } finally {
      setSavingEditId(null);
    }
  };

  const handleDelete = async (listing: Listing) => {
    setDeletingId(listing.id);
    try {
      await customFetch(`/api/marketplace/listings/${listing.id}`, { method: "DELETE" });
      setListings(prev => prev.filter(l => l.id !== listing.id));
      toast({ title: `"${listing.name}" deleted` });
    } catch (err: any) {
      toast({
        title: "Cannot delete",
        description: listing.purchaseCount > 0
          ? "This listing has been purchased. Unpublish it instead."
          : err.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Header bar: creator name + stats + publish */}
      <div className="border-2 border-border p-3 flex flex-wrap items-center gap-4">
        {/* Creator name */}
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Creator</span>
          {editingName ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                autoFocus
                className="flex-1 border border-border bg-background px-2 py-0.5 text-xs font-mono outline-none focus:border-foreground transition-colors"
                maxLength={40}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") { setEditingName(false); setNameInput(creatorName); } }}
              />
              <button onClick={handleSaveName} disabled={savingName} className="text-green-600 hover:text-green-700 disabled:opacity-50">
                {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => { setEditingName(false); setNameInput(creatorName); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex items-center gap-1.5 text-left hover:opacity-70 transition-opacity"
            >
              <span className="text-xs font-black uppercase tracking-widest">
                {creatorName || <span className="text-muted-foreground font-normal normal-case tracking-normal italic">Set creator name…</span>}
              </span>
              <Pencil className="w-3 h-3 text-muted-foreground shrink-0" />
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span>{listings.length} listing{listings.length !== 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{totalLikes} total</span>
        </div>

        {/* Publish */}
        {workspaceFrames.length > 0 && (
          <div className="relative group shrink-0">
            <Button size="sm">Publish a Frame</Button>
            <div className="hidden group-focus-within:block absolute right-0 top-full mt-1 z-10 border-2 border-foreground bg-background min-w-48 shadow-lg">
              {workspaceFrames.map(f => (
                <button key={f.id} onClick={() => setPublishTarget(f)}
                  className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-muted transition-colors border-b border-border last:border-0">
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border-2 border-border">
          <Star className="w-8 h-8 text-muted-foreground opacity-30" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">No listings yet</p>
          <p className="text-[10px] text-muted-foreground">Design a frame and publish it to the marketplace.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {listings.map(listing => (
            <div key={listing.id} className="border-2 border-border flex gap-3 p-3 items-center">
              {/* Thumbnail */}
              <div className="shrink-0 overflow-hidden relative" style={{ width: 80, height: 50 }}>
                <div style={{ width: 200, transform: "scale(0.4)", transformOrigin: "top left", pointerEvents: "none" }}>
                  {listing.frameConfig
                    ? <CustomFrameRenderer frameId={listing.id} config={listing.frameConfig}><PreviewCard /></CustomFrameRenderer>
                    : <PreviewCard />}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {editingId === listing.id ? (
                  <div className="flex items-center gap-1 mb-1 flex-wrap">
                    <input
                      autoFocus
                      className="flex-1 min-w-24 border border-border bg-background px-2 py-0.5 text-xs font-mono outline-none focus:border-foreground transition-colors uppercase"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(listing); if (e.key === "Escape") cancelEdit(); }}
                      placeholder="Name"
                    />
                    <div className="flex items-center border border-border bg-background focus-within:border-foreground transition-colors" title="0 = free, or ₹20–₹100">
                      <span className="pl-2 text-xs font-mono text-muted-foreground">₹</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-16 bg-transparent px-1.5 py-0.5 text-xs font-mono outline-none"
                        value={editingPrice}
                        onChange={e => setEditingPrice(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(listing); if (e.key === "Escape") cancelEdit(); }}
                        placeholder="0"
                      />
                    </div>
                    <button onClick={() => handleSaveEdit(listing)} disabled={savingEditId === listing.id} className="text-green-600 hover:text-green-700 disabled:opacity-50">
                      {savingEditId === listing.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-black text-sm uppercase tracking-widest truncate">{listing.name}</p>
                    <button onClick={() => startEdit(listing)} className="text-muted-foreground hover:text-foreground shrink-0 transition-colors" title="Edit name">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 border shrink-0 ${listing.isActive ? "border-green-600 text-green-600" : "border-muted-foreground text-muted-foreground"}`}>
                      {listing.isActive ? "LIVE" : "UNLISTED"}
                    </span>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
                  <span>{listing.price === 0 ? "Free" : `₹${listing.price}`}</span>
                  <span>·</span>
                  <span>{listing.purchaseCount} purchase{listing.purchaseCount !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>₹{listing.totalEarned ?? 0} earned</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{listing.likeCount ?? 0}</span>
                </p>
              </div>

              {/* Actions */}
              <div className="shrink-0 flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => handleToggleActive(listing)}>
                  {listing.isActive ? "Unpublish" : "Republish"}
                </Button>
                <button
                  onClick={() => handleDelete(listing)}
                  disabled={deletingId === listing.id}
                  className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                  title={listing.purchaseCount > 0 ? "Has purchases — unpublish instead" : "Delete listing"}
                >
                  {deletingId === listing.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {publishTarget && (
        <PublishFrameDialog
          open={!!publishTarget}
          onOpenChange={o => { if (!o) setPublishTarget(null); }}
          frameId={publishTarget.id}
          frameName={publishTarget.name}
          frameConfig={publishTarget.config}
          onPublished={() => { setPublishTarget(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Tab: Design Frame ────────────────────────────────────────────────────────

function DesignTab() {
  const [savedCount, setSavedCount] = useState(0);
  return (
    <div>
      {savedCount > 0 && (
        <div className="mb-4 border border-green-600 bg-green-600/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-600">
          {savedCount} frame{savedCount !== 1 ? "s" : ""} saved to workspace library — go to My Listings to publish.
        </div>
      )}
      <CustomFrameDesigner
        standalone
        open={true}
        onOpenChange={() => {}}
        onSaved={(_tier, _name, _config) => setSavedCount(c => c + 1)}
      />
    </div>
  );
}

// ─── Tab: Credits ─────────────────────────────────────────────────────────────

interface RedemptionRequest {
  id: string;
  amount: number;
  brand: string;
  status: "pending" | "fulfilled" | "rejected";
  voucherCode: string | null;
  adminNote: string | null;
  createdAt: string;
}

function CreditsTab() {
  const { toast } = useToast();
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatorName, setCreatorName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Redemption state
  const [redeemAmount, setRedeemAmount] = useState("");
  const [redeemBrand, setRedeemBrand] = useState<"amazon" | "flipkart">("amazon");
  const [redeeming, setRedeeming] = useState(false);
  const [redemptions, setRedemptions] = useState<RedemptionRequest[]>([]);
  const [yearlyUsed, setYearlyUsed] = useState(0);

  const loadRedemptions = () =>
    customFetch<{ requests: RedemptionRequest[]; yearlyUsed: number }>("/api/creator/credits/redemptions")
      .then((d: { requests: RedemptionRequest[]; yearlyUsed: number }) => {
        setRedemptions(d.requests ?? []);
        setYearlyUsed(d.yearlyUsed ?? 0);
      })
      .catch(() => {});

  useEffect(() => {
    Promise.all([
      customFetch<{ creatorCredits: number; creatorName: string }>("/api/creator/credits")
        .then((d: { creatorCredits: number; creatorName: string }) => {
          setCredits(d.creatorCredits ?? 0);
          setCreatorName(d.creatorName ?? "");
          setNameInput(d.creatorName ?? "");
        })
        .catch(() => setCredits(0)),
      loadRedemptions(),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setSavingName(true);
    try {
      const result = await customFetch<{ creatorName: string }>("/api/creator/name", {
        method: "PATCH",
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      setCreatorName(result.creatorName);
      setNameInput(result.creatorName);
      toast({ title: "Creator name saved" });
    } catch (err: any) {
      toast({ title: "Failed to save name", description: err.message, variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  const handleRedeem = async () => {
    const amt = parseInt(redeemAmount);
    if (!amt || amt < 100) {
      toast({ title: "Amount must be at least ₹100", variant: "destructive" });
      return;
    }
    if (yearlyUsed + amt > 20000) {
      toast({
        title: "Annual cap reached",
        description: `You can redeem up to ₹${20000 - yearlyUsed} more this year.`,
        variant: "destructive",
      });
      return;
    }
    setRedeeming(true);
    try {
      const result = await customFetch<{ newCreatorCredits: number }>(
        "/api/creator/credits/redeem",
        { method: "POST", body: JSON.stringify({ amount: amt, brand: redeemBrand }) }
      );
      setCredits(result.newCreatorCredits);
      setRedeemAmount("");
      toast({ title: `Voucher requested! Your ${redeemBrand === "amazon" ? "Amazon" : "Flipkart"} gift card will be sent to your email within 2-3 business days.` });
      await loadRedemptions();
    } catch (err: any) {
      toast({ title: "Redemption failed", description: err.message, variant: "destructive" });
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const yearlyRemaining = 20000 - yearlyUsed;
  const redeemAmt = parseInt(redeemAmount) || 0;

  return (
    <div className="max-w-md space-y-6">
      {/* Balance display — first thing visible */}
      <div className="border-2 border-foreground p-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Your Creator Credits</p>
        <p className="text-4xl font-black font-mono">₹{credits ?? 0}</p>
        <p className="text-[10px] text-muted-foreground mt-2">Earned from marketplace frame sales</p>
        {yearlyUsed > 0 && (
          <p className="text-[9px] text-muted-foreground mt-1">₹{yearlyUsed} redeemed this year · ₹{yearlyRemaining} remaining</p>
        )}
      </div>

      {/* Redeem for gift voucher — primary action, right below balance */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest">Redeem for Gift Voucher</p>
          <p className="text-[10px] text-muted-foreground mt-1">Min ₹100 · Delivered to your email within 2-3 business days · ₹20,000/year cap</p>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest">Brand</p>
          <div className="flex border-2 border-border w-fit">
            {(["amazon", "flipkart"] as const).map(b => (
              <button key={b} onClick={() => setRedeemBrand(b)}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors
                  ${redeemBrand === b ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                {b === "amazon" ? "Amazon" : "Flipkart"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest">Amount (₹)</p>
          <input
            type="number" min="100" step="1"
            className="w-full border-2 border-border bg-background px-3 py-1.5 text-sm font-mono outline-none focus:border-foreground transition-colors"
            value={redeemAmount} onChange={e => setRedeemAmount(e.target.value)} placeholder="e.g. 200"
          />
        </div>

        {redeemAmt >= 100 && credits !== null && (
          <div className="border border-border p-3 text-[10px] font-mono space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Credits after redemption</span><span>₹{Math.max(0, credits - redeemAmt)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Yearly used after this</span><span className={yearlyUsed + redeemAmt > 20000 ? "text-red-500" : ""}>₹{yearlyUsed + redeemAmt} / ₹20,000</span></div>
          </div>
        )}

        <Button
          onClick={handleRedeem}
          disabled={redeeming || !redeemAmount || redeemAmt < 100 || (credits ?? 0) < redeemAmt || yearlyUsed + redeemAmt > 20000}
          className="w-full"
        >
          {redeeming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {redeeming ? "Submitting…" : `Request ${redeemBrand === "amazon" ? "Amazon" : "Flipkart"} Voucher`}
        </Button>

        <p className="text-[9px] text-muted-foreground leading-relaxed border border-border p-2">
          Gift vouchers are a goodwill reward from Cephlow. Recipients are responsible for any applicable taxes on received benefits. Redemptions are subject to a ₹20,000/year cap per user.
        </p>
      </div>

      {/* Divider */}
      <div className="border-t-2 border-border" />

      {/* Creator name — settings, least urgent */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest">Creator Name</p>
        <p className="text-[10px] text-muted-foreground">Shown on your listings in the marketplace.</p>
        <div className="flex gap-2">
          <input
            className="flex-1 border-2 border-border bg-background px-3 py-1.5 text-sm font-mono outline-none focus:border-foreground transition-colors"
            placeholder="e.g. Adithyan"
            maxLength={40}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSaveName()}
          />
          <Button onClick={handleSaveName} disabled={savingName || !nameInput.trim() || nameInput.trim() === creatorName} size="sm" variant="outline">
            {savingName ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>

      {/* Redemption history */}
      {redemptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest">Redemption History</p>
          <div className="space-y-2">
            {redemptions.map(r => (
              <div key={r.id} className="border-2 border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-black text-sm">₹{r.amount}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest">{r.brand} · {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 border shrink-0 ${
                    r.status === "fulfilled" ? "border-green-600 text-green-600"
                    : r.status === "rejected" ? "border-red-500 text-red-500"
                    : "border-foreground text-foreground"
                  }`}>
                    {r.status.toUpperCase()}
                  </span>
                </div>
                {r.status === "fulfilled" && r.voucherCode && (
                  <div className="flex items-center gap-2 border border-border bg-muted px-2 py-1">
                    <span className="flex-1 text-xs font-mono tracking-widest truncate">{r.voucherCode}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(r.voucherCode!); toast({ title: "Code copied!" }); }}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {r.adminNote && r.status === "rejected" && (
                  <p className="text-[9px] text-muted-foreground">{r.adminNote}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Owned ───────────────────────────────────────────────────────────────

function OwnedTab() {
  const [frames, setFrames] = useState<OwnedFrame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch<{ purchases: OwnedFrame[] }>("/api/marketplace/my-workspace-frames")
      .then((d: { purchases: OwnedFrame[] }) => setFrames(d.purchases ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  if (frames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 border-2 border-border">
        <Package className="w-8 h-8 text-muted-foreground opacity-30" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">No owned frames yet</p>
        <p className="text-[10px] text-muted-foreground">Browse the marketplace and get frames to use in your batches.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {frames.map(f => (
        <div key={f.listingId} className="border-2 border-border p-2 flex flex-col gap-2">
          <div className="flex justify-center py-1">
            <div className="w-full max-w-[200px]">
              {f.config
                ? <CustomFrameRenderer frameId={f.listingId} config={f.config}><PreviewCard /></CustomFrameRenderer>
                : <PreviewCard />}
            </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest truncate">{f.name}</p>
          <span className="text-[9px] font-black px-1.5 py-0.5 bg-foreground text-background self-start">OWNED</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "browse" | "listings" | "design" | "credits" | "owned";

const TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
  { id: "browse",   label: "Browse",        icon: ShoppingBag },
  { id: "listings", label: "My Listings",   icon: Star },
  { id: "design",   label: "Design Frame",  icon: Paintbrush },
  { id: "credits",  label: "Credits",       icon: Coins },
  { id: "owned",    label: "Owned",         icon: Package },
];

export default function FrameInventory() {
  const [tab, setTab] = useState<Tab>("browse");

  return (
    <div className="min-h-screen bg-background font-mono">
      <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-foreground text-background p-2.5 shrink-0">
            <LayoutTemplate className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-widest">Frame Inventory</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Browse, publish, and manage certificate frames</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-2 border-foreground mb-6 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors
                  ${tab === t.id ? "bg-foreground text-background" : "hover:bg-muted"}`}
              >
                <Icon className="w-3 h-3" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === "browse"   && <BrowseTab />}
        {tab === "listings" && <MyListingsTab />}
        {tab === "design"   && <DesignTab />}
        {tab === "credits"  && <CreditsTab />}
        {tab === "owned"    && <OwnedTab />}
      </div>
    </div>
  );
}
