import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AppUser } from "@zoppi/shared";
import { supabase } from "../lib/supabaseClient.js";
import { api } from "../lib/api.js";

interface AuthState {
  session: Session | null;
  profile: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ session: null, profile: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get("/users/me")
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut: () => supabase.auth.signOut().then(() => {}) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
