import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import AuthShell from "@/components/AuthShell";
import { describeApiError } from "@/lib/apiError";
import { api } from "@/lib/api";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true);
    try {
      await api.post("/api/auth/forgot-password", data);
      setSent(true);
    } catch (error) {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell title={t("auth.forgotTitle")} subtitle={t("auth.forgotSubtitle")}>
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">{t("auth.forgotSent")}</p>
          <p className="text-center text-sm">
            <Link href="/login" className="text-accent-blue">
              {t("auth.backToLogin")}
            </Link>
          </p>
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
          <Button type="submit" disabled={isLoading} className="w-full bg-accent-blue text-white">
            {isLoading ? t("common.loading") : t("auth.forgotButton")}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-accent-blue">
              {t("auth.backToLogin")}
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
