"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createShopProduct, updateShopProduct, deleteShopProduct } from "@/actions/admin/shop";
import { useAppToast } from "@/hooks/use-app-toast";

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
  isFeatured: boolean;
  isActive: boolean;
  salePercent: number;
  sortOrder: number;
  _count?: { purchases: number };
};

export function ShopAdminPanel({ products }: { products: Product[] }) {
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Product | null>(null);

  return (
    <div className="space-y-6">
      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">{editing ? "Edit product" : "Create product"}</h3>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const payload = {
              name: fd.get("name") as string,
              description: (fd.get("description") as string) || undefined,
              category: fd.get("category") as "CREDITS" | "MEMBERSHIP" | "MODS" | "EXCLUSIVE" | "BUNDLES" | "ACCESS",
              productType: fd.get("productType") as "CREDIT_PACK" | "MEMBERSHIP" | "MOD" | "EXCLUSIVE" | "BUNDLE" | "SUBSCRIPTION" | "ACCESS",
              creditPrice: Number(fd.get("creditPrice") || 0),
              priceCents: Number(fd.get("priceCents") || 0),
              creditsAmount: fd.get("creditsAmount") ? Number(fd.get("creditsAmount")) : undefined,
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
                window.location.reload();
              } else appToast.error(r.error);
            });
          }}
        >
          <Input name="name" defaultValue={editing?.name} placeholder="Product name" required />
          <Input name="creditPrice" type="number" defaultValue={editing?.creditPrice ?? 0} placeholder="Credit price" />
          <Input name="priceCents" type="number" defaultValue={editing?.priceCents ?? 0} placeholder="EUR cents (Stripe)" />
          <Input name="creditsAmount" type="number" defaultValue={editing?.creditsAmount ?? ""} placeholder="Credits amount (packs)" />
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
          <Input name="salePercent" type="number" defaultValue={editing?.salePercent ?? 0} placeholder="Sale %" />
          <Input name="sortOrder" type="number" defaultValue={editing?.sortOrder ?? 0} placeholder="Sort order" />
          <Textarea name="description" defaultValue={editing?.description ?? ""} placeholder="Description" className="sm:col-span-2" rows={3} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={editing?.isFeatured} /> Featured</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} /> Active</label>
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" variant="neon" disabled={pending}>{editing ? "Update" : "Create"}</Button>
            {editing && <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>}
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
                {!p.isActive && <Badge variant="outline">Inactive</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{p.category} · {p.productType} · {p._count?.purchases ?? 0} sales</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Edit</Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await deleteShopProduct(p.id);
                    if (r.success) window.location.reload();
                    else appToast.error(r.error);
                  })
                }
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
