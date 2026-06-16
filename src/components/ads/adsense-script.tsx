import Script from "next/script";
import { ADSENSE_SCRIPT_ID, adsenseScriptUrl } from "@/lib/adsense-config";

type Props = {
  clientId: string;
};

export function AdSenseScript({ clientId }: Props) {
  if (!clientId?.startsWith("ca-pub-")) return null;

  return (
    <Script
      id={ADSENSE_SCRIPT_ID}
      async
      src={adsenseScriptUrl(clientId)}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
