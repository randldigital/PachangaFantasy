import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { currentSeasonKey, sortSeasonKeysDescending } from "@shared/domain/season";

export const ALL_SEASONS = "all";

interface SeasonSwitcherProps {
  seasons: string[];
  value: string;
  onChange: (season: string) => void;
}

/** Seasons run 1 August to 31 July; the current one is selected by default. */
export function defaultSeason(seasons: string[]): string {
  const current = currentSeasonKey();
  if (seasons.includes(current)) {
    return current;
  }
  return sortSeasonKeysDescending(seasons)[0] ?? current;
}

export default function SeasonSwitcher({ seasons, value, onChange }: SeasonSwitcherProps) {
  const { t } = useTranslation();
  const ordered = sortSeasonKeysDescending(seasons);

  if (ordered.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-slate-400">{t("season.label")}</span>
      {ordered.map((season) => (
        <Button
          key={season}
          type="button"
          size="sm"
          variant={value === season ? "default" : "outline"}
          className={
            value === season
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "border-slate-600 text-slate-200 hover:bg-slate-700"
          }
          onClick={() => onChange(season)}
        >
          {season}
        </Button>
      ))}
      <Button
        type="button"
        size="sm"
        variant={value === ALL_SEASONS ? "default" : "outline"}
        className={
          value === ALL_SEASONS
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : "border-slate-600 text-slate-200 hover:bg-slate-700"
        }
        onClick={() => onChange(ALL_SEASONS)}
      >
        {t("season.all")}
      </Button>
    </div>
  );
}
