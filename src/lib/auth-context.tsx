"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

interface User {
  id: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    function syncUser(sessionUser: { id: string; email?: string } | null) {
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null);
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
