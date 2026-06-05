import { redirect } from "next/navigation";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string; room?: string }>;
}) {
  const params = await searchParams;
  const roomId = params.roomId ?? params.room;
  const target = roomId
    ? `/?tab=messages&roomId=${encodeURIComponent(roomId)}`
    : "/?tab=messages";

  redirect(target);
}
