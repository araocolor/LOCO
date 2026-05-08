"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export const PRESENCE_EVENT = "presence-online-ids-updated";

declare global {
  interface Window {
    __onlineIds?: Set<string>;
  }
}

export default function PresenceTracker() {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("online-users");

    const updateOnlineIds = () => {
      const state = channel.presenceState<{ user_id: string }>();
      const ids = new Set(Object.values(state).flat().map((p) => p.user_id));
      window.__onlineIds = ids;
      window.dispatchEvent(new CustomEvent(PRESENCE_EVENT, { detail: ids }));
    };

    channel
      .on("presence", { event: "sync" }, updateOnlineIds)
      .on("presence", { event: "join" }, updateOnlineIds)
      .on("presence", { event: "leave" }, updateOnlineIds)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) await channel.track({ user_id: user.id });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  return null;
}
