import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function MainPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-2xl font-bold">welcome</p>
    </div>
  );
}
