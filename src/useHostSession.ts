import { useEffect, useState } from "react";

export interface HostSession {
  required: boolean;
  authenticated: boolean;
  loading: boolean;
}
export function useHostSession(reconnect: () => void) {
  const [session, setSession] = useState<HostSession>({
    required: true,
    authenticated: false,
    loading: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) =>
        setSession({
          required: data.required === true,
          authenticated: data.authenticated === true,
          loading: false,
        }),
      )
      .catch(() => {
        if (!controller.signal.aborted) {
          setSession({ required: true, authenticated: false, loading: false });
          setError("房主服务暂不可用，请刷新重试");
        }
      });
    return () => controller.abort();
  }, []);
  async function login(username: string, password: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/host/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "登录失败，请重试");
      setSession({ required: true, authenticated: true, loading: false });
      reconnect();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请重试");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/host/logout", { method: "POST" });
      if (!response.ok) throw new Error("退出失败，请重试");
      setSession((value) => ({ ...value, authenticated: false }));
      reconnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "退出失败，请重试");
    } finally {
      setBusy(false);
    }
  }
  return { session, busy, error, login, logout };
}
