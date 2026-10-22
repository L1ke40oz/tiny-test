import { useEffect, useRef, useState } from "react";
import type { HostSession } from "./useHostSession";

interface Props {
  session: HostSession;
  open: boolean;
  setOpen: (open: boolean) => void;
  busy: boolean;
  error: string;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}
export function HostAccount({
  session,
  open,
  setOpen,
  busy,
  error,
  login,
  logout,
}: Props) {
  const [username, setUsername] = useState("host");
  const [password, setPassword] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else {
      dialog.current?.close();
      setPassword("");
    }
  }, [open]);
  if (session.loading || !session.required) return null;
  return (
    <>
      <button
        className="text-button host-account-button"
        disabled={busy}
        onClick={() => (session.authenticated ? void logout() : setOpen(true))}
      >
        {session.authenticated ? "房主已登录 · 退出" : "房主登录"}
      </button>
      <dialog
        ref={dialog}
        className="host-dialog"
        aria-labelledby="host-login-title"
        onCancel={() => setOpen(false)}
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (await login(username, password)) setOpen(false);
          }}
        >
          <div className="section-heading">
            <h2 id="host-login-title">房主登录</h2>
            <button
              type="button"
              className="text-button"
              onClick={() => setOpen(false)}
              aria-label="关闭登录"
            >
              关闭
            </button>
          </div>
          <p>登录后创建房间，邀请朋友加入。</p>
          <label htmlFor="host-username">账号</label>
          <input
            id="host-username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={64}
            required
          />
          <label htmlFor="host-password">密码</label>
          <input
            id="host-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={256}
            required
          />
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="button primary" disabled={busy} type="submit">
            {busy ? "登录中…" : "登录房主账号"}
          </button>
        </form>
      </dialog>
    </>
  );
}
