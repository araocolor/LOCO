import BottomNav from "@/components/layout/BottomNav";
import MainContentShell from "@/components/layout/MainContentShell";
import TabbedMain from "@/components/layout/TabbedMain";
import SearchSheet from "@/components/features/SearchSheet";
import PresenceTracker from "@/components/features/PresenceTracker";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import AuthGate from "@/components/layout/AuthGate";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClassWithHost } from "@/components/class/ClassCard";

async function fetchInitialClasses(): Promise<ClassWithHost[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("classes")
      .select("*, host:profiles!host_id(id, nickname, profile_image_url)")
      .order("created_at", { ascending: false })
      .limit(12);
    if (error || !data) return [];
    return data as ClassWithHost[];
  } catch {
    return [];
  }
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthGate />;
  }

  const initialClasses = await fetchInitialClasses();

  return (
    <div className="flex justify-center h-full bg-gray-100">
      <div className="relative flex flex-col w-full max-w-[500px] h-full bg-white overflow-hidden">
        <div className="w-full bg-white flex-shrink-0" style={{ height: 'env(safe-area-inset-top)' }} />
        <MainContentShell>
          <TabbedMain initialClasses={initialClasses} />
          {children}
        </MainContentShell>
        <PresenceTracker />
        <SearchSheet />
        <BottomNav />
      </div>
    </div>
  );
}
