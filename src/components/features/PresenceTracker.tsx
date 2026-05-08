"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PresenceTracker() {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("online-users");

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await channel.track({ user_id: user.id });
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, []);

  return null;
}
