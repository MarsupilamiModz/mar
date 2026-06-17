"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitShopProductOrder } from "@/actions/shop";
import { useAppToast } from "@/hooks/use-app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import { formatShopPrice, FORM_FIELD_LABELS } from "@/lib/shop-enterprise";
import type { ShopFormFieldType, ShopPricingMode } from "@prisma/client";

type Product = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  pricingMode: ShopPricingMode;
  priceCents: number;
  thumbnailUrl: string | null;
  coverImageUrl: string | null;
  bannerImageUrl: string | null;
  videoUrl: string | null;
  customType: { name: string; slug: string } | null;
  shopCategory: { name: string; slug: string } | null;
  formFields: {
    id: string;
    fieldType: ShopFormFieldType;
    label: string;
    placeholder: string | null;
    helpText: string | null;
    required: boolean;
    options: unknown;
  }[];
  media: { mediaType: string; url: string; alt: string | null }[];
};

export function ShopProductOrderPage({ product, locale }: { product: Product; locale: string }) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);

  const hero = product.bannerImageUrl ?? product.coverImageUrl ?? product.thumbnailUrl;
  const gallery = product.media.filter((m) => m.mediaType === "GALLERY" || m.mediaType === "EXAMPLE");

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped].slice(0, 10));
  }

  return (
    <div className="space-y-8">
      {hero && (
        <div className="relative aspect-[21/9] rounded-xl overflow-hidden glass">
          <SafeImage src={hero} alt="" fill className="object-cover" sizes="1200px" priority />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {product.customType && <Badge variant="outline">{product.customType.name}</Badge>}
              {product.shopCategory && <Badge variant="secondary">{product.shopCategory.name}</Badge>}
            </div>
            <h1 className="text-3xl font-bold">{product.name}</h1>
            {product.shortDescription && (
              <p className="text-muted-foreground mt-2">{product.shortDescription}</p>
            )}
          </div>
          {product.description && (
            <Card className="glass p-6 prose prose-invert max-w-none text-sm whitespace-pre-wrap">
              {product.description}
            </Card>
          )}
          {gallery.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {gallery.map((m, i) => (
                <div key={i} className="relative aspect-video rounded-lg overflow-hidden glass">
                  <SafeImage src={m.url} alt={m.alt ?? ""} fill className="object-cover" sizes="300px" />
                </div>
              ))}
            </div>
          )}
        </div>

        <Card className="glass p-6 space-y-4 h-fit sticky top-24">
          <p className="text-2xl font-bold text-gradient">
            {formatShopPrice(product.priceCents, product.pricingMode, locale)}
          </p>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              fd.set("productSlug", product.slug);
              fd.set("clientOrigin", typeof window !== "undefined" ? window.location.origin : "");
              files.forEach((f) => fd.append("order_files", f));

              startTransition(async () => {
                const r = await submitShopProductOrder(fd, locale);
                if (!r.success) {
                  appToast.error(r.error);
                  return;
                }
                if (r.data.checkoutUrl) {
                  window.location.href = r.data.checkoutUrl;
                  return;
                }
                appToast.saved();
                router.push(`/${locale}/dashboard/orders/${r.data.orderId}`);
                router.refresh();
              });
            }}
          >
            {product.formFields.map((field) => (
              <div key={field.id} className="space-y-1">
                <label className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </label>
                {field.fieldType === "TEXTAREA" ? (
                  <Textarea
                    name={`field_${field.id}`}
                    placeholder={field.placeholder ?? undefined}
                    required={field.required}
                    rows={3}
                  />
                ) : field.fieldType === "DROPDOWN" || field.fieldType === "RADIO" ? (
                  <select
                    name={`field_${field.id}`}
                    required={field.required}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select…</option>
                    {(Array.isArray(field.options) ? field.options : []).map((opt) => (
                      <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
                    ))}
                  </select>
                ) : field.fieldType === "CHECKBOX" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={`field_${field.id}`} required={field.required} />
                    {field.placeholder ?? field.label}
                  </label>
                ) : field.fieldType === "DATE" ? (
                  <Input type="date" name={`field_${field.id}`} required={field.required} />
                ) : field.fieldType === "IMAGE_UPLOAD" || field.fieldType === "FILE_UPLOAD" ? (
                  <Input type="file" name={`field_${field.id}`} multiple accept=".png,.jpg,.jpeg,.webp,.zip,.pdf" />
                ) : (
                  <Input name={`field_${field.id}`} placeholder={field.placeholder ?? undefined} required={field.required} />
                )}
                {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
              </div>
            ))}

            <Input name="discord" placeholder="Discord username (optional)" />

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="rounded-lg border border-dashed border-neon-purple/40 p-4 text-center text-sm text-muted-foreground"
            >
              <p>Drag & drop reference files (PNG, JPG, WEBP, ZIP, PDF)</p>
              <Input
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp,.zip,.pdf"
                className="mt-2"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
              />
              {files.length > 0 && (
                <ul className="mt-2 text-left text-xs space-y-1">
                  {files.map((f) => (
                    <li key={f.name}>{f.name} ({Math.round(f.size / 1024)} KB)</li>
                  ))}
                </ul>
              )}
            </div>

            <Button type="submit" variant="neon" className="w-full" disabled={pending}>
              {product.pricingMode === "QUOTE" ? "Request quote" : "Order now"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function ShopCatalog({
  products,
  locale,
}: {
  products: {
    id: string;
    slug: string;
    name: string;
    shortDescription: string | null;
    pricingMode: ShopPricingMode;
    priceCents: number;
    isFeatured: boolean;
    thumbnailUrl: string | null;
    coverImageUrl: string | null;
    customType: { name: string } | null;
  }[];
  locale: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => {
        const image = p.coverImageUrl ?? p.thumbnailUrl;
        return (
          <Link key={p.id} href={`/${locale}/shop/${p.slug}`}>
            <Card className="glass overflow-hidden h-full hover:border-neon-purple/40 transition-all hover:-translate-y-0.5">
              <div className="relative aspect-[16/10] bg-gradient-to-br from-neon-purple/20 to-neon-blue/10">
                {image ? (
                  <SafeImage src={image} alt="" fill className="object-cover" sizes="400px" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                    {p.customType?.name ?? "Custom service"}
                  </div>
                )}
                {p.isFeatured && <Badge className="absolute top-3 right-3" variant="premium">Featured</Badge>}
              </div>
              <div className="p-5 space-y-2">
                <h3 className="font-semibold text-lg">{p.name}</h3>
                {p.shortDescription && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.shortDescription}</p>
                )}
                <p className="font-bold text-gradient">
                  {formatShopPrice(p.priceCents, p.pricingMode, locale)}
                </p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
