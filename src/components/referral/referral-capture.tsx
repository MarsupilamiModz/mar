"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { captureReferralClick } from "@/actions/admin/referrals";

export function ReferralCapture() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  useEffect(() => {
    if (!ref?.trim()) return;
    void captureReferralClick(ref);
  }, [ref]);

  return null;
}
