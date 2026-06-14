"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { SafeImage } from "@/components/ui/safe-image";
import { Logo } from "@/components/brand/logo";
import {
  saveAdminBranding,
  saveAdminHeaderSettings,
  saveAdminFooterSettings,
  saveAdminSeoSettings,
  saveAdminPageContent,
  removeBrandingAsset,
} from "@/actions/admin/branding";
import { uploadViaApi } from "@/lib/upload-client";
import { formatUploadErrorMessage } from "@/lib/upload-errors";
import {
  ICON_LIBRARY,
  PAGE_CONTENT_FIELDS,
  SUPPORTED_LOCALES,
  type BrandingAssetSettings,
  type HeaderSettings,
  type FooterSettings,
  type SeoSettings,
  type PageContentStore,
  type PageId,
} from "@/lib/branding-cms";
import { localeLabels, type Locale } from "@/i18n/config";

type Tab = "identity" | "assets" | "header" | "footer" | "content" | "seo" | "preview";

type Props = {
  initial: {
    branding: BrandingAssetSettings;
    header: HeaderSettings;
    footer: FooterSettings;
    seo: SeoSettings;
    pageContent: PageContentStore;
  };
};

const TABS: { id: Tab; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "assets", label: "Logo & Icons" },
  { id: "header", label: "Header" },
  { id: "footer", label: "Footer" },
  { id: "content", label: "Content" },
  { id: "seo", label: "SEO" },
  { id: "preview", label: "Preview" },
];

export function BrandingCenterPanel({ initial }: Props) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("identity");
  const [branding, setBranding] = useState(initial.branding);
  const [header, setHeader] = useState(initial.header);
  const [footer, setFooter] = useState(initial.footer);
  const [seo, setSeo] = useState(initial.seo);
  const [pageContent, setPageContent] = useState(initial.pageContent);
  const [contentPage, setContentPage] = useState<PageId>("homepage");
  const [contentLocale, setContentLocale] = useState<Locale>("en");
  const [seoLocale, setSeoLocale] = useState<Locale | "global">("global");

  const previewBundle = useMemo(
    () => ({ branding, header, footer }),
    [branding, header, footer]
  );

  function upload(type: string, file: File) {
    startTransition(async () => {
      try {
        const result = await uploadViaApi({
          file,
          purpose: "branding-asset",
          brandingAssetType: type,
        });
        const fieldMap: Partial<Record<string, keyof BrandingAssetSettings>> = {
          logo: "logoUrl",
          "logo-dark": "logoDarkUrl",
          favicon: "faviconUrl",
          loading: "loadingLogoUrl",
          mobile: "mobileIconUrl",
          symbol: "siteSymbolUrl",
        };
        const field = fieldMap[type];
        if (field) {
          setBranding((b) => ({
            ...b,
            [field]: result.url,
            ...(type === "favicon"
              ? {
                  appleTouchIconUrl: result.url,
                  androidIconUrl: result.url,
                  pwaIconUrl: result.url,
                }
              : {}),
          }));
        }
        appToast.uploaded();
        router.refresh();
      } catch (err) {
        appToast.error(formatUploadErrorMessage(err));
      }
    });
  }

  function removeAsset(field: keyof BrandingAssetSettings) {
    startTransition(async () => {
      const r = await removeBrandingAsset(field);
      if (r.success) {
        setBranding((b) => ({
          ...b,
          [field]: null,
          ...(field === "faviconUrl"
            ? { appleTouchIconUrl: null, androidIconUrl: null, pwaIconUrl: null }
            : {}),
        }));
        appToast.saved();
      } else appToast.error(r.error);
    });
  }

  function setPageField(field: string, value: string) {
    setPageContent((prev) => ({
      ...prev,
      [contentPage]: {
        ...prev[contentPage],
        [contentLocale]: {
          ...(prev[contentPage]?.[contentLocale] ?? {}),
          [field]: value,
        },
      },
    }));
  }

  const seoFields = seoLocale === "global" ? seo.global : { ...seo.global, ...seo.locales[seoLocale] };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "neon" : "outline"} onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "identity" && (
        <Card className="glass p-6 space-y-4 max-w-2xl">
          <h3 className="font-semibold">Site identity</h3>
          <label className="text-sm">Website name</label>
          <Input value={branding.siteTitle} onChange={(e) => setBranding((b) => ({ ...b, siteTitle: e.target.value }))} />
          <label className="text-sm">Short name</label>
          <Input value={branding.siteShortName} onChange={(e) => setBranding((b) => ({ ...b, siteShortName: e.target.value }))} />
          <label className="text-sm">Browser / SEO title</label>
          <Input value={branding.browserTitle} onChange={(e) => setBranding((b) => ({ ...b, browserTitle: e.target.value }))} />
          <label className="text-sm">Tagline</label>
          <Input value={branding.siteTagline} onChange={(e) => setBranding((b) => ({ ...b, siteTagline: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Primary color</label>
              <Input type="color" value={branding.primaryColor} onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm">Accent color</label>
              <Input type="color" value={branding.accentColor} onChange={(e) => setBranding((b) => ({ ...b, accentColor: e.target.value }))} />
            </div>
          </div>
          <Button
            variant="neon"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await saveAdminBranding(branding);
                if (r.success) appToast.saved();
                else appToast.error(r.error);
              })
            }
          >
            Save identity
          </Button>
        </Card>
      )}

      {tab === "assets" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass p-6 space-y-4">
            <h3 className="font-semibold">Logo manager</h3>
            <AssetRow label="Main logo" url={branding.logoUrl} onUpload={(f) => upload("logo", f)} onRemove={() => removeAsset("logoUrl")} />
            <AssetRow label="Dark logo" url={branding.logoDarkUrl} onUpload={(f) => upload("logo-dark", f)} onRemove={() => removeAsset("logoDarkUrl")} />
            <label className="text-sm">Logo crop / focus</label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
              value={branding.logoObjectPosition}
              onChange={(e) => setBranding((b) => ({ ...b, logoObjectPosition: e.target.value }))}
            >
              {["center", "top", "bottom", "left", "right"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">PNG, SVG, WEBP supported. Images are served optimized via CDN.</p>
          </Card>

          <Card className="glass p-6 space-y-4">
            <h3 className="font-semibold">Favicon & PWA icons</h3>
            <AssetRow label="Favicon" url={branding.faviconUrl} onUpload={(f) => upload("favicon", f)} onRemove={() => removeAsset("faviconUrl")} />
            <p className="text-xs text-muted-foreground">
              Uploading a favicon auto-generates Apple Touch, Android, and PWA icon references.
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <IconPreview label="Apple" url={branding.appleTouchIconUrl} />
              <IconPreview label="Android" url={branding.androidIconUrl} />
              <IconPreview label="PWA" url={branding.pwaIconUrl} />
            </div>
          </Card>

          <Card className="glass p-6 space-y-4 lg:col-span-2">
            <h3 className="font-semibold">Site symbol (replaces default X icon)</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <Logo branding={branding} />
              <Badge variant="outline">Live preview</Badge>
            </div>
            <label className="text-sm">Symbol mode</label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
              value={branding.siteSymbolMode}
              onChange={(e) => setBranding((b) => ({ ...b, siteSymbolMode: e.target.value as BrandingAssetSettings["siteSymbolMode"] }))}
            >
              <option value="letter">Letter</option>
              <option value="library">Icon library</option>
              <option value="image">Custom image</option>
            </select>
            {branding.siteSymbolMode === "letter" && (
              <>
                <Input maxLength={2} value={branding.siteSymbolLetter} onChange={(e) => setBranding((b) => ({ ...b, siteSymbolLetter: e.target.value }))} />
                <Input type="color" value={branding.siteSymbolColor} onChange={(e) => setBranding((b) => ({ ...b, siteSymbolColor: e.target.value }))} />
              </>
            )}
            {branding.siteSymbolMode === "library" && (
              <>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
                  value={branding.siteSymbolLibrary ?? "sparkles"}
                  onChange={(e) => setBranding((b) => ({ ...b, siteSymbolLibrary: e.target.value }))}
                >
                  {ICON_LIBRARY.map((icon) => (
                    <option key={icon.id} value={icon.id}>{icon.label}</option>
                  ))}
                </select>
                <Input type="color" value={branding.siteSymbolColor} onChange={(e) => setBranding((b) => ({ ...b, siteSymbolColor: e.target.value }))} />
              </>
            )}
            {branding.siteSymbolMode === "image" && (
              <AssetRow label="Symbol image" url={branding.siteSymbolUrl} onUpload={(f) => upload("symbol", f)} onRemove={() => removeAsset("siteSymbolUrl")} />
            )}
            <Button
              variant="neon"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await saveAdminBranding(branding);
                  if (r.success) appToast.saved();
                  else appToast.error(r.error);
                })
              }
            >
              Save symbols
            </Button>
          </Card>
        </div>
      )}

      {tab === "header" && (
        <Card className="glass p-6 space-y-4 max-w-3xl">
          <h3 className="font-semibold">Header builder</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={header.sticky} onChange={(e) => setHeader((h) => ({ ...h, sticky: e.target.checked }))} />
              Sticky header
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={header.blur} onChange={(e) => setHeader((h) => ({ ...h, blur: e.target.checked }))} />
              Blur effect
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={header.transparent} onChange={(e) => setHeader((h) => ({ ...h, transparent: e.target.checked }))} />
              Transparent background
            </label>
            <div>
              <label className="text-sm">Height (px)</label>
              <Input type="number" value={header.height} onChange={(e) => setHeader((h) => ({ ...h, height: Number(e.target.value) }))} />
            </div>
          </div>
          <Input placeholder="Background color (optional hex)" value={header.backgroundColor} onChange={(e) => setHeader((h) => ({ ...h, backgroundColor: e.target.value }))} />
          <div className="space-y-2">
            <p className="text-sm font-medium">Menu items</p>
            {header.menuItems.map((item, idx) => (
              <div key={item.id} className="grid sm:grid-cols-4 gap-2 items-center border border-border/30 rounded-md p-2">
                <Input value={item.label} onChange={(e) => {
                  const items = [...header.menuItems];
                  items[idx] = { ...item, label: e.target.value };
                  setHeader((h) => ({ ...h, menuItems: items }));
                }} />
                <Input value={item.href} onChange={(e) => {
                  const items = [...header.menuItems];
                  items[idx] = { ...item, href: e.target.value };
                  setHeader((h) => ({ ...h, menuItems: items }));
                }} />
                <Input type="number" value={item.order} onChange={(e) => {
                  const items = [...header.menuItems];
                  items[idx] = { ...item, order: Number(e.target.value) };
                  setHeader((h) => ({ ...h, menuItems: items }));
                }} />
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={item.hidden} onChange={(e) => {
                    const items = [...header.menuItems];
                    items[idx] = { ...item, hidden: e.target.checked };
                    setHeader((h) => ({ ...h, menuItems: items }));
                  }} />
                  Hidden
                </label>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setHeader((h) => ({
                  ...h,
                  menuItems: [
                    ...h.menuItems,
                    { id: `custom-${Date.now()}`, label: "New link", href: "/", hidden: false, order: h.menuItems.length },
                  ],
                }))
              }
            >
              Add menu item
            </Button>
          </div>
          <Button
            variant="neon"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await saveAdminHeaderSettings(header);
                if (r.success) appToast.saved();
                else appToast.error(r.error);
              })
            }
          >
            Save header
          </Button>
        </Card>
      )}

      {tab === "footer" && (
        <Card className="glass p-6 space-y-4 max-w-3xl">
          <h3 className="font-semibold">Footer builder</h3>
          <Textarea value={footer.tagline} onChange={(e) => setFooter((f) => ({ ...f, tagline: e.target.value }))} placeholder="Tagline" rows={2} />
          <Input value={footer.copyright} onChange={(e) => setFooter((f) => ({ ...f, copyright: e.target.value }))} placeholder="Copyright suffix" />
          <div className="grid sm:grid-cols-2 gap-3">
            <Input placeholder="Discord URL" value={footer.socialLinks.discord ?? ""} onChange={(e) => setFooter((f) => ({ ...f, socialLinks: { ...f.socialLinks, discord: e.target.value } }))} />
            <Input placeholder="Twitter / X URL" value={footer.socialLinks.twitter ?? ""} onChange={(e) => setFooter((f) => ({ ...f, socialLinks: { ...f.socialLinks, twitter: e.target.value } }))} />
          </div>
          {footer.sections.map((section, sIdx) => (
            <div key={section.id} className="border border-border/30 rounded-lg p-3 space-y-2">
              <Input value={section.title} onChange={(e) => {
                const sections = [...footer.sections];
                sections[sIdx] = { ...section, title: e.target.value };
                setFooter((f) => ({ ...f, sections }));
              }} />
              {section.links.map((link, lIdx) => (
                <div key={link.id} className="grid sm:grid-cols-3 gap-2">
                  <Input value={link.label} onChange={(e) => {
                    const sections = [...footer.sections];
                    const links = [...section.links];
                    links[lIdx] = { ...link, label: e.target.value };
                    sections[sIdx] = { ...section, links };
                    setFooter((f) => ({ ...f, sections }));
                  }} />
                  <Input value={link.href} onChange={(e) => {
                    const sections = [...footer.sections];
                    const links = [...section.links];
                    links[lIdx] = { ...link, href: e.target.value };
                    sections[sIdx] = { ...section, links };
                    setFooter((f) => ({ ...f, sections }));
                  }} />
                  <Input type="number" value={link.order} onChange={(e) => {
                    const sections = [...footer.sections];
                    const links = [...section.links];
                    links[lIdx] = { ...link, order: Number(e.target.value) };
                    sections[sIdx] = { ...section, links };
                    setFooter((f) => ({ ...f, sections }));
                  }} />
                </div>
              ))}
            </div>
          ))}
          <Button
            variant="neon"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await saveAdminFooterSettings(footer);
                if (r.success) appToast.saved();
                else appToast.error(r.error);
              })
            }
          >
            Save footer
          </Button>
        </Card>
      )}

      {tab === "content" && (
        <Card className="glass p-6 space-y-4">
          <h3 className="font-semibold">Multilingual content</h3>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PAGE_CONTENT_FIELDS) as PageId[]).map((page) => (
              <Button key={page} size="sm" variant={contentPage === page ? "neon" : "outline"} onClick={() => setContentPage(page)}>
                {page}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_LOCALES.map((loc) => (
              <Button key={loc} size="sm" variant={contentLocale === loc ? "neon" : "outline"} onClick={() => setContentLocale(loc)}>
                {localeLabels[loc]}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 max-w-2xl">
            {PAGE_CONTENT_FIELDS[contentPage].map((field) => (
              <div key={field}>
                <label className="text-xs text-muted-foreground">{field}</label>
                <Textarea
                  rows={field.includes("Title") || field.includes("Badge") ? 1 : 2}
                  value={pageContent[contentPage]?.[contentLocale]?.[field] ?? ""}
                  onChange={(e) => setPageField(field, e.target.value)}
                  placeholder={`Override ${field} (${contentLocale})`}
                />
              </div>
            ))}
          </div>
          <Button
            variant="neon"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await saveAdminPageContent(pageContent);
                if (r.success) appToast.saved();
                else appToast.error(r.error);
              })
            }
          >
            Save page content
          </Button>
        </Card>
      )}

      {tab === "seo" && (
        <Card className="glass p-6 space-y-4 max-w-2xl">
          <h3 className="font-semibold">SEO manager</h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={seoLocale === "global" ? "neon" : "outline"} onClick={() => setSeoLocale("global")}>Global</Button>
            {SUPPORTED_LOCALES.map((loc) => (
              <Button key={loc} size="sm" variant={seoLocale === loc ? "neon" : "outline"} onClick={() => setSeoLocale(loc)}>
                {localeLabels[loc]}
              </Button>
            ))}
          </div>
          {(["metaTitle", "metaDescription", "ogTitle", "ogDescription"] as const).map((field) => (
            <div key={field}>
              <label className="text-xs text-muted-foreground">{field}</label>
              {field.includes("Description") ? (
                <Textarea
                  rows={2}
                  value={seoFields[field] ?? ""}
                  onChange={(e) => {
                    if (seoLocale === "global") {
                      setSeo((s) => ({ ...s, global: { ...s.global, [field]: e.target.value } }));
                    } else {
                      setSeo((s) => ({
                        ...s,
                        locales: {
                          ...s.locales,
                          [seoLocale]: { ...s.locales[seoLocale], [field]: e.target.value },
                        },
                      }));
                    }
                  }}
                />
              ) : (
                <Input
                  value={seoFields[field] ?? ""}
                  onChange={(e) => {
                    if (seoLocale === "global") {
                      setSeo((s) => ({ ...s, global: { ...s.global, [field]: e.target.value } }));
                    } else {
                      setSeo((s) => ({
                        ...s,
                        locales: {
                          ...s.locales,
                          [seoLocale]: { ...s.locales[seoLocale], [field]: e.target.value },
                        },
                      }));
                    }
                  }}
                />
              )}
            </div>
          ))}
          <label className="text-sm">Twitter card</label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm"
            value={seoFields.twitterCard}
            onChange={(e) => {
              const val = e.target.value as "summary" | "summary_large_image";
              if (seoLocale === "global") {
                setSeo((s) => ({ ...s, global: { ...s.global, twitterCard: val } }));
              } else {
                setSeo((s) => ({
                  ...s,
                  locales: { ...s.locales, [seoLocale]: { ...s.locales[seoLocale], twitterCard: val } },
                }));
              }
            }}
          >
            <option value="summary">Summary</option>
            <option value="summary_large_image">Summary large image</option>
          </select>
          <AssetRow
            label="OpenGraph image"
            url={seoFields.ogImageUrl}
            onUpload={async (f) => {
              try {
                const result = await uploadViaApi({
                  file: f,
                  purpose: "branding-asset",
                  brandingAssetType: "og",
                });
                const url = result.url;
                if (seoLocale === "global") {
                  setSeo((s) => ({ ...s, global: { ...s.global, ogImageUrl: url } }));
                } else {
                  setSeo((s) => ({
                    ...s,
                    locales: { ...s.locales, [seoLocale]: { ...s.locales[seoLocale], ogImageUrl: url } },
                  }));
                }
              } catch (err) {
                appToast.error(formatUploadErrorMessage(err));
              }
            }}
            onRemove={() => {
              if (seoLocale === "global") {
                setSeo((s) => ({ ...s, global: { ...s.global, ogImageUrl: null } }));
              } else {
                setSeo((s) => ({
                  ...s,
                  locales: { ...s.locales, [seoLocale]: { ...s.locales[seoLocale], ogImageUrl: null } },
                }));
              }
            }}
          />
          <Button
            variant="neon"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await saveAdminSeoSettings(seo);
                if (r.success) appToast.saved();
                else appToast.error(r.error);
              })
            }
          >
            Save SEO
          </Button>
        </Card>
      )}

      {tab === "preview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass p-6 space-y-4">
            <h3 className="font-semibold">Header preview</h3>
            <div className="rounded-lg border border-border/40 overflow-hidden">
              <div
                className={`flex items-center justify-between px-4 ${previewBundle.header.blur ? "backdrop-blur-xl bg-background/80" : "bg-background"}`}
                style={{ height: previewBundle.header.height }}
              >
                <Logo size="sm" branding={previewBundle.branding} />
                <span className="text-xs text-muted-foreground">Nav items · Auth</span>
              </div>
            </div>
          </Card>
          <Card className="glass p-6 space-y-4">
            <h3 className="font-semibold">Footer preview</h3>
            <div className="rounded-lg border border-border/40 p-4 text-sm space-y-2">
              <Logo branding={previewBundle.branding} />
              <p className="text-muted-foreground">{previewBundle.footer.tagline}</p>
              <p className="text-xs text-muted-foreground">© {previewBundle.branding.siteTitle}. {previewBundle.footer.copyright}</p>
            </div>
          </Card>
          <Card className="glass p-6 space-y-2 lg:col-span-2">
            <h3 className="font-semibold">Homepage hero preview</h3>
            <p className="text-xs text-neon-purple">{pageContent.homepage?.[contentLocale]?.heroBadge ?? "Badge"}</p>
            <h4 className="text-2xl font-bold">{pageContent.homepage?.[contentLocale]?.heroTitle ?? previewBundle.branding.siteTitle}</h4>
            <p className="text-muted-foreground">{pageContent.homepage?.[contentLocale]?.heroSubtitle ?? previewBundle.branding.siteTagline}</p>
          </Card>
        </div>
      )}
    </div>
  );
}

function AssetRow({
  label,
  url,
  onUpload,
  onRemove,
}: {
  label: string;
  url: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-border/40 bg-muted/20">
        <SafeImage src={url} alt="" fill className="object-contain" sizes="48px" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <Input type="file" accept="image/*,.svg" className="text-xs" onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }} />
        {url && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function IconPreview({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="text-center">
      <div className="relative mx-auto h-10 w-10 rounded border border-border/40 overflow-hidden">
        <SafeImage src={url} alt="" fill className="object-contain" sizes="40px" />
      </div>
      <p className="mt-1">{label}</p>
    </div>
  );
}
