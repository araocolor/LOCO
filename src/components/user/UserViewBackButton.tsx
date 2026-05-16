"use client";

import HeaderBackCircleButton from "@/components/layout/HeaderBackCircleButton";
import { PROFILE_RETURN_FOCUS_USER_KEY } from "@/lib/profile-return-focus";

export default function UserViewBackButton({ userId }: { userId: string }) {
  return (
    <HeaderBackCircleButton
      onBeforeBack={() => {
        try {
          sessionStorage.setItem(PROFILE_RETURN_FOCUS_USER_KEY, userId);
        } catch {}
      }}
    />
  );
}
