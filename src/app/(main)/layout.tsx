import BottomNav from "@/components/layout/BottomNav";
import MainContentShell from "@/components/layout/MainContentShell";
import BookmarkSyncOnExit from "@/components/layout/BookmarkSyncOnExit";
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
      <MainContentShell>{children}</MainContentShell>
      <BookmarkSyncOnExit />
      <SearchSheet />
      <BottomNav isLoggedIn={!!user} />
    </div>
  );
}
