import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, isValidAdminSession } from "@/lib/admin-session";
import AdminDashboard from "../dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!(await isValidAdminSession(token))) redirect("/admin/login");
  return <AdminDashboard />;
}
