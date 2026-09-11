import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Trophy, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AvatarUploadButton from "@/components/AvatarUploadButton";

export default function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <nav className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <Trophy className="h-8 w-8 text-accent-blue" />
              <span className="text-xl font-bold text-text-primary">{t("app.title")}</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            {user && (
              <>
                <Link href="/billing">
                  <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                    <CreditCard className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">{t("nav.billing")}</span>
                  </Button>
                </Link>
                <AvatarUploadButton />
                <span className="text-sm text-text-secondary hidden sm:inline">
                  {t("nav.welcome", { name: user.username })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t("nav.logout")}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
