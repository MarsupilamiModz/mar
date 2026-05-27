import { getCoupons } from "@/actions/admin/coupons";
import { CouponsAdmin } from "@/components/admin/coupons-admin";
export default async function AdminCouponsPage() {
  const result = await getCoupons();
  const coupons = result.success ? result.data : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Coupons</h1>
      <div className="mt-8">
        <CouponsAdmin initialCoupons={coupons} />
      </div>
    </div>
  );
}
