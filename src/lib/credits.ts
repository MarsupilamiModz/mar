import { prisma } from "@/lib/db";
import type { CreditTransactionType } from "@prisma/client";

/** 10 EUR = 1000 credits → 1 credit = 1 cent EUR equivalent */
export const CREDITS_PER_EUR = 100;
export const EUR_CENTS_PER_CREDIT = 1;

export function centsToCredits(cents: number): number {
  return Math.round(cents * CREDITS_PER_EUR / 100);
}

export function creditsToCents(credits: number): number {
  return Math.round(credits * 100 / CREDITS_PER_EUR);
}

export function formatCredits(credits: number, locale = "en"): string {
  return `${credits.toLocaleString(locale)} Credits`;
}

export function formatCreditsFromCents(cents: number, locale = "en"): string {
  return formatCredits(centsToCredits(cents), locale);
}

export async function getOrCreateWallet(userId: string) {
  return prisma.creditWallet.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  });
}

export async function getWalletBalance(userId: string): Promise<number> {
  const wallet = await prisma.creditWallet.findUnique({ where: { userId } });
  return wallet?.balance ?? 0;
}

export async function creditWallet(params: {
  userId: string;
  amount: number;
  type: CreditTransactionType;
  description?: string;
  referenceId?: string;
}) {
  if (params.amount === 0) return getOrCreateWallet(params.userId);

  const wallet = await getOrCreateWallet(params.userId);
  const nextBalance = wallet.balance + params.amount;
  if (nextBalance < 0) throw new Error("Insufficient credits");

  const [updated] = await prisma.$transaction([
    prisma.creditWallet.update({
      where: { id: wallet.id },
      data: { balance: nextBalance },
    }),
    prisma.creditTransaction.create({
      data: {
        walletId: wallet.id,
        amount: params.amount,
        type: params.type,
        description: params.description,
        referenceId: params.referenceId,
      },
    }),
  ]);

  return updated;
}

export async function getCreditHistory(userId: string, limit = 50) {
  const wallet = await prisma.creditWallet.findUnique({
    where: { userId },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: limit },
    },
  });
  return wallet;
}
