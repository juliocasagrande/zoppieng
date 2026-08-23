import { supabase } from "./supabaseClient.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

async function authedFetch(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
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
