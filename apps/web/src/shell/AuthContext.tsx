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

  // Supabase re-validates the session (and fires onAuthStateChange with a
  // brand-new session object, even though the user hasn't changed) every
  // time the tab regains focus/visibility — keyed on session.user.id instead
  // of the session object itself so that doesn't re-trigger a profile
  // refetch + loading flash on every tab switch, only on an actual sign-in,
  // sign-out, or account change.
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    // A transient failure right after sign-in (e.g. the freshly minted
    // session token not yet valid for a beat) shouldn't strand the user on
    // the "no profile" screen — retry once before giving up.
    async function loadProfile() {
      try {
        const data = await api.get("/users/me");
        if (!cancelled) setProfile(data);
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (cancelled) return;
        try {
          const data = await api.get("/users/me");
          if (!cancelled) setProfile(data);
        } catch {
          if (!cancelled) setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut: () => supabase.auth.signOut().then(() => {}) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
