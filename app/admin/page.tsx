import type { Metadata } from "next";
import { adminPinConfigured, isAdmin } from "@/lib/adminAuth";
import { buildState } from "@/lib/state";
import AdminClient from "./AdminClient";
import AdminLogin from "./AdminLogin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Home Display · Settings" };

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;
  return <AdminClient initial={buildState()} pinConfigured={adminPinConfigured()} />;
}
