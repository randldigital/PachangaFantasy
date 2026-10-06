import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AdSlot from "@/components/AdSlot";
import { BrandIcon, BrandLogo } from "@/components/BrandMark";

export default function Landing() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/overview");
    }
  }, [user, loading, setLocation]);

  useEffect(() => {
    document.title = t("landing.docTitle");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", t("landing.docDescription"));
    }
  }, [t]);

  if (loading || user) {
    return (
      <div className="landing-page min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-cyan-400/40 border-t-cyan-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="landing-page min-h-screen text-slate-100">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity">
          <BrandIcon className="h-9 w-9" />
          <span className="sr-only">{t("app.title")}</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="text-sm font-medium text-slate-200/90 underline-offset-4 hover:underline landing-fade"
          >
            {t("landing.navLogin")}
          </Link>
        </div>
      </header>

      <section className="relative min-h-[100svh] flex flex-col overflow-hidden">
        <div className="absolute inset-0 landing-hero-atmosphere" aria-hidden />
        <div className="absolute inset-0 landing-hero-pitch" aria-hidden />
        <div className="absolute inset-0 landing-hero-vignette" aria-hidden />

        <div className="relative z-10 flex flex-1 flex-col justify-center px-4 pt-24 pb-6 sm:px-8 sm:pb-8">
          <div className="mx-auto w-full max-w-3xl">
            <div className="landing-hero-frame flex flex-col items-center text-center">
              <BrandLogo className="landing-reveal landing-reveal-1 landing-hero-mark mx-auto h-auto w-full max-w-[10rem] object-contain sm:max-w-[11.5rem] md:max-w-[13rem]" />
              <h1 className="landing-reveal landing-reveal-2 mt-5 max-w-xl font-landing-display text-3xl sm:text-4xl md:text-[2.75rem] tracking-tight text-white leading-[1.05]">
                {t("landing.headline")}
              </h1>
              <p className="landing-reveal landing-reveal-3 mt-3 max-w-lg text-base sm:text-lg text-slate-300/95 leading-relaxed">
                {t("landing.lead")}
              </p>
              <div className="landing-reveal landing-reveal-4 mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
                >
                  {t("landing.ctaRegister")}
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center border border-white/35 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  {t("landing.ctaLogin")}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 px-4 py-4 sm:px-8 sm:py-5">
          <div className="mx-auto max-w-3xl">
            <AdSlot slot="overview.banner" alwaysReserve className="w-full my-0" />
          </div>
        </div>
      </section>

      <main>
        <section className="border-t border-white/10 px-4 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-landing-display text-3xl sm:text-4xl tracking-tight text-white">
              {t("landing.fantasyTitle")}
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed whitespace-pre-line">
              {t("landing.fantasyBody")}
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 bg-[hsl(152,22%,7%)] px-4 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-landing-display text-3xl sm:text-4xl tracking-tight text-white">
              {t("landing.clubTitle")}
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed whitespace-pre-line">
              {t("landing.clubBody")}
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 px-4 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-landing-display text-3xl sm:text-4xl tracking-tight text-white">
              {t("landing.matchTitle")}
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed whitespace-pre-line">
              {t("landing.matchBody")}
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 px-4 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-landing-display text-3xl sm:text-4xl tracking-tight text-white">
              {t("landing.whoTitle")}
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed whitespace-pre-line">
              {t("landing.whoBody")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
              >
                {t("landing.ctaRegister")}
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center border border-white/35 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t("landing.ctaLogin")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("landing.footerBrand")}</p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-slate-200 underline-offset-4 hover:underline">
              {t("landing.privacy")}
            </Link>
            <Link href="/terms" className="hover:text-slate-200 underline-offset-4 hover:underline">
              {t("landing.terms")}
            </Link>
            <Link href="/login" className="hover:text-slate-200 underline-offset-4 hover:underline">
              {t("landing.navLogin")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
