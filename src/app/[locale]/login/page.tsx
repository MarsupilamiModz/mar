import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16 h-96 animate-pulse rounded-xl bg-muted/20" />}>
      <LoginForm />
    </Suspense>
  );
}
