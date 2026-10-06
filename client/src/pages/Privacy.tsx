import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { BrandIcon } from "@/components/BrandMark";

export default function Privacy() {
  const { t } = useTranslation();

  return (
    <div className="landing-page min-h-screen px-4 py-10 sm:px-8 text-slate-200">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <BrandIcon className="h-7 w-7" />
          {t("app.title")}
        </Link>
        <h1 className="mt-8 font-landing-display text-4xl tracking-tight text-white">
          {t("legal.privacyTitle")}
        </h1>
        <p className="mt-2 text-sm text-slate-400">{t("legal.updated")}</p>
        <div className="mt-8 space-y-5 text-slate-300 leading-relaxed whitespace-pre-line">
          {t("legal.privacyBody")}
        </div>
        <p className="mt-10">
          <Link href="/" className="text-cyan-300 hover:underline underline-offset-4">
            {t("landing.backHome")}
          </Link>
        </p>
      </div>
    </div>
  );
}
