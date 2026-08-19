"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, logout as apiLogout, refreshAccessToken, setAccessToken, setAuthLostHandler } from "@/lib/admin/api";

type Admin = { id?: number; email?: string; lastLoginAt?: string };

type AuthState = {
  status: "loading" | "authenticated" | "anonymous";
  admin: Admin | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [admin, setAdmin] = useState<Admin | null>(null);

  const loadAdmin = useCallback(async () => {
    const { data } = await api.GET("/api/v1/admin/me");
    setAdmin(data?.data ?? null);
  }, []);

  /**
   * On a hard reload the in-memory token is gone but the httpOnly refresh cookie is not, so one
   * silent refresh restores the session before any protected route renders — otherwise every F5
   * would bounce the admin to /login (Phase 11).
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await refreshAccessToken();
      if (cancelled) return;
      if (!token) {
        setStatus("anonymous");
        return;
      }
      await loadAdmin();
      if (!cancelled) setStatus("authenticated");
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAdmin]);

  useEffect(() => {
    setAuthLostHandler(() => {
      setStatus("anonymous");
      setAdmin(null);
      router.replace("/login");
    });
    return () => setAuthLostHandler(null);
  }, [router]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error, response } = await api.POST("/api/v1/auth/login", {
        body: { email, password },
      });
      if (!response.ok || !data?.data?.accessToken) {
        if (response.status === 429) return "Too many attempts. Please try again later.";
        // The backend answers identically for an unknown email and a wrong password, on
        // purpose — so the UI must not guess which it was either.
        return error && typeof error === "object" && "message" in error
          ? "Invalid email or password."
          : "Invalid email or password.";
      }
      setAccessToken(data.data.accessToken);
      await loadAdmin();
      setStatus("authenticated");
      return null;
    },
    [loadAdmin],
  );

  const signOut = useCallback(async () => {
    await apiLogout();
    setAdmin(null);
    setStatus("anonymous");
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ status, admin, signIn, signOut }),
    [status, admin, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
