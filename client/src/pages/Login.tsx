import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import AuthShell from "@/components/AuthShell";
import { ApiError, describeApiError } from "@/lib/apiError";
import { api } from "@/lib/api";
import { useAuthFeatures } from "@/lib/features";

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: features } = useAuthFeatures();
  const [isLoading, setIsLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setUnverifiedEmail(null);
    try {
      await login(data.email, data.password);
      setLocation("/overview");
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(data.email);
      } else {
        toast({
          title: t("common.error"),
          description: describeApiError(error, t) || t("auth.invalidCredentials"),
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resend = async () => {
    if (!unverifiedEmail) return;
    await api.post("/api/auth/resend-verification", { email: unverifiedEmail });
    toast({ title: t("auth.verifyResent") });
  };

  return (
    <AuthShell title={t("auth.login")} subtitle={t("auth.loginSubtitle")}>
      {unverifiedEmail ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">{t("auth.verifyPending", { email: unverifiedEmail })}</p>
          <Button type="button" variant="outline" className="w-full" onClick={resend}>
            {t("auth.resendVerification")}
          </Button>
          <button type="button" className="text-sm text-accent-blue" onClick={() => setUnverifiedEmail(null)}>
            {t("auth.backToLogin")}
          </button>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-red-400 text-sm">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-red-400 text-sm">{form.formState.errors.password.message}</p>
            )}
          </div>
          <Button type="submit" disabled={isLoading} className="w-full bg-accent-blue text-white">
            {isLoading ? t("common.loading") : t("auth.loginButton")}
          </Button>
          {features?.google ? (
            <Button type="button" variant="outline" className="w-full" asChild>
              <a href="/api/auth/google">{t("auth.continueGoogle")}</a>
            </Button>
          ) : null}
          <p className="text-center text-sm text-slate-400">
            <Link href="/register" className="text-accent-blue hover:text-accent-green">
              {t("auth.noAccount")}
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
