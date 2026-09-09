import { useTranslation } from "react-i18next";
import { Target, Trophy, History, List, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function MobileBottomNav({ activeTab, setActiveTab }: MobileBottomNavProps) {
  const { t } = useTranslation();

  const tabs = [
    { id: 'lineup', icon: Target, label: t('league.tabs.lineup') },
    { id: 'clasificacion', icon: Trophy, label: t('league.tabs.clasificacion') },
    { id: 'historial', icon: History, label: t('league.tabs.historial') },
    { id: 'tierlist', icon: List, label: t('league.tabs.tierlist') },
    { id: 'stats', icon: BarChart3, label: t('league.tabs.stats') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 lg:hidden z-50 overflow-hidden">
      <div className="flex min-w-0">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              className={`flex-1 min-w-0 h-16 rounded-none flex flex-col items-center justify-center gap-1 px-1 whitespace-normal ${
                isActive 
                  ? 'text-emerald-400 bg-emerald-500/10' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <IconComponent className="w-5 h-5 shrink-0" />
              <span className="text-[10px] leading-tight font-medium w-full truncate">{tab.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}