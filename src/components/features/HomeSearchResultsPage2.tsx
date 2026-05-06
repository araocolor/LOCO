import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";

export default async function HomeSearchResultsPage2() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classes")
    .select("id, title, region, images")
    .order("created_at", { ascending: false })
    .limit(2);

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-4 p-4">
      {(data ?? []).map((c) => {
        const imageUrl = c.images?.[0]?.card_url ?? null;
        return (
          <Link key={c.id} href={`/classes/${c.id}`} className="block bg-white rounded-xl shadow overflow-hidden">
            {imageUrl && (
              <div className="relative w-full h-48">
                <Image src={imageUrl} alt={c.title} fill className="object-cover" />
              </div>
            )}
            <div className="p-4">
              <p className="font-bold text-gray-900">{c.title}</p>
              <p className="text-sm text-gray-500">{c.region}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
