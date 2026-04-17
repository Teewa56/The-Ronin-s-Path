import WebSocket from "ws";
import pino from "pino";

const log = pino({ name: "feed" });

// ─── Event shape coming off the live feed ───────────────────────────────────

export type FeedEventType =
  | "fight_scheduled"   // fight card confirmed — open prediction window
  | "fight_start"       // fighters walk in — close prediction window
  | "knockdown"
  | "submission_attempt"
  | "cut_stoppage"
  | "near_finish"
  | "death_blow_result" // oracle closes a previously opened death blow moment
  | "fight_end";        // official result from promotion

export interface FeedEvent {
  type: FeedEventType;
  fight_id: string;
  fighter_a?: string;
  fighter_b?: string;
  event_name?: string;

  // fight_end payload
  outcome?: "KO" | "SUBMISSION" | "DECISION" | "DQ";
  round?: number;
  winner?: string;

  // death_blow_result payload
  moment_id?: string;   // on-chain DeathBlowMoment object ID
  correct_answer?: boolean;
  // fight_start payload
  fight_pool_id?: string;
  fightPoolId?: string;
  // death_blow prompt (knockdown / near_finish etc.)
  prompt?: string;

  timestamp_ms: number;
}

export type FeedHandler = (event: FeedEvent) => void;

// ─── Feed listener ────────────────────────────────────────────────────────────

export class FightFeed {
  private ws: WebSocket | null = null;
  private handlers: FeedHandler[] = [];
  private reconnectDelay = 3_000;
  private stopping = false;

  constructor(private readonly url: string) {}

  onEvent(handler: FeedHandler): void {
    this.handlers.push(handler);
  }

  start(): void {
    this.connect();
  }

  stop(): void {
    this.stopping = true;
    this.ws?.close();
  }

  private connect(): void {
    log.info({ url: this.url }, "Connecting to fight feed");

    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      log.info("Feed connected");
      this.reconnectDelay = 3_000;
    });

    this.ws.on("message", (raw: WebSocket.RawData) => {
      try {
        const event: FeedEvent = JSON.parse(raw.toString());
        this.dispatch(event);
      } catch (err) {
        log.warn({ err, raw: raw.toString() }, "Malformed feed message");
      }
    });

    this.ws.on("close", (code) => {
      log.warn({ code }, "Feed disconnected");
      if (!this.stopping) {
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      }
    });

    this.ws.on("error", (err) => {
      log.error({ err }, "Feed error");
    });
  }

  private dispatch(event: FeedEvent): void {
    log.info({ type: event.type, fight_id: event.fight_id }, "Feed event");
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        log.error({ err }, "Handler threw");
      }
    }
  }
}

// ─── Death blow prompt builder ────────────────────────────────────────────────

export function buildDeathBlowPrompt(event: FeedEvent): string {
  if (event.prompt) return event.prompt;

  switch (event.type) {
    case "knockdown":
      return "Will there be another knockdown in the next 60 seconds?";
    case "submission_attempt":
      return "Will this submission attempt succeed in the next 60 seconds?";
    case "cut_stoppage":
      return "Will the doctor stop the fight due to this cut in the next 60 seconds?";
    case "near_finish":
      return "Will there be a finish in the next 60 seconds?";
    default:
      return "Will there be a fight-ending moment in the next 60 seconds?";
  }
}