import { useState } from "react";
import type { Snapshot } from "../shared/types";

export function Ranking({ room }: { room: Snapshot }) {
  const [expanded, setExpanded] = useState(false);
  const participants = room.players.filter((p) => p.role === "player").length;
  const alive = room.players.filter(
    (p) => p.role === "player" && p.hp > 0,
  ).length;
  const ranking = [...room.players].sort(
    (a, b) =>
      b.damage - a.damage ||
      b.correct / (b.attempted || 1) - a.correct / (a.attempted || 1) ||
      b.correct - a.correct,
  );
  return (
    <section className="panel ranking" data-expanded={expanded}>
      <div className="section-heading">
        <h2>讨伐贡献榜</h2>
        <span>
          {room.phase === "lobby"
            ? `${participants} / 6 人`
            : `存活 ${alive} / ${participants}`}
        </span>
      </div>
      <button
        className="mobile-rank-toggle"
        aria-expanded={expanded}
        aria-controls="ranking-content"
        onClick={() => setExpanded((value) => !value)}
      >
        讨伐贡献榜 · {participants} 人 {expanded ? "收起 −" : "展开 ＋"}
      </button>
      <div id="ranking-content" className="ranking-content">
        <div className="ranking-labels">
          <span>队员</span>
          <span>伤害 / 正确率</span>
        </div>
        {ranking.map((p, i) => (
          <div
            className={`rank-row ${p.id === room.meId ? "is-me" : ""}`}
            key={p.id}
          >
            <span className="rank-number">{i + 1}</span>
            <div className="rank-name">
              <strong>{p.name}</strong>
              <small>
                {p.hp === 0
                  ? "已倒下 · 旁观中"
                  : p.role === "spectator"
                    ? "观战中"
                    : p.id === room.hostId
                      ? "房主"
                      : p.online
                        ? "冒险者"
                        : "暂时离线"}
              </small>
            </div>
            <div className="rank-stats">
              <strong>{p.damage}</strong>
              <small>
                {p.attempted ? Math.round((p.correct / p.attempted) * 100) : 0}%
                · {p.correct}/{p.attempted}
              </small>
            </div>
          </div>
        ))}
        <p className="footnote">伤害优先，同伤害时比较正确率。</p>
      </div>
    </section>
  );
}
