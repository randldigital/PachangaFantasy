import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { parseApiErrorBody, describeApiError } from "@/lib/apiError";
import { apiUrl } from "@/lib/apiBase";
import UserAvatar from "@/components/UserAvatar";

export default function AvatarUploadButton() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [version, setVersion] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!user) {
    return null;
  }

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("avatar", file);
      const token = localStorage.getItem("token");
      const response = await fetch(apiUrl("/api/users/me/avatar"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
        credentials: "include",
      });
      if (!response.ok) {
        throw parseApiErrorBody(response.status, await response.text());
      }
      setVersion((current) => current + 1);
      toast({ title: t("avatar.uploaded"), description: t("avatar.uploadedDescription") });
      setOpen(false);
    } catch (error) {
      toast({
        title: t("common.error"),
        description: describeApiError(error, t),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    setUploading(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(apiUrl("/api/users/me/avatar"), {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      setVersion((current) => current + 1);
      setOpen(false);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full ring-offset-2 ring-offset-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        aria-label={t("avatar.change")}
      >
        <UserAvatar userId={user.id} name={user.username} version={version} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">{t("avatar.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <UserAvatar userId={user.id} name={user.username} version={version} className="h-24 w-24" />
            <p className="text-sm text-slate-400 text-center">{t("avatar.hint")}</p>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  void upload(file);
                }
              }}
            />
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                {t("avatar.choose")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => void remove()}
                className="flex-1 border-slate-600 text-slate-200 hover:bg-slate-700"
              >
                {t("avatar.remove")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
