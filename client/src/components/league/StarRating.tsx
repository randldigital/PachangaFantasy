import { useState, type KeyboardEvent } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  VALUATION_STARS,
  starFromTier,
  tierFromStar,
  type ValuationStar,
  type ValuationTier,
} from "@shared/domain/valuation";

const STAR_FILL: Record<ValuationTier, string> = {
  S: "text-yellow-500 fill-yellow-500",
  A: "text-emerald-500 fill-emerald-500",
  B: "text-blue-500 fill-blue-500",
  C: "text-purple-500 fill-purple-500",
  D: "text-red-500 fill-red-500",
};

interface StarRatingProps {
  value?: ValuationTier;
  onChange: (tier: ValuationTier) => void;
  disabled?: boolean;
  label: string;
  starLabel: (star: ValuationStar) => string;
}

export default function StarRating({
  value,
  onChange,
  disabled,
  label,
  starLabel,
}: StarRatingProps) {
  const selected = value ? starFromTier(value) : 0;
  const [hover, setHover] = useState<ValuationStar | 0>(0);
  const display = hover || selected;
  const colorTier = display ? tierFromStar(display) : null;

  const selectStar = (star: ValuationStar) => {
    const tier = tierFromStar(star);
    if (tier) onChange(tier);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const current = hover || selected || 3;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      selectStar(Math.min(5, current + 1) as ValuationStar);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      selectStar(Math.max(1, current - 1) as ValuationStar);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectStar(1);
    } else if (event.key === "End") {
      event.preventDefault();
      selectStar(5);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-0.5"
      onKeyDown={onKeyDown}
    >
      {VALUATION_STARS.map((star) => {
        const filled = star <= display;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={selected === star}
            aria-label={starLabel(star)}
            disabled={disabled}
            onClick={() => selectStar(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(0)}
            className="rounded p-0.5 text-slate-500 hover:scale-110 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Star
              className={cn(
                "h-6 w-6",
                filled && colorTier ? STAR_FILL[colorTier] : "text-slate-500",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
