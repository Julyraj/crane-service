import path from "node:path";
import { DEFAULT_YARD } from "@crane/shared";

export interface AppConfig {
  port: number;
  production: boolean;
  dataDir: string;
  adminPhones: string[];
  corsOrigins: string[];
  devOtp: boolean;
  otpSecret: string;
  sms: { provider: "console" | "msg91"; msg91AuthKey?: string; msg91TemplateId?: string };
  business: {
    name: string;
    phone: string;
    upiId: string | null;
    gstin: string | null;
    address: string;
    yard: { lat: number; lng: number };
  };
  uiDist: string | null;
}

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === "production";
  const devOtp = env.DEV_OTP ? env.DEV_OTP === "true" : !production;
  if (production && devOtp) {
    throw new Error("DEV_OTP must not be enabled in production");
  }
  const otpSecret = env.OTP_SECRET ?? (production ? "" : "dev-only-otp-secret");
  if (!otpSecret) throw new Error("OTP_SECRET is required in production");
  return {
    port: Number(env.PORT ?? 4100),
    production,
    dataDir: path.resolve(env.DATA_DIR ?? "./data"),
    adminPhones: list(env.ADMIN_PHONES),
    corsOrigins: list(env.CORS_ORIGINS ?? "capacitor://localhost,http://localhost"),
    devOtp,
    otpSecret,
    sms: {
      provider: env.SMS_PROVIDER === "msg91" ? "msg91" : "console",
      msg91AuthKey: env.MSG91_AUTH_KEY,
      msg91TemplateId: env.MSG91_TEMPLATE_ID,
    },
    business: {
      name: env.BUSINESS_NAME ?? "Sri Venkateswara Crane Service",
      phone: env.BUSINESS_PHONE ?? "9789473129",
      upiId: env.BUSINESS_UPI_ID || null,
      gstin: env.BUSINESS_GSTIN || null,
      address: env.BUSINESS_ADDRESS ?? "Salem, Tamil Nadu",
      yard: {
        lat: env.YARD_LAT ? Number(env.YARD_LAT) : DEFAULT_YARD.lat,
        lng: env.YARD_LNG ? Number(env.YARD_LNG) : DEFAULT_YARD.lng,
      },
    },
    uiDist: env.UI_DIST ?? null,
  };
}
