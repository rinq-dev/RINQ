export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { redirect } = await import("next/navigation");
  redirect("/admin/trang-chu");
}
