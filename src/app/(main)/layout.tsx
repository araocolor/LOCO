import BottomNav from "@/components/layout/BottomNav";
import MainContentShell from "@/components/layout/MainContentShell";
import TabbedMain from "@/components/layout/TabbedMain";
import SearchSheet from "@/components/features/SearchSheet";
import PresenceTracker from "@/components/features/PresenceTracker";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import AuthGate from "@/components/layout/AuthGate";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthGate />;
  }

  return (
    <div className="flex justify-center h-full bg-gray-100">
      <div className="relative flex flex-col w-full max-w-[500px] h-full bg-white overflow-hidden">
        <div className="w-full bg-white flex-shrink-0" style={{ height: 'env(safe-area-inset-top)' }} />
        <MainContentShell>
          <TabbedMain />
          {children}
        </MainContentShell>
        <PresenceTracker />
        <SearchSheet />
        <BottomNav />
      </div>
    </div>
  );
}
