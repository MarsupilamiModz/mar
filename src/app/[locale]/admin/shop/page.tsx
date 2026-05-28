import { requireStaff } from "@/lib/auth";
import { listAdminShopProducts } from "@/actions/admin/shop";
import { ShopAdminPanel } from "@/components/admin/shop-admin-panel";

export default async function AdminShopPage() {
  await requireStaff();
  const result = await listAdminShopProducts();
  const products = result.success ? result.data : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Shop Management</h1>
      <p className="text-muted-foreground">Manage credit packs, products, prices, and featured items.</p>
      <ShopAdminPanel products={products} />
    </div>
  );
}
