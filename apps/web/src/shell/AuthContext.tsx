import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AppUser } from "@zoppi/shared";
import { supabase } from "../lib/supabaseClient.js";
import { api, ApiError } from "../lib/api.js";

export type ProfileLoadErrorKind = "missing_profile" | "invalid_session" | "service_unavailable";

export interface ProfileLoadError {
  kind: ProfileLoadErrorKind;
  message: string;
}

interface AuthState {
  session: Session | null;
  profile: AppUser | null;
  profileError: ProfileLoadError | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  profileError: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

function profileLoadError(error: unknown): ProfileLoadError {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        kind: "invalid_session",
        message: "Sua sessão não pôde ser validada. Saia e entre novamente.",
      };
    }
    if (error.status === 403 || (error.status === 404 && error.message === "Profile not found")) {
      return {
        kind: "missing_profile",
        message: "Esta conta está autenticada, mas não possui um perfil ativo na plataforma.",
      };
    }
  }

  return {
    kind: "service_unavailable",
    message: "Não foi possível carregar seu perfil agora. A API ou o banco de dados pode estar temporariamente indisponível.",
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [profileError, setProfileError] = useState<ProfileLoadError | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    setProfileError(null);
    try {
      const data = await api.get("/users/me");
      setProfile(data);
    } catch (error) {
      setProfile(null);
      setProfileError(profileLoadError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setProfile(null);
    setProfileError(null);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  }, []);

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
      setProfileError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setProfileError(null);

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
        } catch (error) {
          if (!cancelled) {
            setProfile(null);
            setProfileError(profileLoadError(error));
          }
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
    <AuthContext.Provider value={{ session, profile, profileError, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
