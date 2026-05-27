import { SITE } from "@/lib/site";
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 prose prose-invert">
      <h1>Privacy Policy</h1>
      <p>
        {SITE.name} collects account data, download analytics, and payment information processed securely
        via Stripe. We do not sell personal data to third parties.
      </p>
      <p>
        Discord OAuth is used for login and community role sync. You can request account deletion by
        contacting support.
      </p>
    </article>
  );
}
