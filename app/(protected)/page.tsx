import { requireAuth } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await requireAuth();

  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold">Selamat datang, {user.name}</h1>
      <p className="text-sm text-muted-foreground">
        Role Anda: <span className="font-medium">{user.role}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        Halaman ini akan diganti dengan Dashboard sesungguhnya pada Phase 9.
      </p>
    </div>
  );
}