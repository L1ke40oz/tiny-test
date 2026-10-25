import type { Snapshot } from "../shared/types";

const letters = ["A", "B", "C", "D"];
export function HostLog({ room }: { room: Snapshot }) {
  const latest = room.history.at(-1);
  return (
    <section className="panel host-log">
      <h3>房间动态</h3>
      <p className="footnote">答题时显示提交状态，结算后展示选项和伤害。</p>
      <ol className="activity-list">
        {room.activities
          .slice(-8)
          .reverse()
          .map((activity) => (
            <li key={activity.id}>
              <time>
                {new Date(activity.time).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </time>
              <span>{activity.text}</span>
            </li>
          ))}
      </ol>
      {latest ? (
        <details className="round-log" open key={latest.round}>
          <summary>第 {latest.round} 题 · 查看队员结果</summary>
          <p>{latest.question}</p>
          <p>答案：{latest.answer}</p>
          {latest.results.map((result) => (
            <p key={result.playerId}>
              <span>{result.name}</span>
              {result.choice === null
                ? "超时"
                : `${letters[result.choice]} · ${result.correct ? "答对" : "答错"}`}{" "}
              · {result.damage} 伤害
            </p>
          ))}
          {latest.teamDamage ? <p>团队合击 +{latest.teamDamage}</p> : null}
        </details>
      ) : null}
      {room.history.length > 1 ? (
        <details className="round-log">
          <summary>此前题目</summary>
          {room.history.slice(0, -1).map((round) => (
            <details key={round.round}>
              <summary>第 {round.round} 题</summary>
              <p>{round.question}</p>
              {round.results.map((result) => (
                <p key={result.playerId}>
                  {result.name}：
                  {result.correct
                    ? "答对"
                    : result.choice === null
                      ? "超时"
                      : "答错"}
                  ，{result.damage} 伤害
                </p>
              ))}
            </details>
          ))}
        </details>
      ) : null}
    </section>
  );
}
