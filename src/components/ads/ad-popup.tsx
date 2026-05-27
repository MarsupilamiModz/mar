"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AdSlot, type AdPlacementData } from "@/components/ads/ad-slot";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "mm_ad_popup_dismissed";

type AdPopupProps = {
  ad: AdPlacementData;
};

export function AdPopup({ ad }: AdPopupProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(`${DISMISS_KEY}:${ad.id}`);
    if (dismissed) return;
    const timer = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(timer);
  }, [ad.id]);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(`${DISMISS_KEY}:${ad.id}`, "1");
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg glass rounded-xl border border-neon-purple/30 shadow-[0_0_40px_-8px_rgba(168,85,247,0.4)] overflow-hidden">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-10 h-8 w-8"
          onClick={dismiss}
          aria-label="Close ad"
        >
          <X className="h-4 w-4" />
        </Button>
        <AdSlot ad={ad} lazy={false} className="border-0 rounded-none min-h-[200px]" />
      </div>
    </div>
  );
}
