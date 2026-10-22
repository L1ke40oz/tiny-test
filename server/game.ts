import { randomInt, randomUUID } from "node:crypto";
import type {
  Activity,
  Phase,
  PublicPlayer,
  Role,
  RoundResult,
  RoundSummary,
  Snapshot,
} from "../shared/types.js";
import { questions, type Question } from "./questions.js";

interface Player extends Omit<PublicPlayer, "submitted"> {
  token: string;
}
export class GameError extends Error {}
export class Room {
  readonly code: string;
  readonly hostToken: string;
  players = new Map<string, Player>();
  phase: Phase = "lobby";
  version = 0;
  duration = 10_000;
  totalRounds = 15;
  round = 0;
  deadline = 0;
  matchId = "";
  bossHp = 0;
  bossMaxHp = 0;
  deck: Question[] = [];
  eligible: string[] = [];
  answers = new Map<string, number>();
  results: RoundResult[] = [];
  teamDamage = 0;
  outcome: Snapshot["outcome"] = null;
  activities: Activity[] = [];
  history: RoundSummary[] = [];
  private eventSequence = 0;
  lastActivity = Date.now();
  private resumePhase: "question" | "reveal" = "question";
  private remaining = 0;

  constructor(code: string, token: string, name: string) {
    this.code = code;
    this.hostToken = token;
    this.join(token, name);
  }
  private changed() {
    this.version++;
    this.lastActivity = Date.now();
  }
  private record(text: string) {
    this.activities.push({ id: ++this.eventSequence, time: Date.now(), text });
    this.activities = this.activities.slice(-40);
  }
  private player(token: string) {
    const player = this.players.get(token);
    if (!player) throw new GameError("请先加入房间");
    return player;
  }
  private host(token: string) {
    if (token !== this.hostToken) throw new GameError("只有房主可以操作");
  }
  join(token: string, rawName: string) {
    const existing = this.players.get(token);
    if (existing) {
      this.online(token, true);
      return;
    }
    const name = typeof rawName === "string" ? rawName.trim().slice(0, 12) : "";
    if (!name) throw new GameError("请填写昵称");
    if (this.players.size >= 8)
      throw new GameError("房间已满（6 位玩家与 2 位观众）");
    const count = [...this.players.values()].filter(
      (p) => p.role === "player",
    ).length;
    const role: Role =
      this.phase === "lobby" && count < 6 ? "player" : "spectator";
    this.players.set(token, {
      token,
      id: randomUUID(),
      name,
      role,
      online: true,
      hp: 3,
      damage: 0,
      correct: 0,
      attempted: 0,
      streak: 0,
    });
    this.record(`${name} 加入房间`);
    this.changed();
  }
  online(token: string, value: boolean) {
    const player = this.player(token);
    if (player.online === value) return;
    player.online = value;
    this.record(`${player.name} ${value ? "重新连接" : "离开连接"}`);
    this.changed();
  }
  setRole(token: string, role: Role) {
    if (role !== "player" && role !== "spectator")
      throw new GameError("无效角色");
    const player = this.player(token);
    const active = this.phase !== "lobby" && this.phase !== "finished";
    if (active && role === "player" && player.hp === 0)
      throw new GameError("本局已倒下，只能观战，下一局才能重新参战");
    if (active && token !== this.hostToken)
      throw new GameError("普通玩家在下一局调整身份");
    const others = [...this.players.values()].filter(
      (p) => p.token !== token && (p.nextRole ?? p.role) === "player",
    );
    if (role === "player" && others.length >= 6)
      throw new GameError("参战席位已满");
    if (active && role === "spectator" && !others.some((p) => p.hp > 0))
      throw new GameError("至少保留一位存活参战玩家");
    if (active) player.nextRole = role;
    else {
      player.role = role;
      delete player.nextRole;
    }
    this.record(
      `${player.name} ${active ? "下题切换为" : "切换为"}${role === "player" ? "参战" : "观战"}`,
    );
    this.changed();
  }
  start(token: string, seconds: number, now = Date.now()) {
    this.host(token);
    if (this.phase !== "lobby" && this.phase !== "finished")
      throw new GameError("本局还没有结束");
    if (![8, 10, 15].includes(seconds))
      throw new GameError("请选择 8、10 或 15 秒");
    const count = [...this.players.values()].filter(
      (p) => p.role === "player" && p.online,
    ).length;
    if (!count) throw new GameError("至少需要一位在线参战玩家");
    this.duration = seconds * 1000;
    this.matchId = randomUUID();
    this.round = 0;
    this.outcome = null;
    this.history = [];
    this.bossMaxHp = Math.round(count * this.totalRounds * 10 * 0.65);
    this.bossHp = this.bossMaxHp;
    this.deck = [...questions];
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    for (const p of this.players.values()) {
      p.hp = 3;
      p.damage = 0;
      p.correct = 0;
      p.attempted = 0;
      p.streak = 0;
      delete p.nextRole;
    }
    this.record(`房主开始挑战，每题 ${seconds} 秒`);
    this.nextQuestion(now);
  }
  private nextQuestion(now: number) {
    for (const p of this.players.values()) {
      if (p.nextRole) {
        p.role = p.nextRole;
        delete p.nextRole;
      }
    }
    this.round++;
    this.phase = "question";
    this.deadline = now + this.duration;
    this.answers.clear();
    this.results = [];
    this.teamDamage = 0;
    this.eligible = [...this.players.values()]
      .filter((p) => p.role === "player" && p.hp > 0)
      .map((p) => p.token);
    this.changed();
  }
  submit(
    token: string,
    matchId: string,
    questionId: string,
    choice: number,
    now = Date.now(),
  ) {
    const player = this.player(token);
    if (
      this.phase !== "question" ||
      matchId !== this.matchId ||
      questionId !== this.deck[this.round - 1]?.id
    ) {
      throw new GameError("本题已经结束或暂不可作答");
    }
    if (now >= this.deadline) throw new GameError("本题已经截止");
    if (player.hp === 0) throw new GameError("本局已倒下，只能观战");
    if (!this.eligible.includes(token)) throw new GameError("观战期间不能作答");
    if (!Number.isInteger(choice) || choice < 0 || choice > 3)
      throw new GameError("无效选项");
    if (this.answers.has(token)) return; // 重发不改变第一次答案，也不重复结算。
    this.answers.set(token, choice);
    this.record(`${this.player(token).name} 已提交第 ${this.round} 题`);
    this.changed();
    this.tick(now);
  }
  private resolve(now: number) {
    const question = this.deck[this.round - 1];
    this.results = this.eligible.map((token) => {
      const p = this.player(token);
      const choice = this.answers.get(token) ?? null;
      const correct = choice === question.answer;
      p.attempted++;
      let damage = 0;
      if (correct) {
        p.correct++;
        p.streak++;
        damage = 10 + (p.streak % 3 === 0 ? 5 : 0);
      } else {
        p.hp = Math.max(0, p.hp - 1);
        p.streak = 0;
        if (p.hp === 0) this.record(`${p.name} 已倒下，本局转为旁观`);
      }
      p.damage += damage;
      return { playerId: p.id, name: p.name, choice, correct, damage };
    });
    this.teamDamage =
      this.results.length >= 2 && this.results.every((r) => r.correct) ? 10 : 0;
    this.history.push({
      round: this.round,
      question: question.text,
      answer: question.options[question.answer],
      results: this.results,
      teamDamage: this.teamDamage,
    });
    this.record(
      `第 ${this.round} 题结算：${this.results.filter((r) => r.correct).length} 人答对`,
    );
    this.bossHp = Math.max(
      0,
      this.bossHp -
        this.results.reduce((sum, r) => sum + r.damage, this.teamDamage),
    );
    this.phase = "reveal";
    this.deadline = now + 2000;
    this.changed();
  }
  pause(token: string, now = Date.now()) {
    this.host(token);
    if (this.phase !== "question" && this.phase !== "reveal")
      throw new GameError("当前无法暂停");
    this.resumePhase = this.phase;
    this.remaining = Math.max(0, this.deadline - now);
    this.phase = "paused";
    this.record("挑战已暂停");
    this.changed();
  }
  resume(token: string, now = Date.now()) {
    this.host(token);
    if (this.phase !== "paused") throw new GameError("当前没有暂停");
    this.phase = this.resumePhase;
    this.deadline = now + this.remaining;
    this.record("挑战继续");
    this.changed();
  }
  tick(now = Date.now()) {
    if (this.phase === "question") {
      const online = this.eligible.filter((t) => this.player(t).online);
      if (!online.length) {
        this.pause(this.hostToken, now);
        return;
      }
      if (now >= this.deadline || online.every((t) => this.answers.has(t)))
        this.resolve(now);
    } else if (this.phase === "reveal" && now >= this.deadline) {
      const teamAlive = [...this.players.values()].some(
        (p) => p.hp > 0 && (p.nextRole ?? p.role) === "player",
      );
      if (this.bossHp === 0 || !teamAlive || this.round >= this.totalRounds) {
        this.outcome = this.bossHp === 0 ? "victory" : "defeat";
        this.phase = "finished";
        this.record(
          this.outcome === "victory"
            ? "讨伐成功"
            : !teamAlive
              ? "没有存活参战队员，挑战失败"
              : "题数耗尽，挑战失败",
        );
        this.changed();
      } else this.nextQuestion(now);
    }
  }
  snapshot(token: string, now = Date.now()): Snapshot {
    const me = this.player(token);
    const question = this.deck[this.round - 1];
    const revealed =
      this.phase === "reveal" ||
      this.phase === "finished" ||
      (this.phase === "paused" && this.resumePhase === "reveal");
    return {
      code: this.code,
      phase: this.phase,
      version: this.version,
      serverTime: now,
      deadline: this.deadline,
      hostId: this.player(this.hostToken).id,
      meId: me.id,
      matchId: this.matchId,
      duration: this.duration,
      round: this.round,
      totalRounds: this.totalRounds,
      bossHp: this.bossHp,
      bossMaxHp: this.bossMaxHp,
      players: [...this.players.values()].map(({ token: secret, ...p }) => ({
        ...p,
        submitted: this.answers.has(secret),
      })),
      question: question
        ? { id: question.id, text: question.text, options: question.options }
        : null,
      myAnswer: this.answers.get(token) ?? null,
      answer: revealed ? (question?.answer ?? null) : null,
      explanation: revealed ? (question?.explanation ?? null) : null,
      results: revealed ? this.results : [],
      teamDamage: this.teamDamage,
      outcome: this.outcome,
      activities: token === this.hostToken ? this.activities : [],
      history: token === this.hostToken ? this.history : [],
    };
  }
}
