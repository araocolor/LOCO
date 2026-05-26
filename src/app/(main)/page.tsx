import { Suspense } from "react";
import MainTabbedHomePage from "@/components/features/MainTabbedHomePage";

export const revalidate = 3600;

export default function MainPage() {
  return (
    <Suspense>
      <MainTabbedHomePage initialClasses={[]} />
    </Suspense>
  );
}
