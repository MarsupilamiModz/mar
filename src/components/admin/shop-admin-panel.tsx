"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createShopProduct, updateShopProduct, deleteShopProduct } from "@/actions/admin/shop";
import { useAppToast } from "@/hooks/use-app-toast";
import { CREDITS_PER_EUR } from "@/lib/credits";
import { formatEuro, formatNumber } from "@/lib/format-locale";

type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  productType: string;
  creditPrice: number;
  priceCents: number;
  creditsAmount: number | null;
  stripePriceId: string | null;
  isFeatured: boolean;
  isActive: boolean;
  salePercent: number;
  sortOrder: number;
  _count?: { purchases: number };
};

function creditsToEuroHint(credits: number, locale: string) {
  const euros = credits / CREDITS_PER_EUR;
  return `${formatNumber(credits, locale)} Credits = ${formatEuro(Math.round(euros * 100), locale)}`;
}

export function ShopAdminPanel({ products, locale }: { products: Product[]; locale: string }) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Product | null>(null);
  const [creditsPreview, setCreditsPreview] = useState(editing?.creditsAmount ?? 0);

  return (
    <div className="space-y-6">
      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">{editing ? "Produkt bearbeiten" : "Produkt erstellen"}</h3>
        <p className="text-xs text-muted-foreground">
          Kurs: 10 € = 1.000 Credits · z. B. 500 Credits = 5,00 €
        </p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const priceEuro = Number(fd.get("priceEuro") || 0);
            const payload = {
              name: fd.get("name") as string,
              description: (fd.get("description") as string) || undefined,
              category: fd.get("category") as "CREDITS" | "MEMBERSHIP" | "MODS" | "EXCLUSIVE" | "BUNDLES" | "ACCESS",
              productType: fd.get("productType") as "CREDIT_PACK" | "MEMBERSHIP" | "MOD" | "EXCLUSIVE" | "BUNDLE" | "SUBSCRIPTION" | "ACCESS",
              creditPrice: Number(fd.get("creditPrice") || 0),
              priceCents: Math.round(priceEuro * 100),
              creditsAmount: fd.get("creditsAmount") ? Number(fd.get("creditsAmount")) : undefined,
              stripePriceId: ((fd.get("stripePriceId") as string) || undefined)?.trim() || null,
              isFeatured: fd.get("isFeatured") === "on",
              isActive: fd.get("isActive") === "on",
              salePercent: Number(fd.get("salePercent") || 0),
              sortOrder: Number(fd.get("sortOrder") || 0),
            };
            startTransition(async () => {
              const r = editing
                ? await updateShopProduct(editing.id, payload)
                : await createShopProduct(payload);
              if (r.success) {
                appToast.saved();
                setEditing(null);
                router.refresh();
              } else appToast.error(r.error);
            });
          }}
        >
          <Input name="name" defaultValue={editing?.name} placeholder="Produktname" required />
          <Input
            name="creditsAmount"
            type="number"
            defaultValue={editing?.creditsAmount ?? ""}
            placeholder="Credits (z. B. 500)"
            onChange={(e) => setCreditsPreview(Number(e.target.value) || 0)}
          />
          <Input
            name="priceEuro"
            type="number"
            step="0.01"
            min={0}
            defaultValue={editing ? (editing.priceCents / 100).toFixed(2) : ""}
            placeholder="Preis in € (z. B. 5.00)"
          />
          <Input
            name="stripePriceId"
            defaultValue={editing?.stripePriceId ?? ""}
            placeholder="Stripe Price ID (price_...)"
            className="font-mono text-xs"
          />
          <Input name="creditPrice" type="number" defaultValue={editing?.creditPrice ?? 0} placeholder="Preis in Credits (In-App-Kauf)" />
          {creditsPreview > 0 && (
            <p className="text-xs text-neon-blue sm:col-span-2">{creditsToEuroHint(creditsPreview, locale)}</p>
          )}
          <select name="category" defaultValue={editing?.category ?? "CREDITS"} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
            {["CREDITS", "MEMBERSHIP", "MODS", "EXCLUSIVE", "BUNDLES", "ACCESS"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="productType" defaultValue={editing?.productType ?? "CREDIT_PACK"} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
            {["CREDIT_PACK", "MEMBERSHIP", "MOD", "EXCLUSIVE", "BUNDLE", "SUBSCRIPTION", "ACCESS"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Input name="salePercent" type="number" defaultValue={editing?.salePercent ?? 0} placeholder="Rabatt %" />
          <Input name="sortOrder" type="number" defaultValue={editing?.sortOrder ?? 0} placeholder="Sortierung" />
          <Textarea name="description" defaultValue={editing?.description ?? ""} placeholder="Beschreibung" className="sm:col-span-2" rows={3} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={editing?.isFeatured} /> Featured</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} /> Aktiv</label>
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" variant="neon" disabled={pending}>{editing ? "Speichern" : "Erstellen"}</Button>
            {editing && <Button type="button" variant="outline" onClick={() => setEditing(null)}>Abbrechen</Button>}
          </div>
        </form>
      </Card>

      <div className="space-y-2">
        {products.map((p) => (
          <Card key={p.id} className="glass p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{p.name}</p>
                {p.isFeatured && <Badge variant="premium">Featured</Badge>}
                {!p.isActive && <Badge variant="outline">Inaktiv</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {p.category} · {p.productType} · {p._count?.purchases ?? 0} Verkäufe
              </p>
              <p className="text-sm mt-1">
                {p.creditsAmount ? (
                  <>
                    <span className="text-neon-blue">{formatNumber(p.creditsAmount, locale)} Credits</span>
                    {" · "}
                    <span>{formatEuro(p.priceCents, locale)}</span>
                    {p.creditPrice > 0 && (
                      <span className="text-muted-foreground"> · {formatNumber(p.creditPrice, locale)} Credits (In-App)</span>
                    )}
                  </>
                ) : (
                  <span>{formatEuro(p.priceCents, locale)}</span>
                )}
              </p>
              {p.stripePriceId && (
                <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">{p.stripePriceId}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(p);
                  setCreditsPreview(p.creditsAmount ?? 0);
                }}
              >
                Bearbeiten
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await deleteShopProduct(p.id);
                    if (r.success) router.refresh();
                    else appToast.error(r.error);
                  })
                }
              >
                Löschen
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
