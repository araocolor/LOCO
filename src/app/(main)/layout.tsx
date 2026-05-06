import BottomNav from "@/components/layout/BottomNav";
import SearchSheet from "@/components/features/SearchSheet";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-16">{children}</main>
      <SearchSheet />
      <BottomNav isLoggedIn={false} />
    </div>
  );
}
