"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveShopProduct,
  createShopCategory,
  createShopProduct,
  createShopProductType,
  deleteShopCategory,
  deleteShopProduct,
  deleteShopProductType,
  duplicateShopProduct,
  updateShopProduct,
  updateShopProductType,
} from "@/actions/admin/shop";
import { useAppToast } from "@/hooks/use-app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatShopPrice, FORM_FIELD_LABELS, PRICING_MODE_LABELS } from "@/lib/shop-enterprise";
import { formatEuro } from "@/lib/format-locale";
import type { ShopFormFieldType, ShopPricingMode } from "@prisma/client";

type Product = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  pricingMode: ShopPricingMode;
  priceCents: number;
  status: string;
  isFeatured: boolean;
  isActive: boolean;
  isArchived: boolean;
  sortOrder: number;
  thumbnailUrl: string | null;
  coverImageUrl: string | null;
  bannerImageUrl: string | null;
  featuredImageUrl: string | null;
  videoUrl: string | null;
  customType: { id: string; name: string; slug: string } | null;
  shopCategory: { id: string; name: string; slug: string } | null;
  formFields: {
    id: string;
    fieldType: ShopFormFieldType;
    label: string;
    placeholder: string | null;
    required: boolean;
    options: unknown;
    sortOrder: number;
  }[];
  media: { id: string; mediaType: string; url: string; alt: string | null; sortOrder: number }[];
  _count?: { purchases: number; orders: number };
};

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  parent: { id: string; name: string } | null;
  _count?: { products: number; children: number };
};

type ProductType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconKey: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { products: number };
};

type Analytics = {
  revenueTodayCents: number;
  revenueMonthCents: number;
  ordersToday: number;
  pendingOrders: number;
  activeDesigners: number;
  completionRate: number;
  avgDeliveryHours: number;
};

const EMPTY_FORM_FIELD = {
  fieldType: "TEXT" as ShopFormFieldType,
  label: "",
  placeholder: "",
  required: false,
  options: [] as string[],
  sortOrder: 0,
};

export function EnterpriseShopAdmin({
  products,
  categories,
  productTypes,
  analytics,
  locale,
}: {
  products: Product[];
  categories: Category[];
  productTypes: ProductType[];
  analytics: Analytics | null;
  locale: string;
}) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Product | null>(null);
  const [formFields, setFormFields] = useState([{ ...EMPTY_FORM_FIELD }]);
  const [galleryUrl, setGalleryUrl] = useState("");

  const parentCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);

  function resetEditor() {
    setEditing(null);
    setFormFields([{ ...EMPTY_FORM_FIELD }]);
    setGalleryUrl("");
  }

  function loadProduct(p: Product) {
    setEditing(p);
    setFormFields(
      p.formFields.length
        ? p.formFields.map((f) => ({
            fieldType: f.fieldType,
            label: f.label,
            placeholder: f.placeholder ?? "",
            required: f.required,
            options: Array.isArray(f.options) ? (f.options as string[]) : [],
            sortOrder: f.sortOrder,
          }))
        : [{ ...EMPTY_FORM_FIELD }]
    );
  }

  async function saveProduct(form: HTMLFormElement) {
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get("name") ?? ""),
      slug: String(fd.get("slug") ?? ""),
      shortDescription: String(fd.get("shortDescription") ?? "") || null,
      description: String(fd.get("description") ?? "") || null,
      category: "CUSTOM_SERVICES" as const,
      productType: "CUSTOM" as const,
      creditPrice: 0,
      stripePriceId: null,
      customTypeId: String(fd.get("customTypeId") ?? "") || null,
      shopCategoryId: String(fd.get("shopCategoryId") ?? "") || null,
      subcategoryId: String(fd.get("subcategoryId") ?? "") || null,
      pricingMode: String(fd.get("pricingMode") ?? "FIXED") as ShopPricingMode,
      priceCents: Math.round(Number(fd.get("priceCents") ?? 0) * 100),
      status: String(fd.get("status") ?? "ACTIVE") as "DRAFT" | "ACTIVE" | "ARCHIVED" | "DISABLED",
      isFeatured: fd.get("isFeatured") === "on",
      isActive: fd.get("isActive") !== "off",
      thumbnailUrl: String(fd.get("thumbnailUrl") ?? "") || null,
      coverImageUrl: String(fd.get("coverImageUrl") ?? "") || null,
      bannerImageUrl: String(fd.get("bannerImageUrl") ?? "") || null,
      featuredImageUrl: String(fd.get("featuredImageUrl") ?? "") || null,
      videoUrl: String(fd.get("videoUrl") ?? "") || null,
      visibility: String(fd.get("visibility") ?? "public"),
      formFields: formFields
        .filter((f) => f.label.trim())
        .map((f, i) => ({
          fieldType: f.fieldType,
          label: f.label.trim(),
          placeholder: f.placeholder || null,
          required: f.required,
          options: f.options.length ? f.options : null,
          sortOrder: i,
        })),
      media: (galleryUrl.trim()
        ? [
            ...(editing?.media.map((m) => ({
              mediaType: m.mediaType as "GALLERY" | "COVER" | "BANNER" | "FEATURED" | "EXAMPLE" | "VIDEO",
              url: m.url,
              alt: m.alt,
              sortOrder: m.sortOrder,
            })) ?? []),
            { mediaType: "GALLERY" as const, url: galleryUrl.trim(), sortOrder: editing?.media.length ?? 0 },
          ]
        : editing?.media.map((m) => ({
            mediaType: m.mediaType as "GALLERY" | "COVER" | "BANNER" | "FEATURED" | "EXAMPLE" | "VIDEO",
            url: m.url,
            alt: m.alt,
            sortOrder: m.sortOrder,
          }))) ?? [],
    };

    startTransition(async () => {
      const r = editing
        ? await updateShopProduct(editing.id, payload)
        : await createShopProduct(payload);
      if (r.success) {
        appToast.saved();
        resetEditor();
        router.refresh();
      } else appToast.error(r.error);
    });
  }

  return (
    <Tabs defaultValue="products" className="space-y-6">
      <TabsList className="glass flex-wrap h-auto gap-1">
        <TabsTrigger value="products">Products</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
        <TabsTrigger value="types">Product types</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="analytics" className="space-y-4">
        {analytics ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Revenue today", value: formatEuro(analytics.revenueTodayCents, locale) },
              { label: "Revenue this month", value: formatEuro(analytics.revenueMonthCents, locale) },
              { label: "Orders today", value: analytics.ordersToday },
              { label: "Pending orders", value: analytics.pendingOrders },
              { label: "Active designers", value: analytics.activeDesigners },
              { label: "Completion rate", value: `${analytics.completionRate}%` },
              { label: "Avg delivery", value: `${analytics.avgDeliveryHours}h` },
            ].map((w) => (
              <Card key={w.label} className="glass p-4">
                <p className="text-xs text-muted-foreground">{w.label}</p>
                <p className="text-2xl font-bold mt-1">{w.value}</p>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="glass p-6 text-muted-foreground">Analytics unavailable</Card>
        )}
      </TabsContent>

      <TabsContent value="types" className="space-y-4">
        <Card className="glass p-6 space-y-3">
          <h3 className="font-semibold">Create product type</h3>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await createShopProductType({
                  name: String(fd.get("name") ?? ""),
                  slug: String(fd.get("slug") ?? ""),
                  description: String(fd.get("description") ?? "") || null,
                });
                if (r.success) {
                  appToast.saved();
                  e.currentTarget.reset();
                  router.refresh();
                } else appToast.error(r.error);
              });
            }}
          >
            <Input name="name" placeholder="Type name" required />
            <Input name="slug" placeholder="slug" />
            <Textarea name="description" placeholder="Description" className="sm:col-span-2" rows={2} />
            <Button type="submit" variant="neon" disabled={pending}>Create type</Button>
          </form>
        </Card>
        <div className="space-y-2">
          {productTypes.map((t) => (
            <Card key={t.id} className="glass p-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.slug} · {t._count?.products ?? 0} products</p>
              </div>
              <div className="flex gap-2">
                <Badge variant={t.isActive ? "default" : "outline"}>{t.isActive ? "Active" : "Disabled"}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await updateShopProductType(t.id, { isActive: !t.isActive });
                      if (r.success) router.refresh();
                      else appToast.error(r.error);
                    })
                  }
                >
                  Toggle
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending || (t._count?.products ?? 0) > 0}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await deleteShopProductType(t.id);
                      if (r.success) router.refresh();
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
      </TabsContent>

      <TabsContent value="categories" className="space-y-4">
        <Card className="glass p-6 space-y-3">
          <h3 className="font-semibold">Create category</h3>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const r = await createShopCategory({
                  name: String(fd.get("name") ?? ""),
                  slug: String(fd.get("slug") ?? ""),
                  description: String(fd.get("description") ?? "") || null,
                  parentId: String(fd.get("parentId") ?? "") || null,
                });
                if (r.success) {
                  appToast.saved();
                  e.currentTarget.reset();
                  router.refresh();
                } else appToast.error(r.error);
              });
            }}
          >
            <Input name="name" placeholder="Category name" required />
            <Input name="slug" placeholder="slug" />
            <select name="parentId" className="rounded-md border border-border bg-background px-3 py-2 text-sm sm:col-span-2">
              <option value="">Top-level category</option>
              {parentCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Textarea name="description" placeholder="Description" className="sm:col-span-2" rows={2} />
            <Button type="submit" variant="neon" disabled={pending}>Create category</Button>
          </form>
        </Card>
        <div className="space-y-2">
          {categories.map((c) => (
            <Card key={c.id} className="glass p-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{c.parent ? `${c.parent.name} / ` : ""}{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.slug} · {c._count?.products ?? 0} products</p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                disabled={pending || (c._count?.products ?? 0) > 0}
                onClick={() =>
                  startTransition(async () => {
                    const r = await deleteShopCategory(c.id);
                    if (r.success) router.refresh();
                    else appToast.error(r.error);
                  })
                }
              >
                Delete
              </Button>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="products" className="space-y-6">
        <Card className="glass p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{editing ? "Edit product" : "Create product"}</h3>
            {editing && (
              <Button type="button" variant="ghost" size="sm" onClick={resetEditor}>Cancel edit</Button>
            )}
          </div>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveProduct(e.currentTarget);
            }}
          >
            <Input name="name" placeholder="Title" defaultValue={editing?.name} required />
            <Input name="slug" placeholder="slug" defaultValue={editing?.slug} />
            <Textarea name="shortDescription" placeholder="Short description" className="sm:col-span-2" rows={2} defaultValue={editing?.shortDescription ?? ""} />
            <Textarea name="description" placeholder="Full description" className="sm:col-span-2" rows={4} defaultValue={editing?.description ?? ""} />
            <select name="customTypeId" defaultValue={editing?.customType?.id ?? ""} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Product type</option>
              {productTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select name="shopCategoryId" defaultValue={editing?.shopCategory?.id ?? ""} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Category</option>
              {parentCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select name="subcategoryId" defaultValue="" className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Subcategory</option>
              {categories.filter((c) => c.parentId).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select name="pricingMode" defaultValue={editing?.pricingMode ?? "STARTING_FROM"} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              {Object.entries(PRICING_MODE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <Input name="priceCents" type="number" step="0.01" min="0" placeholder="Price (EUR)" defaultValue={editing ? editing.priceCents / 100 : ""} />
            <select name="status" defaultValue={editing?.status ?? "ACTIVE"} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <select name="visibility" defaultValue="public" className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="public">Public</option>
              <option value="staff">Staff only</option>
              <option value="hidden">Hidden</option>
            </select>
            <Input name="thumbnailUrl" placeholder="Thumbnail URL" defaultValue={editing?.thumbnailUrl ?? ""} />
            <Input name="coverImageUrl" placeholder="Cover image URL" defaultValue={editing?.coverImageUrl ?? ""} />
            <Input name="bannerImageUrl" placeholder="Banner image URL" defaultValue={editing?.bannerImageUrl ?? ""} />
            <Input name="featuredImageUrl" placeholder="Featured image URL" defaultValue={editing?.featuredImageUrl ?? ""} />
            <Input name="videoUrl" placeholder="Video URL" className="sm:col-span-2" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isFeatured" defaultChecked={editing?.isFeatured} /> Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} /> Enabled
            </label>

            <div className="sm:col-span-2 space-y-3 border-t border-border/40 pt-4">
              <h4 className="font-medium">Order form builder</h4>
              {formFields.map((field, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-4 p-3 rounded-lg border border-border/30">
                  <select
                    value={field.fieldType}
                    onChange={(e) => {
                      const next = [...formFields];
                      next[idx] = { ...next[idx], fieldType: e.target.value as ShopFormFieldType };
                      setFormFields(next);
                    }}
                    className="rounded-md border border-border bg-background px-2 py-2 text-sm"
                  >
                    {Object.entries(FORM_FIELD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Label"
                    value={field.label}
                    onChange={(e) => {
                      const next = [...formFields];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setFormFields(next);
                    }}
                  />
                  <Input
                    placeholder="Placeholder"
                    value={field.placeholder}
                    onChange={(e) => {
                      const next = [...formFields];
                      next[idx] = { ...next[idx], placeholder: e.target.value };
                      setFormFields(next);
                    }}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => {
                        const next = [...formFields];
                        next[idx] = { ...next[idx], required: e.target.checked };
                        setFormFields(next);
                      }}
                    />
                    Required
                  </label>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setFormFields([...formFields, { ...EMPTY_FORM_FIELD }])}>
                Add field
              </Button>
            </div>

            <div className="sm:col-span-2 flex gap-2">
              <Input placeholder="Add gallery image URL" value={galleryUrl} onChange={(e) => setGalleryUrl(e.target.value)} />
            </div>

            <Button type="submit" variant="neon" disabled={pending} className="sm:col-span-2">
              {editing ? "Save product" : "Create product"}
            </Button>
          </form>
        </Card>

        <div className="space-y-2">
          {products.map((p) => (
            <Card key={p.id} className="glass p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{p.name}</p>
                    {p.isFeatured && <Badge variant="premium">Featured</Badge>}
                    <Badge variant="outline">{p.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {p.customType?.name ?? "Custom"} · {formatShopPrice(p.priceCents, p.pricingMode, locale)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p._count?.orders ?? 0} orders · {p._count?.purchases ?? 0} purchases · {p.formFields.length} form fields
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadProduct(p)}>Edit</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await duplicateShopProduct(p.id);
                        if (r.success) {
                          appToast.saved();
                          router.refresh();
                        } else appToast.error(r.error);
                      })
                    }
                  >
                    Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await archiveShopProduct(p.id, !p.isArchived);
                        if (r.success) router.refresh();
                        else appToast.error(r.error);
                      })
                    }
                  >
                    {p.isArchived ? "Restore" : "Archive"}
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
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
