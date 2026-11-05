import type { AppConfig } from "./config.ts";

export interface SmsSender {
  sendOtp(phone: string, code: string): Promise<void>;
}

export function createSmsSender(config: AppConfig): SmsSender {
  if (config.sms.provider === "msg91") {
    const { msg91AuthKey, msg91TemplateId } = config.sms;
    if (!msg91AuthKey || !msg91TemplateId) throw new Error("MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required");
    return {
      async sendOtp(phone, code) {
        const url = new URL("https://control.msg91.com/api/v5/otp");
        url.searchParams.set("template_id", msg91TemplateId);
        url.searchParams.set("mobile", `91${phone}`);
        url.searchParams.set("otp", code);
        const res = await fetch(url, { method: "POST", headers: { authkey: msg91AuthKey, "content-type": "application/json" }, body: "{}" });
        if (!res.ok) throw new Error(`SMS provider failed with ${res.status}`);
      },
    };
  }
  return {
    async sendOtp(phone, code) {
      // Console provider: development / self-hosted without SMS gateway.
      console.log(`[otp] ${phone.slice(0, 2)}******${phone.slice(-2)} → ${config.devOtp ? code : "(hidden)"}`);
    },
  };
}
