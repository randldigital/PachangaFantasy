import type { ReactNode } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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
          <Link href="/login" className="inline-flex">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-accent-blue via-accent-purple to-accent-green rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">P</span>
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t("app.title")}</h1>
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
