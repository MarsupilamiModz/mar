import { prisma } from "@/lib/db";

/** Generate unique invoice reference e.g. MM-2026-4832 */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MM-${year}-`;

  for (let attempt = 0; attempt < 10; attempt++) {
    const seq = Math.floor(1000 + Math.random() * 8999);
    const invoiceNumber = `${prefix}${seq}`;
    const exists = await prisma.customOrder.findUnique({ where: { invoiceNumber } });
    if (!exists) return invoiceNumber;
  }

  const fallback = `${prefix}${Date.now().toString().slice(-6)}`;
  return fallback;
}

export function formatPaymentReference(invoiceNumber: string): string {
  return `Invoice ${invoiceNumber}`;
}
