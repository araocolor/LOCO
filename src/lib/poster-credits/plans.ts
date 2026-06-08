export const CREDIT_PLANS = [
  { id: "plan_10", label: "10회 충전", amount: 11000, credits: 10 },
  { id: "plan_25", label: "25회 충전", amount: 22000, credits: 25 },
] as const;

export type CreditPlan = (typeof CREDIT_PLANS)[number];

export function findPlan(planId: string) {
  return CREDIT_PLANS.find((p) => p.id === planId);
}
