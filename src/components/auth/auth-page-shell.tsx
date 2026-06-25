import { SafeImage } from "@/components/ui/safe-image";
import { Logo } from "@/components/brand/logo";
import type { AuthBrandingSettings } from "@/lib/auth-branding";

export function AuthPageShell({
  branding,
  children,
}: {
  branding: AuthBrandingSettings;
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-[calc(100vh-4rem)] relative"
      style={
        branding.backgroundUrl
          ? {
              backgroundImage: `url(${branding.backgroundUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundAttachment: "fixed",
            }
          : undefined
      }
    >
      {branding.backgroundUrl && (
        <div className="absolute inset-0 bg-background/85 backdrop-blur-[2px]" aria-hidden />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

export function AuthLogo({
  branding,
  variant = "login",
}: {
  branding: AuthBrandingSettings;
  variant?: "login" | "register";
}) {
  const src = variant === "register" ? branding.registerLogoUrl ?? branding.loginLogoUrl : branding.loginLogoUrl;
  if (src) {
    return (
      <div className="relative mx-auto mb-4 h-14 w-48">
        <SafeImage src={src} alt="" fill className="object-contain" priority />
      </div>
    );
  }
  return (
    <div className="flex justify-center mb-4">
      <Logo />
    </div>
  );
}
