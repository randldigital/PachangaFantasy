import type { ReactNode } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { BrandLogo } from "@/components/BrandMark";

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-primary">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <Link href="/login" className="inline-flex justify-center">
            <BrandLogo />
          </Link>
          <p className="sr-only">{t("app.title")}</p>
          <p className="text-text-secondary text-sm">{t("app.subtitle")}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-6 sm:p-8 shadow-xl">
          <div className="mb-6 space-y-1">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
