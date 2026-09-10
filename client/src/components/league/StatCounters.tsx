import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";

interface StatCountersProps {
  goals: number;
  assists: number;
  onGoalsChange: (value: number) => void;
  onAssistsChange: (value: number) => void;
  minutes?: number;
  onMinutesChange?: (value: number) => void;
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
  minutes,
  onMinutesChange,
  disabled,
}: StatCountersProps) {
  const { t } = useTranslation();
  const showMinutes = typeof minutes === "number" && onMinutesChange;

  return (
    <div className="space-y-4">
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
      {showMinutes && (
        <div className="space-y-2">
          <Label htmlFor="minutes" className="text-slate-200">
            {t("stats.minutes")}
          </Label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 border-slate-600 text-white hover:bg-slate-700"
              disabled={disabled || minutes <= 0}
              onClick={() => onMinutesChange(Math.max(0, minutes - 5))}
              aria-label={t("stats.minutesDecrease")}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <input
              id="minutes"
              type="number"
              min={0}
              max={120}
              value={minutes}
              disabled={disabled}
              onChange={(event) => {
                const next = parseInt(event.target.value, 10);
                if (Number.isNaN(next)) {
                  onMinutesChange(0);
                  return;
                }
                onMinutesChange(Math.min(120, Math.max(0, next)));
              }}
              className="w-20 rounded-md border border-slate-600 bg-slate-900 text-center text-2xl font-semibold text-white tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 border-slate-600 text-white hover:bg-slate-700"
              disabled={disabled || minutes >= 120}
              onClick={() => onMinutesChange(Math.min(120, minutes + 5))}
              aria-label={t("stats.minutesIncrease")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-slate-400">{t("stats.minutesHint")}</p>
        </div>
      )}
    </div>
  );
}
