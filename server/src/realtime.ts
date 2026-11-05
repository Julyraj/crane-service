import type { Response } from "express";
import type { User } from "@crane/shared";

interface Subscriber {
  token: string;
  user: User;
  res: Response;
}

/**
 * Server-sent events hub. Each subscriber receives payloads rendered for its own role.
 * The session is looked up again before every event and heartbeat, so logging out,
 * a revoked session or a role change takes effect on open streams immediately.
 */
export class RealtimeHub {
  private subs = new Set<Subscriber>();

  constructor(private resolve: (token: string) => User | undefined) {}

  add(token: string, user: User, res: Response) {
    const sub = { token, user, res };
    this.subs.add(sub);
    res.on("close", () => this.subs.delete(sub));
  }

  /** Returns the current user for the subscriber, or closes the stream if the session is gone. */
  private refresh(sub: Subscriber): User | null {
    const user = this.resolve(sub.token);
    if (!user) {
      this.subs.delete(sub);
      sub.res.end();
      return null;
    }
    sub.user = user;
    return user;
  }

  /**
   * @param audience user ids that may receive the event (admins always receive it)
   * @param render builds the payload per viewer; return null to skip
   */
  publish(event: string, audience: (string | null)[], render: (viewer: User) => unknown) {
    for (const sub of [...this.subs]) {
      const user = this.refresh(sub);
      if (!user) continue;
      if (user.role !== "admin" && !audience.includes(user.id)) continue;
      const data = render(user);
      if (data == null) continue;
      sub.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  heartbeat() {
    for (const sub of [...this.subs]) {
      if (this.refresh(sub)) sub.res.write(`: ping\n\n`);
    }
  }

  get size() {
    return this.subs.size;
  }
}
