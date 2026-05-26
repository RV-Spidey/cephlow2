import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  name: string;
  onNameChange: (v: string) => void;
}

export function StepName({ name, onNameChange }: Props) {
  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
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
    </div>
  );
}
