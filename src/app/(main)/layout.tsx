import AppPrefetcher from "@/components/layout/AppPrefetcher";
import BottomNav from "@/components/layout/BottomNav";
import MainContentShell from "@/components/layout/MainContentShell";
import SearchSheet from "@/components/features/SearchSheet";
import PresenceTracker from "@/components/features/PresenceTracker";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex justify-center min-h-screen bg-gray-100">
      <div className="relative flex flex-col w-full max-w-[500px] min-h-screen bg-white">
        <MainContentShell>{children}</MainContentShell>
        <PresenceTracker />
        <AppPrefetcher isLoggedIn={!!user} />
        <SearchSheet />
        <BottomNav />
      </div>
    </div>
  );
}
