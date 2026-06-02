import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

export function Logo({
  className,
  showText = true,
  size = "md",
}: {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "h-7 w-7 text-sm", md: "h-9 w-9 text-base", lg: "h-12 w-12 text-xl" };

  return (
    <span className={cn("inline-flex items-center gap-2 font-bold", className)}>
      <span
        className={cn(
          "flex items-center justify-center rounded-lg bg-gradient-to-br from-neon-purple to-neon-blue font-black text-white shadow-neon",
          sizes[size]
        )}
        aria-hidden
      >
        X
      </span>
      {showText && (
        <span className="bg-gradient-to-r from-neon-purple to-neon-blue bg-clip-text text-transparent">
          {SITE.name}
        </span>
      )}
    </span>
  );
}
