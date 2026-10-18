import type { SessionUser } from "../auth/session";
import { HttpError } from "../http";
import { isAdmin } from "./config";

/** Listing review and developer invites: only wallets in ADMIN_WALLETS. */
export function requireAdmin(user: SessionUser) {
  if (!isAdmin(user.wallet)) throw new HttpError(403, "Only Lexari reviewers can open this.");
}
