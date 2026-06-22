import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OrderRequirementsForm } from "@/components/orders/order-requirements-form";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function OrderRequirementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { locale, id } = await params;
  const { paid } = await searchParams;

  setRequestLocale(locale);
  const user = await requireAuth(`/${locale}/dashboard/orders/${id}/requirements`);

  const order = await prisma.customOrder.findUnique({
    where: { id, clientId: user.id },
    include: { shopProduct: { select: { name: true } } },
  });

  if (!order) notFound();

  if (order.requirementsSubmittedAt) {
    redirect(`/${locale}/dashboard/orders/${id}`);
  }

  if (order.shopProductId && order.paymentStatus !== "PAID") {
    redirect(`/${locale}/dashboard/orders/${id}`);
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link
        href={`/${locale}/dashboard/orders/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to order
      </Link>
      {paid === "1" && (
        <p className="mt-4 text-sm text-neon-purple">Payment successful — complete your project details below.</p>
      )}
      <div className="mt-6">
        <OrderRequirementsForm
          orderId={id}
          locale={locale}
          productName={order.shopProduct?.name ?? order.title}
        />
      </div>
    </div>
  );
}
