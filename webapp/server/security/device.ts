/** Device labels for "Where you're signed in": a short name from the user agent and a coarse network hint. */

export function deviceName(ua: string) {
  const app = /^LexariAndroid\/[0-9.]+\s*\(([^)]{1,40})\)/.exec(ua || "");
  if (app) return `Lexari Android · ${app[1].trim()}`;
  const u = ua || "";
  const browser = /Edg\//.test(u) ? "Edge" : /OPR\/|Opera/.test(u) ? "Opera" : /SamsungBrowser/.test(u) ? "Samsung Internet" : /Firefox\//.test(u) ? "Firefox"
    : /CriOS|Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : /curl|node|python|axios|Go-http/i.test(u) ? "Script" : "Browser";
  const os = /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Android" : /Windows/.test(u) ? "Windows" : /Mac OS X|Macintosh/.test(u) ? "Mac"
    : /CrOS/.test(u) ? "ChromeOS" : /Linux/.test(u) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

/** Never the full address: the first two parts of an IPv4 address, or the first two groups of an IPv6 one. */
export function ipHint(ip: string) {
  if (!ip || ip === "direct" || ip === "unknown") return "";
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.split(".").slice(0, 2).join(".") + ".x.x";
  if (ip.includes(":")) return ip.split(":").slice(0, 2).join(":") + ":…";
  return "";
}
