import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AvatarUploadButton from "@/components/AvatarUploadButton";
import { BrandIcon } from "@/components/BrandMark";
import { isPaymentsEnabled, useAuthFeatures } from "@/lib/features";

export default function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { data: features } = useAuthFeatures();
  const showBilling = isPaymentsEnabled(features);

  return (
    <nav className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <BrandIcon className="h-10 w-10" />
              <span className="text-xl font-bold text-text-primary">{t("app.title")}</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            {user && (
              <>
                {showBilling ? (
                  <Link href="/billing">
                    <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                      <CreditCard className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">{t("nav.billing")}</span>
                    </Button>
                  </Link>
                ) : null}
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
