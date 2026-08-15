import { requireAuth } from "@/lib/auth/session";
import { Topbar } from "@/components/layout/topbar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar user={user} />
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}