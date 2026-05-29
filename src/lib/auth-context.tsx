"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

const LAST_ACTIVE_PING_KEY = "loco_last_active_ping_v1";
const LAST_ACTIVE_PING_INTERVAL_MS = 5 * 60 * 1000;

interface User {
  id: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function hasRecentLastActivePing(userId: string) {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_PING_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as { userId?: string; ts?: number };
    return parsed.userId === userId && typeof parsed.ts === "number" && Date.now() - parsed.ts < LAST_ACTIVE_PING_INTERVAL_MS;
  } catch {
    return false;
  }
}

function markLastActivePing(userId: string) {
  try {
    localStorage.setItem(
      LAST_ACTIVE_PING_KEY,
      JSON.stringify({
        userId,
        ts: Date.now(),
      })
    );
  } catch {}
}

function clearLastActivePing(userId: string) {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_PING_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as { userId?: string };
    if (parsed.userId === userId) {
      localStorage.removeItem(LAST_ACTIVE_PING_KEY);
    }
  } catch {}
}

function sendLastActivePing(userId: string) {
  if (hasRecentLastActivePing(userId)) return;

  markLastActivePing(userId);

  const supabase = createClient();
  supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId)
    .then(({ error }) => {
      if (error) clearLastActivePing(userId);
    });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    let currentUserId: string | null = null;

    function syncUser(sessionUser: { id: string; email?: string } | null) {
      const nextId = sessionUser?.id ?? null;
      if (nextId !== currentUserId) {
        currentUserId = nextId;
        setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null);
      }
      if (sessionUser) sendLastActivePing(sessionUser.id);
      setLoading(false);
    }

    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      syncUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    loadUser();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
