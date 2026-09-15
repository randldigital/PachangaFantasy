import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trophy, Award, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Player } from "@shared/schema";
import { formatDisplayMarketValue } from "@shared/domain/displayValue";

interface SortablePlayerItemProps {
  player: Player;
  index: number;
  tierColor: string;
  tierLabel: string;
  marketValue?: number;
}

export default function SortablePlayerItem({ 
  player, 
  index, 
  tierColor, 
  tierLabel, 
  marketValue 
}: SortablePlayerItemProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 rounded-lg border border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 transition-all ${
        isDragging ? 'opacity-50 scale-105 shadow-lg' : ''
      }`}
      {...attributes}
    >
      <div className="flex items-center space-x-4">
        <div
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-white transition-colors"
          {...listeners}
        >
          <GripVertical className="w-5 h-5" />
        </div>
        
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${tierColor}`}>
          {tierLabel}
        </div>
        
        <div className="text-2xl">{player.emoji || '👤'}</div>
        
        <div>
          <div className="text-white font-medium">{player.name}</div>
          <div className="text-slate-400 text-sm">
            {t('tierlist.position')} {index + 1}
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {marketValue && (
          <div className="text-right">
            <div className="text-emerald-400 font-bold">
              {formatDisplayMarketValue(marketValue)}
            </div>
            <div className="text-slate-400 text-xs">
              {t('tierlist.marketValue')}
            </div>
          </div>
        )}
        
        {index === 0 && (
          <Trophy className="w-5 h-5 text-yellow-500" />
        )}
        {index === 1 && (
          <Award className="w-5 h-5 text-gray-400" />
        )}
        {index === 2 && (
          <Star className="w-5 h-5 text-amber-600" />
        )}
      </div>
    </div>
  );
}