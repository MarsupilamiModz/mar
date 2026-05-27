export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl h-16">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="h-8 w-32 animate-pulse rounded-md bg-muted/50" />
        <div className="hidden lg:flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-16 animate-pulse rounded bg-muted/40" />
          ))}
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-9 animate-pulse rounded-md bg-muted/40" />
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted/40" />
        </div>
      </div>
    </header>
  );
}
