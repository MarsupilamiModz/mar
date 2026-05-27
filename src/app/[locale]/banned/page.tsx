export default function BannedPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-destructive">Account Suspended</h1>
      <p className="mt-4 text-muted-foreground">
        Your account has been banned. Contact support if you believe this is an error.
      </p>
    </div>
  );
}
