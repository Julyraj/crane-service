import type { Response } from "express";
import type { User } from "@crane/shared";

interface Subscriber {
  user: User;
  res: Response;
}

/** Server-sent events hub. Each subscriber receives payloads rendered for its own role. */
export class RealtimeHub {
  private subs = new Set<Subscriber>();

  add(user: User, res: Response) {
    const sub = { user, res };
    this.subs.add(sub);
    res.on("close", () => this.subs.delete(sub));
  }

  /**
   * @param audience user ids that may receive the event (admins always receive it)
   * @param render builds the payload per viewer; return null to skip
   */
  publish(event: string, audience: (string | null)[], render: (viewer: User) => unknown) {
    for (const sub of this.subs) {
      if (sub.user.role !== "admin" && !audience.includes(sub.user.id)) continue;
      const data = render(sub.user);
      if (data == null) continue;
      sub.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  heartbeat() {
    for (const sub of this.subs) sub.res.write(`: ping\n\n`);
  }

  get size() {
    return this.subs.size;
  }
}
