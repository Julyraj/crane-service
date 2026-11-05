export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function whatsappUrl(phone10: string, text: string): string {
  return `https://wa.me/91${phone10}?text=${encodeURIComponent(text)}`;
}

export function upiUrl(opts: { upiId: string; payee: string; amount: number; note: string }): string {
  const p = new URLSearchParams({
    pa: opts.upiId,
    pn: opts.payee,
    am: opts.amount.toFixed(2),
    cu: "INR",
    tn: opts.note,
  });
  return `upi://pay?${p.toString()}`;
}
