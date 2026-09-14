import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import AuthShell from "@/components/AuthShell";
import { ApiError, describeApiError } from "@/lib/apiError";
import { api } from "@/lib/api";

export default function ResetPassword() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    setIsLoading(true);
    try {
      await api.post("/api/auth/reset-password", data);
      toast({ title: t("auth.resetSuccess") });
      setLocation("/login");
    } catch (error) {
      toast({
        title: t("common.error"),
        description:
          error instanceof ApiError && error.code === "INVALID_RESET_TOKEN"
            ? t("auth.resetFailed")
            : describeApiError(error, t) || t("auth.resetFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title={t("auth.resetTitle")} subtitle={t("auth.resetFailed")}>
        <p className="text-center text-sm">
          <Link href="/forgot" className="text-accent-blue">
            {t("auth.forgotPassword")}
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <input type="hidden" {...form.register("token")} />
        <div className="space-y-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-red-400 text-sm">{form.formState.errors.password.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword && (
            <p className="text-red-400 text-sm">{t("auth.passwordMismatch")}</p>
          )}
        </div>
        <Button type="submit" disabled={isLoading} className="w-full bg-accent-blue text-white">
          {isLoading ? t("common.loading") : t("auth.resetButton")}
        </Button>
        <p className="text-center text-sm">
          <Link href="/login" className="text-accent-blue">
            {t("auth.backToLogin")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
