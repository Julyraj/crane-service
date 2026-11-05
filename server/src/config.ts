import path from "node:path";
import { DEFAULT_YARD } from "@crane/shared";

export interface AppConfig {
  port: number;
  production: boolean;
  dataDir: string;
  adminPhones: string[];
  corsOrigins: string[];
  devOtp: boolean;
  /** "otp" = SMS one-time code; "pin" = mobile + 6-digit PIN (no SMS gateway needed). */
  authMode: "otp" | "pin";
  /** Setup PIN for ADMIN_PHONES numbers in PIN mode (first sign-in). */
  adminPin: string | null;
  otpSecret: string;
  sms: { provider: "console" | "msg91"; msg91AuthKey?: string; msg91TemplateId?: string };
  business: {
    name: string;
    phone: string;
    upiId: string | null;
    gstin: string | null;
    /** SAC code printed on invoices; confirm with your accountant. */
    sac: string;
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
  const smsConfigured = env.SMS_PROVIDER === "msg91";
  const authMode: "otp" | "pin" =
    env.AUTH_MODE === "otp" || env.AUTH_MODE === "pin" ? env.AUTH_MODE : smsConfigured || devOtp ? "otp" : "pin";
  if (production && authMode === "otp" && !smsConfigured) {
    throw new Error("AUTH_MODE=otp needs an SMS provider in production (set SMS_PROVIDER=msg91) or use AUTH_MODE=pin");
  }
  const adminPin = env.ADMIN_PIN?.trim() || null;
  if (authMode === "pin" && adminPin && !/^\d{6}$/.test(adminPin)) throw new Error("ADMIN_PIN must be exactly 6 digits");
  if (production && authMode === "pin" && !adminPin) throw new Error("ADMIN_PIN (6 digits) is required in PIN mode");
  const otpSecret = env.OTP_SECRET ?? (production ? "" : "dev-only-otp-secret");
  if (!otpSecret) throw new Error("OTP_SECRET is required in production");
  return {
    port: Number(env.PORT ?? 4100),
    production,
    dataDir: path.resolve(env.DATA_DIR ?? "./data"),
    adminPhones: list(env.ADMIN_PHONES),
    corsOrigins: list(env.CORS_ORIGINS ?? "https://localhost,capacitor://localhost,http://localhost"),
    devOtp,
    authMode,
    adminPin,
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
      sac: env.BUSINESS_SAC || "997313",
      address: env.BUSINESS_ADDRESS ?? "Salem, Tamil Nadu",
      yard: {
        lat: env.YARD_LAT ? Number(env.YARD_LAT) : DEFAULT_YARD.lat,
        lng: env.YARD_LNG ? Number(env.YARD_LNG) : DEFAULT_YARD.lng,
      },
    },
    uiDist: env.UI_DIST ?? null,
  };
}
