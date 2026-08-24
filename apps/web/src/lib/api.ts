import { supabase } from "./supabaseClient.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

let refreshAccessTokenPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  // Subscription screens load more than one resource in parallel. Share the
  // refresh so concurrent 401 responses do not rotate the same refresh token
  // more than once.
  if (!refreshAccessTokenPromise) {
    refreshAccessTokenPromise = supabase.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error) return null;
        return data.session?.access_token ?? null;
      })
      .finally(() => {
        refreshAccessTokenPromise = null;
      });
  }
  return refreshAccessTokenPromise;
}

function requestWithToken(path: string, options: RequestInit, token: string | null) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  let res = await requestWithToken(path, options, token);

  // A session may still exist locally while its access token has just expired
  // (or while Supabase is rotating it). Refresh once and replay the request.
  // Mutating endpoints are safe to replay here because a rejected bearer token
  // is handled by authentication before their route handler runs.
  if (res.status === 401 && token) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      res = await requestWithToken(path, options, refreshedToken);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ? JSON.stringify(body.error) : res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path: string) => authedFetch(path),
  post: (path: string, body?: unknown) => authedFetch(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) => authedFetch(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => authedFetch(path, { method: "DELETE" }),
};

// Unauthenticated calls used by the public field flow (/f/:token) and the
// public verification page — no Supabase session involved.
export const publicApi = {
  get: async (path: string) => {
    const res = await fetch(`${API_BASE_URL}${path}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? res.statusText);
    return res.json();
  },
  post: async (path: string, body?: unknown) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? res.statusText);
    return res.json();
  },
};

export { API_BASE_URL };
