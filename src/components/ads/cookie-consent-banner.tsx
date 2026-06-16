"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { updateGoogleConsent } from "@/components/ads/google-consent-mode";

const STORAGE_KEY = "xumari-cookie-consent";

type ConsentChoice = "accepted" | "rejected" | null;

function readConsent(): ConsentChoice {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "accepted" || v === "rejected" ? v : null;
  } catch {
    return null;
  }
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = readConsent();
    if (stored === "accepted") {
      updateGoogleConsent(true);
      return;
    }
    if (stored === "rejected") {
      updateGoogleConsent(false);
      return;
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  const save = (choice: ConsentChoice) => {
    if (!choice) return;
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* ignore */
    }
    updateGoogleConsent(choice === "accepted");
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[100] border-t border-border/60 bg-background/95 backdrop-blur-md p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground max-w-2xl">
          We use cookies and similar technologies for ads, analytics, and site functionality.
          You can accept personalized ads or continue with essential cookies only (Google Consent Mode v2).
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => save("rejected")}>
            Essential only
          </Button>
          <Button variant="neon" size="sm" onClick={() => save("accepted")}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
