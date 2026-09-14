import { cn } from "@/lib/utils";

export const BRAND_ICON_SRC = "/brand/icon.png";
export const BRAND_LOGO_SRC = "/brand/logo.png";

export function BrandIcon({ className }: { className?: string }) {
  return (
    <img
      src={BRAND_ICON_SRC}
      alt=""
      width={1024}
      height={1024}
      className={cn("h-8 w-8 object-contain", className)}
    />
  );
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt="Pachanga Fantasy"
      width={1024}
      height={1024}
      className={cn("h-40 w-auto object-contain", className)}
    />
  );
}
