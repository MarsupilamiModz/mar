export type StockedPlan = {
  stockLimit: number | null;
  soldCount: number;
};

export function planRemainingStock(plan: StockedPlan): number | null {
  if (plan.stockLimit == null) return null;
  return Math.max(0, plan.stockLimit - (plan.soldCount ?? 0));
}

export function isPlanSoldOut(plan: StockedPlan): boolean {
  const remaining = planRemainingStock(plan);
  return remaining !== null && remaining <= 0;
}
