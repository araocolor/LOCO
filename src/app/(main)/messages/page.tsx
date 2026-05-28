import { redirect } from "next/navigation";

export default function MessagesPage() {
  redirect("/?tab=messages");
}
