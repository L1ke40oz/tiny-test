import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { Reply, Snapshot } from "../shared/types";

// sessionStorage 按标签页隔离；复制标签页可能克隆身份，服务器会转移控制权。
const token = sessionStorage.getItem("pbp-token") ?? crypto.randomUUID();
sessionStorage.setItem("pbp-token", token);
const socket = io({ autoConnect: false, auth: { token } });
const invitation = new URLSearchParams(location.search)
  .get("room")
  ?.toUpperCase();
export const initialCode =
  invitation ?? sessionStorage.getItem("pbp-room") ?? "";

export function useGame() {
  const [connected, setConnected] = useState(false);
  const [view, setView] = useState<{
    room: Snapshot | null;
    clockOffset: number;
  }>({ room: null, clockOffset: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setError("");
      const lastRoom = sessionStorage.getItem("pbp-room");
      if (lastRoom && (!invitation || invitation === lastRoom)) {
        socket.timeout(5000).emit(
          "room:join",
          {
            code: lastRoom,
            name: sessionStorage.getItem("pbp-name") ?? "冒险者",
          },
          (timeout: Error | null, reply: Reply) => {
            if (timeout) {
              setError("恢复房间超时，请刷新重试。");
              return;
            }
            if (!reply.ok) {
              sessionStorage.removeItem("pbp-room");
              setView({ room: null, clockOffset: 0 });
              setError(reply.error ?? "房间已失效");
            }
          },
        );
      }
    };
    const onSnapshot = (room: Snapshot) => {
      // 接收时记录时差；倒计时的频繁更新留在独立组件，不重绘整个战场。
      setView({ room, clockOffset: room.serverTime - Date.now() });
      sessionStorage.setItem("pbp-room", room.code);
    };
    const onDisconnect = () => {
      setConnected(false);
      setBusy(false);
    };
    const onError = () => setError("暂时连不上游戏服务，正在重试…");
    const onReplaced = () => {
      sessionStorage.removeItem("pbp-room");
      setView({ room: null, clockOffset: 0 });
      setError("该身份已在另一个窗口接管，请打开独立标签页加入。");
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);
    socket.on("room:snapshot", onSnapshot);
    socket.on("session:replaced", onReplaced);
    socket.connect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
      socket.off("room:snapshot", onSnapshot);
      socket.off("session:replaced", onReplaced);
      socket.disconnect();
    };
  }, []);

  function request(
    event: string,
    data: Record<string, unknown>,
    onSuccess?: () => void,
  ) {
    if (!socket.connected) {
      setError("连接恢复后再试一下");
      return;
    }
    setBusy(true);
    setError("");
    socket
      .timeout(5000)
      .emit(event, data, (timeout: Error | null, reply: Reply) => {
        setBusy(false);
        if (timeout) setError("请求确认超时，重连后会同步实际状态");
        else if (!reply.ok) setError(reply.error ?? "操作失败");
        else onSuccess?.();
      });
  }
  function leave() {
    request("room:leave", {}, () => {
      sessionStorage.removeItem("pbp-room");
      setView({ room: null, clockOffset: 0 });
      history.replaceState(null, "", location.pathname);
    });
  }
  function refreshConnection() {
    socket.disconnect();
    socket.connect();
  }
  return {
    ...view,
    connected,
    busy,
    error,
    setError,
    request,
    leave,
    refreshConnection,
  };
}
