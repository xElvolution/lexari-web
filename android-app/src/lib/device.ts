export type DeviceFacts = { brand?: string | null; manufacturer?: string | null; model?: string | null };

/** Seeker and Saga get Seed Vault first. Every other Android phone still runs the full app. */
export function isSolanaMobile(info: DeviceFacts): boolean {
  const brand = `${info.brand || ""} ${info.manufacturer || ""}`.toLowerCase();
  const model = (info.model || "").toLowerCase();
  return brand.includes("solanamobile") || model === "seeker" || model === "saga";
}

export function userAgent(version: string, model: string): string {
  const clean = model.replace(/[^\w .+-]/g, "").slice(0, 40) || "Android";
  return `LexariAndroid/${version} (${clean})`;
}
