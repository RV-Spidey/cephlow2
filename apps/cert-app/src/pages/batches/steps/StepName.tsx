import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";

interface Props {
  name: string;
  onNameChange: (v: string) => void;
  bannerFile: File | null;
  bannerPreviewUrl: string;
  onBannerFileChange: (file: File) => void;
  onBannerClear: () => void;
}

export function StepName({ name, onNameChange, bannerFile, bannerPreviewUrl, onBannerFileChange, onBannerClear }: Props) {
  return (
    <div className="space-y-4 sm:space-y-6 max-w-xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-display font-semibold mb-1 sm:mb-2">Name this batch</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Give your automation a recognizable name to find it later.</p>
      </div>
      <div className="space-y-3">
        <Label htmlFor="name">Batch Name</Label>
        <Input
          id="name"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="e.g. Q3 Leadership Training"
          className="h-12 text-lg px-4"
        />
      </div>
      <div className="space-y-3">
        <Label>Event Banner <span className="text-muted-foreground font-normal">(optional)</span></Label>
        {bannerPreviewUrl ? (
          <div className="relative">
            <img
              src={bannerPreviewUrl}
              alt="Banner preview"
              className="w-full rounded-lg object-cover border border-border"
              style={{ maxHeight: 180 }}
            />
            <button
              type="button"
              onClick={onBannerClear}
              className="absolute top-2 right-2 bg-background border border-border rounded-full p-1 hover:bg-secondary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {bannerFile && (
              <p className="text-xs text-muted-foreground mt-1">{bannerFile.name}</p>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-8 cursor-pointer hover:border-foreground transition-colors">
            <Upload className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Click to upload a banner image</span>
            <span className="text-xs text-muted-foreground/60">Shown on student certificate cards</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                onBannerFileChange(file);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
