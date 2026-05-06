import BottomNav from "@/components/layout/BottomNav";
import SearchSheet from "@/components/features/SearchSheet";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-16">{children}</main>
      <SearchSheet />
      <BottomNav isLoggedIn={!!user} />
    </div>
  );
}
