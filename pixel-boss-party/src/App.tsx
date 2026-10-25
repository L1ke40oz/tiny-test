import { useEffect, useState, type FormEvent } from "react";
import type { Snapshot } from "../shared/types";
import { useGame, initialCode } from "./useGame";
import { Preferences } from "./Preferences";
import { Ranking } from "./Ranking";
import { HostLog } from "./HostLog";
import { HostAccount } from "./HostAccount";
import { useHostSession } from "./useHostSession";
const colors = [
  "#b4d57c",
  "#e3ba82",
  "#92cbd8",
  "#c4a0dc",
  "#e69791",
  "#e3d38c",
];
const letters = ["A", "B", "C", "D"];

function Slime({
  small = false,
  hurt = false,
}: {
  small?: boolean;
  hurt?: boolean;
}) {
  return (
    <div className={`slime ${small ? "small" : ""}`}>
      <div className={`slime-reaction ${hurt ? "hurt" : ""}`}>
        <svg
          className="slime-sprite"
          viewBox="0 0 32 28"
          role="img"
          aria-label="森林史莱姆"
          shapeRendering="crispEdges"
        >
          <path fill="#263e3e" d="M7 25h20v2H7z" />
          <path fill="#2c715a" d="M10 4h13v3h4v5h3v11h-3v2H4v-3H2v-9h3V8h5z" />
          <path fill="#8cbd68" d="M10 4h12v3h4v6h3v8h-3v2H5v-2H3v-8h3V9h4z" />
          <path fill="#b5d884" d="M11 6h9v3h-9zM7 10h4v4H7z" />
          <path fill="#416749" d="M5 20h21v3H5z" />
          <path fill="#1d2934" d="M11 14h3v4h-3zM22 14h3v4h-3zM16 20h4v2h-4z" />
          <path fill="#e7e8a7" d="M10 1h3v5h-3zM7 0h3v3H7zM13 2h4v3h-4z" />
        </svg>
      </div>
    </div>
  );
}

function Countdown({ room, offset }: { room: Snapshot; offset: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((room.deadline - now - offset) / 1000));
  return (
    <span
      className={`timer ${room.phase === "question" && seconds <= 3 ? "urgent" : ""}`}
    >
      {room.phase === "paused" ? "已暂停" : `${seconds}s`}
    </span>
  );
}

function Invite({ code }: { code: string }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const url = `${location.origin}/?room=${code}`;
  useEffect(() => {
    let active = true;
    import("qrcode")
      .then((m) =>
        m.default.toDataURL(url, {
          width: 160,
          margin: 2,
          color: { dark: "#232f32", light: "#f6f1dc" },
        }),
      )
      .then((value) => {
        if (active) setQr(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [url]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="invite">
      {qr ? (
        <img src={qr} width="112" height="112" alt="房间邀请二维码" />
      ) : null}
      <div>
        <h3>叫上你的队友</h3>
        <p>分享链接，或输入房间码加入。</p>
        <code className="room-code">{code}</code>
        <button className="text-button" onClick={copy}>
          {copied ? "链接已复制" : "复制邀请链接"}
        </button>
        {location.hostname === "127.0.0.1" ||
        location.hostname === "localhost" ? (
          <small>本地预览：二维码暂不能跨手机访问。</small>
        ) : null}
      </div>
    </div>
  );
}

export function App() {
  const {
    room,
    connected,
    busy,
    error,
    setError,
    request,
    leave,
    clockOffset,
    refreshConnection,
  } = useGame();
  const hostAccess = useHostSession(refreshConnection);
  const [loginOpen, setLoginOpen] = useState(false);
  const mayCreate =
    !hostAccess.session.required || hostAccess.session.authenticated;
  const [name, setName] = useState(sessionStorage.getItem("pbp-name") ?? "");
  const [code, setCode] = useState(initialCode);
  const [seconds, setSeconds] = useState(10);
  function enter(event: FormEvent, create: boolean) {
    event.preventDefault();
    if (!name.trim()) {
      setError("先给自己起个昵称吧");
      return;
    }
    sessionStorage.setItem("pbp-name", name.trim());
    request(create ? "room:create" : "room:join", { name, code });
  }
  const me = room?.players.find((p) => p.id === room.meId);
  const host = room !== null && room.meId === room.hostId;
  const active = room?.phase === "question";
  const teamWiped =
    room !== null &&
    room.players.some((p) => p.role === "player") &&
    room.players.every((p) => p.role !== "player" || p.hp === 0);
  const submitted =
    room?.players.filter((p) => p.role === "player" && p.hp > 0 && p.submitted)
      .length ?? 0;
  const participants =
    room?.players.filter((p) => p.role === "player" && p.hp > 0).length ?? 0;
  const canAnswer =
    connected &&
    active &&
    me?.role === "player" &&
    me.hp > 0 &&
    room?.myAnswer === null &&
    !busy;
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="像素讨伐队首页">
          <span className="brand-icon">✦</span> 像素讨伐队
        </a>
        <HostAccount {...hostAccess} open={loginOpen} setOpen={setLoginOpen} />
        <span className={`connection ${connected ? "online" : ""}`}>
          <i />
          {connected ? "营地已连接" : "连接中…"}
        </span>
      </header>
      <main>
        {!room ? (
          <div className="welcome">
            <section className="intro">
              <span className="chapter">森林篇 · 第一场冒险</span>
              <h1>
                知识就是
                <br />
                你的攻击力。
              </h1>
              <p>
                叫上朋友，组成一支小小讨伐队。
                <br />
                答对一道题，一起让大怪物掉一点血。
              </p>
              <div className="intro-art">
                <Slime />
                <span className="spark s1">✦</span>
                <span className="spark s2">✧</span>
                <span className="ground" />
              </div>
              <div className="rules-strip">
                <span>最多 6 人组队</span>
                <span>每题限时作答</span>
                <span>合作击败 Boss</span>
              </div>
            </section>
            <section className="panel entry-panel">
              <span className="panel-tag">冒险者登记处</span>
              <h2>准备好出发了吗？</h2>
              <form onSubmit={(event) => enter(event, false)}>
                <label htmlFor="name">你的昵称</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={12}
                  placeholder="例如：不想上早八"
                  autoComplete="nickname"
                  required
                />
                <label htmlFor="room-code">房间码</label>
                <input
                  id="room-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={12}
                  placeholder="输入朋友分享的房间码"
                  autoComplete="off"
                />
                <button
                  className="button primary"
                  disabled={!connected || busy || !code.trim()}
                  type="submit"
                >
                  加入讨伐队 <span>↗</span>
                </button>
                <div className="divider">
                  <span>或者，你来当房主</span>
                </div>
                <button
                  className="button secondary"
                  disabled={!connected || busy || hostAccess.session.loading}
                  type="button"
                  onClick={(event) =>
                    mayCreate ? enter(event, true) : setLoginOpen(true)
                  }
                >
                  {mayCreate ? "创建一个房间" : "登录房主并创建房间"}{" "}
                  <span>＋</span>
                </button>
              </form>
              <p className="footnote">
                房主创建房间，队友填写昵称或扫码即可加入。
              </p>
            </section>
          </div>
        ) : (
          <>
            <div className="room-heading">
              <div>
                <span className="chapter">森林篇 · 讨伐进行时</span>
                <h1>
                  {room.phase === "lobby"
                    ? "队伍集合，准备出发。"
                    : room.phase === "finished"
                      ? room.outcome === "victory"
                        ? "讨伐成功，干得漂亮！"
                        : "再整队，下一次一定。"
                      : "森林里的大家伙出现了。"}
                </h1>
              </div>
              <span className="room-badge">房间 {room.code}</span>
            </div>
            <div className="game-layout">
              <div className="main-column">
                <section
                  className={`battlefield ${room.phase === "reveal" ? "is-reveal" : ""}`}
                >
                  <div className="boss-heading">
                    <div>
                      <span>森林守门员</span>
                      <h2>
                        苔苔大王 <small>Lv. 01</small>
                      </h2>
                    </div>
                    <strong>
                      {room.phase === "lobby"
                        ? "等待挑战"
                        : `${room.bossHp} / ${room.bossMaxHp}`}
                    </strong>
                  </div>
                  <div className="hp-track">
                    <div
                      style={{
                        width: `${room.bossMaxHp ? (room.bossHp / room.bossMaxHp) * 100 : 100}%`,
                      }}
                    />
                  </div>
                  <div className="forest-scene">
                    <div className="moon" />
                    <div className="tree tree-left" />
                    <div className="tree tree-right" />
                    <Slime
                      hurt={
                        room.phase === "reveal" &&
                        room.results.some((r) => r.correct)
                      }
                    />
                    {room.phase === "reveal" &&
                    room.results.some((result) => result.damage > 0) ? (
                      <span className="damage-pop">
                        −
                        {room.results.reduce(
                          (sum, r) => sum + r.damage,
                          room.teamDamage,
                        )}
                      </span>
                    ) : null}
                    <div className="forest-floor" />
                  </div>
                  <div className="party">
                    {room.players
                      .filter((p) => p.role === "player")
                      .map((p, i) => (
                        <div
                          className={`adventurer ${!p.online ? "offline" : ""} ${p.hp === 0 ? "eliminated" : ""}`}
                          key={p.id}
                        >
                          <span className="ready">
                            {p.hp === 0
                              ? "已倒下 · 旁观"
                              : !p.online
                                ? "离线"
                                : room.phase === "question"
                                  ? p.submitted
                                    ? "已就绪 ✓"
                                    : "思考中"
                                  : "准备好了"}
                          </span>
                          <div
                            className="pixel-person"
                            style={
                              {
                                "--avatar": colors[i % colors.length],
                              } as React.CSSProperties
                            }
                          >
                            <i />
                            <b />
                          </div>
                          <span>
                            {p.name}
                            {p.id === room.meId ? "（你）" : ""}
                          </span>
                          <small
                            className="hearts"
                            aria-label={`${p.hp} 点生命`}
                          >
                            {"♥".repeat(p.hp)}
                            <span>{"♡".repeat(3 - p.hp)}</span>
                          </small>
                        </div>
                      ))}
                  </div>
                </section>
                {room.phase === "lobby" ? (
                  <section className="panel lobby">
                    <h2>今天的任务：合力击败苔苔大王</h2>
                    <p>
                      答对攻击，答错掉心；血量归零后本局只能旁观。存活队员全部提交即可提前结算。
                    </p>
                    <Invite code={room.code} />
                  </section>
                ) : room.phase === "finished" ? (
                  <section className="panel result-panel">
                    <span className="result-symbol">
                      {room.outcome === "victory" ? "✦" : "☾"}
                    </span>
                    <h2>
                      {room.outcome === "victory"
                        ? "森林又恢复了平静"
                        : teamWiped
                          ? "全队倒下了，整队再来！"
                          : "题目答完了，下次继续！"}
                    </h2>
                    <p>
                      你贡献了 {me?.damage ?? 0} 点伤害，答对 {me?.correct ?? 0}{" "}
                      / {me?.attempted ?? 0} 题。
                    </p>
                    {host ? (
                      <button
                        className="button primary"
                        disabled={busy || !connected}
                        onClick={() => request("match:start", { seconds })}
                      >
                        再来一局
                      </button>
                    ) : (
                      <p>等待房主发起下一次挑战。</p>
                    )}
                  </section>
                ) : (
                  <section className="panel question-panel">
                    <div className="question-meta">
                      <span>
                        第 {room.round} / {room.totalRounds} 题
                      </span>
                      <span>
                        {room.phase === "question"
                          ? `${submitted} / ${participants} 已提交`
                          : room.phase === "paused"
                            ? "等待房主继续"
                            : room.teamDamage
                              ? "全员答对，团队合击！"
                              : "本题结算"}
                      </span>
                      <Countdown room={room} offset={clockOffset} />
                    </div>
                    <h2>{room.question?.text}</h2>
                    <div className="options">
                      {room.question?.options.map((option, i) => (
                        <button
                          key={i}
                          disabled={!canAnswer}
                          onClick={() =>
                            request("answer:submit", {
                              matchId: room.matchId,
                              questionId: room.question!.id,
                              choice: i,
                            })
                          }
                          className={`option ${room.myAnswer === i ? "selected" : ""} ${room.answer === i ? "correct" : ""} ${room.answer !== null && room.myAnswer === i && room.answer !== i ? "wrong" : ""}`}
                        >
                          <span>{letters[i]}</span>
                          {option}
                          {room.answer === i ? (
                            <b>正确答案</b>
                          ) : room.myAnswer === i ? (
                            <b>{room.answer === null ? "已选" : "答错"}</b>
                          ) : null}
                        </button>
                      ))}
                    </div>
                    <p className="question-hint" aria-live="polite">
                      {room.explanation ??
                        (room.phase === "paused"
                          ? "休息一下，倒计时已冻结。"
                          : me?.hp === 0
                            ? "你已倒下，本局只能旁观。剩下的战斗交给队友吧。"
                            : me?.role === "spectator"
                              ? "你正在观战，为队友加油吧。"
                              : room.myAnswer !== null
                                ? "已锁定答案，队友全部提交后立刻结算。"
                                : "选一个答案吧，答对就是一次攻击。")}
                    </p>
                  </section>
                )}
              </div>
              <aside className="side-column">
                <Ranking room={room} />
                <section className="panel controls">
                  <h3>{host ? "房主营地" : "我的状态"}</h3>
                  <p>
                    当前身份：
                    {me?.hp === 0
                      ? "已倒下（本局旁观）"
                      : me?.role === "player"
                        ? "参战队员"
                        : "观战者"}
                    {me?.nextRole
                      ? `（下题${me.nextRole === "player" ? "参战" : "观战"}）`
                      : ""}
                  </p>
                  {(host && me?.hp !== 0) ||
                  room.phase === "lobby" ||
                  room.phase === "finished" ? (
                    <button
                      className="button secondary"
                      disabled={busy || !connected}
                      onClick={() =>
                        request("player:set-role", {
                          role:
                            (me?.nextRole ?? me?.role) === "player"
                              ? "spectator"
                              : "player",
                        })
                      }
                    >
                      切换为
                      {(me?.nextRole ?? me?.role) === "player"
                        ? "观战"
                        : "参战"}
                    </button>
                  ) : null}
                  {host ? (
                    <>
                      {room.phase === "lobby" || room.phase === "finished" ? (
                        <>
                          <label htmlFor="seconds">每题限时</label>
                          <select
                            id="seconds"
                            value={seconds}
                            onChange={(e) => setSeconds(Number(e.target.value))}
                          >
                            <option value={8}>8 秒 · 快问快答</option>
                            <option value={10}>10 秒 · 轻松一点</option>
                            <option value={15}>15 秒 · 慢慢思考</option>
                          </select>
                          {room.phase === "lobby" ? (
                            <button
                              className="button primary"
                              disabled={busy || !connected}
                              onClick={() =>
                                request("match:start", { seconds })
                              }
                            >
                              全员就位，开始挑战
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <button
                          className="button secondary"
                          disabled={busy || !connected}
                          onClick={() =>
                            request(
                              room.phase === "paused"
                                ? "match:resume"
                                : "match:pause",
                              {},
                            )
                          }
                        >
                          {room.phase === "paused" ? "继续挑战" : "暂停一下"}
                        </button>
                      )}
                    </>
                  ) : null}
                </section>
                {host ? <HostLog room={room} /> : null}
                <button
                  className="text-button leave-button"
                  disabled={busy || !connected}
                  onClick={leave}
                >
                  离开房间
                </button>
              </aside>
            </div>
          </>
        )}
        {error ? (
          <div className="error-toast" role="alert">
            {error}
            <button aria-label="关闭提示" onClick={() => setError("")}>
              ×
            </button>
          </div>
        ) : null}
      </main>
      <footer>
        像素讨伐队 <span>一群朋友，一点知识，一场小冒险。</span>
        <Preferences />
        <span>试玩版 v0.1</span>
      </footer>
    </div>
  );
}
