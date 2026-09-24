import { OrdersBoard } from "@/components/OrdersBoard";

export const dynamic = "force-dynamic";

export default function AdminOrdersPage() {
  return <OrdersBoard mode="all" />;
}
