import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import AuthShell from "@/components/AuthShell";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { User } from "@shared/schema";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { applySession } = useAuth();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";
    if (!token) {
      setStatus("error");
      return;
    }
    api
      .get<{ user: User; token: string }>(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then((data) => {
        applySession(data);
        setStatus("ok");
        setLocation("/overview");
      })
      .catch(() => setStatus("error"));
  }, [applySession, setLocation]);

  return (
    <AuthShell title={t("auth.verifyTitle")} subtitle={t("auth.verifyWorking")}>
      <p className="text-sm text-slate-400">
        {status === "error" ? t("auth.verifyFailed") : t("auth.verifyWorking")}
      </p>
    </AuthShell>
  );
}
