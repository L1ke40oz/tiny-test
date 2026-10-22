export type Role = "player" | "spectator";
export type Phase = "lobby" | "question" | "reveal" | "paused" | "finished";
export interface PublicPlayer {
  id: string;
  name: string;
  role: Role;
  nextRole?: Role;
  online: boolean;
  hp: number;
  damage: number;
  correct: number;
  attempted: number;
  streak: number;
  submitted: boolean;
}
export interface QuestionView {
  id: string;
  text: string;
  options: string[];
}
export interface RoundResult {
  playerId: string;
  name: string;
  choice: number | null;
  correct: boolean;
  damage: number;
}
export interface Activity {
  id: number;
  time: number;
  text: string;
}
export interface RoundSummary {
  round: number;
  question: string;
  answer: string;
  results: RoundResult[];
  teamDamage: number;
}
export interface Snapshot {
  code: string;
  phase: Phase;
  version: number;
  serverTime: number;
  deadline: number;
  hostId: string;
  meId: string;
  matchId: string;
  duration: number;
  round: number;
  totalRounds: number;
  bossHp: number;
  bossMaxHp: number;
  players: PublicPlayer[];
  question: QuestionView | null;
  myAnswer: number | null;
  answer: number | null;
  explanation: string | null;
  results: RoundResult[];
  teamDamage: number;
  outcome: "victory" | "defeat" | null;
  activities: Activity[];
  history: RoundSummary[];
}
export interface Reply {
  ok: boolean;
  error?: string;
  code?: string;
}
