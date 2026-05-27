import { SITE } from "@/lib/site";
export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 prose prose-invert">
      <h1>Terms of Service</h1>
      <p>
        By using {SITE.name} you agree to these terms. Mod creators retain intellectual property rights to
        their content. Premium subscriptions renew automatically unless canceled before the renewal date.
      </p>
      <p>
        You may not redistribute premium downloads outside the platform. Violations may result in account
        suspension.
      </p>
    </article>
  );
}
