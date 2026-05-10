import { Suspense } from "react";
import MainHeader from "@/components/layout/MainHeader";
import HomeSearchResultsPage from "@/components/features/HomeSearchResultsPage";
import { createClient } from "@/lib/supabase/server";
import { ClassWithHost } from "@/components/class/ClassCard";

export const revalidate = 3600;
const HOME_PAGE_SIZE = 10;

async function fetchInitialClasses(): Promise<ClassWithHost[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("classes")
      .select("*, host:profiles!host_id(id, nickname, profile_image_url)")
      .order("created_at", { ascending: false })
      .range(0, HOME_PAGE_SIZE - 1);
    return (data ?? []) as ClassWithHost[];
  } catch {
    return [];
  }
}

export default async function MainPage() {
  const initialClasses = await fetchInitialClasses();

  return (
    <>
      <MainHeader />
      <Suspense>
        <HomeSearchResultsPage initialClasses={initialClasses} />
      </Suspense>
    </>
  );
}
