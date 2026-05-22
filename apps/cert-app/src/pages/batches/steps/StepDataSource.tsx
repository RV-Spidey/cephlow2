import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";

interface Props {
  hasGoogleAuth: boolean;
  connectGoogle: () => void;
  sheetId: string;
  sheetName: string;
  pickerLoading: "sheet" | "presentation" | null;
  onPickSheet: () => void;
}

export function StepDataSource({ hasGoogleAuth, connectGoogle, sheetId, sheetName, pickerLoading, onPickSheet }: Props) {
  return (
    <div className="space-y-3 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-display font-semibold mb-1 sm:mb-2">Select Google Sheet</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Choose the spreadsheet containing your recipient data.</p>
      </div>
      {!hasGoogleAuth ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12 border-2 border-dashed border-border rounded-xl text-center">
          <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
          <div>
            <p className="font-bold uppercase tracking-widest text-sm">Google Account Not Connected</p>
            <p className="text-muted-foreground text-sm mt-1">Connect your Google account to access your spreadsheets.</p>
          </div>
          <Button onClick={connectGoogle} className="mt-2">
            Connect Google Account
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Button
            variant="outline"
            className="h-12 px-6 gap-2"
            disabled={pickerLoading === "sheet"}
            onClick={onPickSheet}
          >
            {pickerLoading === "sheet" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {sheetId ? "Change Sheet" : "Pick from Google Drive"}
          </Button>
          {sheetId && (
            <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 border-primary bg-primary/5 ring-4 ring-primary/10 max-w-sm">
              <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-foreground line-clamp-1">{sheetName}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Spreadsheet selected</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
