import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import AuthShell from "@/components/AuthShell";
import { ApiError, describeApiError } from "@/lib/apiError";
import { api } from "@/lib/api";
import { useAuthFeatures } from "@/lib/features";

export default function Register() {
  const { t } = useTranslation();
  const { register: registerUser } = useAuth();
  const { toast } = useToast();
  const { data: features } = useAuthFeatures();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  const onSubmit = async (data: InsertUser) => {
    setIsLoading(true);
    try {
      const result = await registerUser(data);
      setPendingEmail(result.email);
    } catch (error) {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t) || t("auth.registerFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resend = async () => {
    if (!pendingEmail) return;
    await api.post("/api/auth/resend-verification", { email: pendingEmail });
    toast({ title: t("auth.verifyResent") });
  };

  if (pendingEmail) {
    return (
      <AuthShell title={t("auth.verifyTitle")} subtitle={t("auth.verifyPending", { email: pendingEmail })}>
        <div className="space-y-4">
          <Button type="button" className="w-full bg-accent-blue text-white" onClick={resend}>
            {t("auth.resendVerification")}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-accent-blue">
              {t("auth.backToLogin")}
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("auth.register")} subtitle={t("auth.registerSubtitle")}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="username">{t("auth.username")}</Label>
          <Input id="username" autoComplete="username" {...form.register("username")} />
          {form.formState.errors.username && (
            <p className="text-red-400 text-sm">{form.formState.errors.username.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="text-red-400 text-sm">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
          {form.formState.errors.password && (
            <p className="text-red-400 text-sm">{form.formState.errors.password.message}</p>
          )}
        </div>
        <Button type="submit" disabled={isLoading} className="w-full bg-accent-blue text-white">
          {isLoading ? t("common.loading") : t("auth.registerButton")}
        </Button>
        {features?.google ? (
          <Button type="button" variant="outline" className="w-full" asChild>
            <a href="/api/auth/google">{t("auth.continueGoogle")}</a>
          </Button>
        ) : null}
        {features && !features.email ? (
          <p className="text-xs text-amber-400">{t("auth.emailNotConfigured")}</p>
        ) : null}
        <p className="text-center text-sm text-slate-400">
          <Link href="/login" className="text-accent-blue hover:text-accent-green">
            {t("auth.hasAccount")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
