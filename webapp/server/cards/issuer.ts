/**
 * Card issuers. Today only the built-in devnet issuer exists: it makes TEST card details
 * (Luhn-valid, 4242 test prefix) that cannot be used anywhere real.
 * A real issuer (Stripe Issuing, Lithic, ...) plugs in by implementing CardIssuer and
 * being returned from cardIssuer() when its env is set; the routes do not change.
 */
import crypto from "node:crypto";

export type IssuedCard = { issuer: string; externalId: string | null; number: string; expMonth: number; expYear: number; cvv: string };
export type CardIssuer = {
  id: string;
  test: boolean;
  issue(opts: { holder: string; limit: number }): Promise<IssuedCard>;
  setFrozen?(externalId: string, frozen: boolean): Promise<void>;
  setLimit?(externalId: string, limit: number): Promise<void>;
};

const digit = () => crypto.randomInt(0, 10);

function luhnCheckDigit(body: string) {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    let d = Number(body[body.length - 1 - i]);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return String((10 - (sum % 10)) % 10);
}

export const devnetIssuer: CardIssuer = {
  id: "devnet-test",
  test: true,
  async issue() {
    const body = "424242" + Array.from({ length: 9 }, digit).join("");
    const now = new Date();
    return { issuer: "devnet-test", externalId: null, number: body + luhnCheckDigit(body), expMonth: now.getMonth() + 1, expYear: now.getFullYear() + 3, cvv: Array.from({ length: 3 }, digit).join("") };
  },
};

export function cardIssuer(): CardIssuer {
  return devnetIssuer;
}
