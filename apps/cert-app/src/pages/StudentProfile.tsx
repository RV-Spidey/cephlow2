import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { format } from "date-fns";
import { Award, CalendarDays, Check, ExternalLink, Loader2, Pencil, ShieldCheck, User, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { HudGridSvg, HudCommandSvg, CustomFrameRenderer, type CustomFrameConfig } from "@/components/CustomFrameRenderer";

interface ProfileCert {
  certId: string;
  batchId: string;
  batchName: string;
  recipientName: string;
  r2PdfUrl: string | null;
  pdfUrl: string | null;
  slideUrl: string | null;
  issuedAt: string | null;
  status: string;
  bannerUrl: string | null;
  bannerOverlayOpacity: number;
  bannerTextColor: string;
  bannerCropZoom: number;
  bannerCropX: number;
  bannerCropY: number;
  frameTier: string;
  customFrameConfig?: CustomFrameConfig | null;
}

interface ProfileData {
  slug: string;
  name: string;
  certificates: ProfileCert[];
}

function HudFrame({ tier }: { tier: string }) {
  if (tier === 'hud-grid-blue')    return <HudGridSvg    color="#00aaff" glow="rgba(0,170,255,0.6)"/>;
  if (tier === 'hud-grid-purple')  return <HudGridSvg    color="#aa55ff" glow="rgba(170,85,255,0.6)"/>;
  if (tier === 'hud-grid-gold')    return <HudGridSvg    color="#ffaa00" glow="rgba(255,170,0,0.6)"/>;
  if (tier === 'hud-command-blue') return <HudCommandSvg color="#00aaff" glow="rgba(0,170,255,0.5)"/>;
  if (tier === 'hud-command-gold') return <HudCommandSvg color="#ffaa00" glow="rgba(255,170,0,0.5)"/>;
  return null;
}

export default function StudentProfile() {
  const [, params] = useRoute("/:username");
  const username = params?.username ?? "";
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!username) return;
    const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
    fetch(`${apiBase}/api/p/${username}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setProfile(data);
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function handleSaveName() {
    if (!editName.trim() || !profile) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const idToken = sessionData.session?.access_token;
      const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const res = await fetch(`${apiBase}/api/p/${username}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save");
      } else {
        setProfile((p) => p ? { ...p, name: data.name } : p);
        setEditing(false);
      }
    } catch {
      setSaveError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setEditName(profile?.name ?? "");
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError(null);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
        <div className="border-2 border-foreground p-10 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-background">
        <div className="flex min-h-full items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-foreground text-background p-2.5 shrink-0">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-widest">Student Profile</h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Cephlow Certificate Authority</p>
              </div>
            </div>
            <div className="border-2 border-foreground">
              <div className="px-5 py-4 border-b-2 border-foreground flex items-start gap-3 bg-background text-foreground">
                <div className="shrink-0 mt-0.5">
                  <X className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black uppercase tracking-widest text-sm">Profile Not Found</p>
                  <p className="text-xs mt-0.5 normal-case tracking-normal font-normal text-muted-foreground">
                    No profile exists for @{username}
                  </p>
                </div>
              </div>
              <div className="p-4">
                <div className="border-2 border-foreground p-3 text-xs font-normal normal-case tracking-normal">
                  This profile could not be found. The link may be incorrect or the profile may not exist yet.
                </div>
              </div>
            </div>
            <p className="mt-5 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
              Powered by Cephlow Certificate Authority
            </p>
          </div>
        </div>
      </div>
    );
  }

  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-background font-mono">
      <div className="px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-foreground text-background p-2.5 shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-widest">Student Profile</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Cephlow Certificate Authority</p>
          </div>
        </div>

        {/* Profile identity block */}
        <div className="border-2 border-foreground mb-4">
          <div className="bg-foreground text-background px-5 py-4 flex items-center gap-4">
            <div className="shrink-0 border-2 border-background w-12 h-12 flex items-center justify-center text-lg font-black">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="bg-background text-foreground border-2 border-background px-2 py-1 text-sm font-bold uppercase tracking-widest outline-none w-full"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={saving || !editName.trim()}
                      className="shrink-0 border-2 border-background p-1.5 hover:bg-background hover:text-foreground transition-colors disabled:opacity-50"
                      title="Save"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="shrink-0 border-2 border-background p-1.5 hover:bg-background hover:text-foreground transition-colors"
                      title="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {saveError && <p className="text-[10px] opacity-70">{saveError}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-black uppercase tracking-widest text-sm truncate">{profile.name}</p>
                  {user && (
                    <button
                      onClick={startEdit}
                      className="shrink-0 p-1 hover:opacity-70 transition-opacity"
                      title="Edit name"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-[10px] uppercase tracking-widest opacity-60 mt-0.5">@{profile.slug}</p>
            </div>
          </div>
          <div className="px-5 py-3 flex items-center gap-2 border-t-2 border-foreground">
            <Award className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              {profile.certificates.length} {profile.certificates.length === 1 ? "Certificate" : "Certificates"} Issued
            </span>
          </div>
        </div>

        {/* Certificates */}
        {profile.certificates.length === 0 ? (
          <div className="border-2 border-foreground p-10 text-center">
            <Award className="mx-auto h-6 w-6 mb-3 opacity-30" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">No certificates yet</p>
          </div>
        ) : (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Certificates</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {profile.certificates.map((cert) => {
                const viewUrl = cert.r2PdfUrl || cert.pdfUrl || cert.slideUrl;
                const tier = cert.frameTier ?? 'none';
                const isHud = tier.startsWith('hud-');
                const isCustom = tier.startsWith('custom:');
                const frameWrapClass = tier !== 'none' && !isCustom
                  ? `cert-frame-wrapper frame-${tier}`
                  : undefined;

                const cardInner = (
                  <div className="border-2 border-foreground bg-background flex flex-col cert-card-inner" style={{ position: 'relative' }}>
                    {/* Cert body — banner is the background */}
                    {(() => {
                      const overlayOpacity = cert.bannerOverlayOpacity ?? 0.70;
                      const cropZoom = cert.bannerCropZoom ?? 1.0;
                      const cropX = cert.bannerCropX ?? 50;
                      const cropY = cert.bannerCropY ?? 50;
                      const tc = cert.bannerTextColor ?? "default";
                      const isHex = tc.startsWith("#");
                      const colorStyle = isHex ? { color: tc } : {};
                      const borderColorStyle = isHex ? { borderColor: tc, color: tc } : {};
                      const mutedColorStyle = isHex ? { color: tc, opacity: 0.75 } : {};
                      const bgBadge = isHex ? undefined : tc === "white" ? "rgba(0,0,0,0.35)" : tc === "black" ? "rgba(255,255,255,0.45)" : undefined;
                      const borderClass = !isHex ? (tc === "white" ? "border-white" : tc === "black" ? "border-black" : "border-foreground") : "";
                      const mutedClass = !isHex ? (tc === "white" ? "text-white/70" : tc === "black" ? "text-black/60" : "text-muted-foreground") : "";
                      return (
                        <div className="px-3 py-3 flex flex-col gap-2 flex-1 border-b-2 border-foreground relative overflow-hidden" style={{ minHeight: 140, ...colorStyle }}>
                          {cert.bannerUrl && (
                            <>
                              <img src={cert.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: `${cropX}% ${cropY}%`, transform: `scale(${cropZoom})`, transformOrigin: `${cropX}% ${cropY}%` }} />
                              <div className="absolute inset-0" style={{ backgroundColor: `rgba(255,255,255,${overlayOpacity})` }} />
                            </>
                          )}
                          <div className="relative flex items-start justify-between gap-2">
                            <div className={`border p-1.5 shrink-0 ${borderClass}`} style={{ ...borderColorStyle, ...(bgBadge ? { backgroundColor: bgBadge } : {}) }}>
                              <Award className="h-3.5 w-3.5" />
                            </div>
                            <span className={`border-2 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${borderClass}`} style={{ ...borderColorStyle, ...(bgBadge ? { backgroundColor: bgBadge } : {}) }}>
                              {cert.status}
                            </span>
                          </div>
                          <div className="relative flex-1" />
                          <div className="relative flex items-end justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <CalendarDays className="h-3 w-3 shrink-0" />
                              <span className="font-bold uppercase tracking-widest">
                                {cert.issuedAt ? format(new Date(cert.issuedAt), "MMM d, yyyy") : "—"}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className={`text-[9px] font-bold uppercase tracking-widest ${mutedClass}`} style={mutedColorStyle}>Issued For</p>
                              <p className="text-xs font-bold break-words leading-snug">{cert.batchName}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Actions */}
                    <div className="flex">
                      {viewUrl && (
                        <a
                          href={viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 bg-foreground text-background border-r-2 border-foreground px-2 py-2 text-[9px] font-black uppercase tracking-widest hover:opacity-75 transition-opacity"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          View
                        </a>
                      )}
                      <a
                        href={`/verify/${cert.batchId}/${cert.certId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1 bg-background px-2 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors"
                      >
                        <ShieldCheck className="h-3 w-3 shrink-0" />
                        Verify
                      </a>
                    </div>
                  </div>
                );

                if (isCustom && cert.customFrameConfig) {
                  return (
                    <CustomFrameRenderer key={cert.certId} frameId={tier.slice(7)} config={cert.customFrameConfig}>
                      {cardInner}
                    </CustomFrameRenderer>
                  );
                }
                if (frameWrapClass) {
                  return (
                    <div key={cert.certId} className={frameWrapClass}>
                      {isHud && <HudFrame tier={tier} />}
                      {cardInner}
                    </div>
                  );
                }
                return <div key={cert.certId}>{cardInner}</div>;
              })}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          Powered by Cephlow Certificate Authority
        </p>
      </div>
    </div>
  );
}
