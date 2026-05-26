import { Card, CardContent } from "@/components/ui/card";
import { FileText, CheckCircle2, MailCheck } from "lucide-react";

interface Props {
  totalCount: number;
  generatedCount: number;
  sentCount: number;
}

export function BatchStatsCards({ totalCount, generatedCount, sentCount }: Props) {
  return (
    <>
      {/* Mobile: single compact bar */}
      <Card className="sm:hidden border-border/50 bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="grid grid-cols-3 divide-x divide-border/50">
            <div className="flex items-center gap-2 px-3 py-3 min-w-0">
              <div className="p-1.5 bg-secondary rounded-lg shrink-0">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold font-display leading-none">{totalCount}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Recipients</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-3 min-w-0">
              <div className="p-1.5 bg-secondary rounded-lg shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold font-display leading-none">{generatedCount}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Generated</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-3 min-w-0">
              <div className="p-1.5 bg-secondary rounded-lg shrink-0">
                <MailCheck className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold font-display leading-none">{sentCount}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Sent</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop: 3 separate cards */}
      <div className="hidden sm:grid grid-cols-3 gap-6">
        <Card className="border-border/50 bg-card shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-secondary rounded-xl shrink-0"><FileText className="w-6 h-6 text-muted-foreground" /></div>
            <div>
              <div className="text-2xl font-bold font-display">{totalCount}</div>
              <div className="text-sm font-medium text-muted-foreground">Total Recipients</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-secondary rounded-xl shrink-0"><CheckCircle2 className="w-6 h-6 text-muted-foreground" /></div>
            <div>
              <div className="text-2xl font-bold font-display">{generatedCount}</div>
              <div className="text-sm font-medium text-muted-foreground">Generated</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-secondary rounded-xl shrink-0"><MailCheck className="w-6 h-6 text-muted-foreground" /></div>
            <div>
              <div className="text-2xl font-bold font-display">{sentCount}</div>
              <div className="text-sm font-medium text-muted-foreground">Successfully Sent</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
