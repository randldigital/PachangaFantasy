import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";

interface StatCountersProps {
  goals: number;
  assists: number;
  onGoalsChange: (value: number) => void;
  onAssistsChange: (value: number) => void;
  disabled?: boolean;
}

function Counter({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-slate-200">
        {label}
      </Label>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 border-slate-600 text-white hover:bg-slate-700"
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span id={id} className="w-10 text-center text-2xl font-semibold text-white tabular-nums">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 border-slate-600 text-white hover:bg-slate-700"
          disabled={disabled}
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function StatCounters({
  goals,
  assists,
  onGoalsChange,
  onAssistsChange,
  disabled,
}: StatCountersProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-4">
      <Counter
        id="goals"
        label={t("stats.goals")}
        value={goals}
        onChange={onGoalsChange}
        disabled={disabled}
      />
      <Counter
        id="assists"
        label={t("stats.assists")}
        value={assists}
        onChange={onAssistsChange}
        disabled={disabled}
      />
    </div>
  );
}
