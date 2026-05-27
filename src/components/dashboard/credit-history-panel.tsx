import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCredits } from "@/lib/credits";
import type { CreditTransactionType } from "@prisma/client";

const TYPE_LABELS: Partial<Record<CreditTransactionType, string>> = {
  PURCHASE: "Purchase",
  EARNED: "Earned",
  PAYOUT: "Payout",
  REFUND: "Refund",
  ORDER_PAYMENT: "Order payment",
  ADMIN_ADJUST: "Adjustment",
  CONVERSION: "Conversion",
};

export function CreditHistoryPanel({
  balance,
  transactions,
  locale,
}: {
  balance: number;
  transactions: {
    id: string;
    amount: number;
    type: CreditTransactionType;
    description: string | null;
    createdAt: Date;
  }[];
  locale: string;
}) {
  return (
    <Card className="glass border-neon-purple/20">
      <CardHeader>
        <CardTitle className="text-lg">Credit wallet</CardTitle>
        <p className="text-2xl font-bold text-gradient">{formatCredits(balance, locale)}</p>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="space-y-2">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{tx.description ?? TYPE_LABELS[tx.type] ?? tx.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString(locale)}
                  </p>
                </div>
                <span className={tx.amount >= 0 ? "text-neon-blue font-semibold shrink-0" : "text-red-400 font-semibold shrink-0"}>
                  {tx.amount >= 0 ? "+" : ""}
                  {formatCredits(tx.amount, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
