import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Avatar endpoints require a bearer token, so the image is fetched into an object URL. */
export function useAvatarUrl(userId: number | null | undefined): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (userId == null) {
      setUrl(undefined);
      return;
    }

    let objectUrl: string | undefined;
    let cancelled = false;
    const token = localStorage.getItem("token");

    fetch(`/api/users/${userId}/avatar`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(undefined));

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [userId]);

  return url;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

interface UserAvatarProps {
  userId?: number | null;
  /** Alias inside this League or Club; falls back to initials when there is no image. */
  name: string;
  className?: string;
  /** Cache-busting token so a fresh upload replaces the cached image. */
  version?: number;
}

export default function UserAvatar({ userId, name, className, version }: UserAvatarProps) {
  const url = useAvatarUrl(userId);
  return (
    <Avatar className={cn("h-8 w-8", className)}>
      {url && <AvatarImage src={version ? `${url}#${version}` : url} alt={name} />}
      <AvatarFallback className="bg-slate-700 text-xs text-slate-200">
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}
