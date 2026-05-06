import { Suspense } from "react";
import MainHeader from "@/components/layout/MainHeader";
import HomeSearchResultsPage from "@/components/features/HomeSearchResultsPage";

export default function MainPage() {
  return (
    <>
      <MainHeader />
      <Suspense>
        <HomeSearchResultsPage />
      </Suspense>
    </>
  );
}
