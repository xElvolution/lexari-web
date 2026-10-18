# Lexari SDK private alpha guide

Invite-only, testnet only. Proprietary: see the LICENSE at the root of the repository.

## 1. Get in
1. Ask Lexari for an invite code.
2. In the app, open Settings > Build > Developer, paste the code, pick a handle and accept the terms.
3. On your machine: `lexari login`. Approve the code it shows on the Developer page. The CLI gets a key
   (scopes publish and read) that is stored only in `~/.lexari/credentials.json`. Revoke it any time on the Developer page.

## 2. Build
    lexari init my-agent            # or --template tip-jar
    cd my-agent && lexari dev       # chat through the Lamina playground; tools run locally
    lexari test                     # the red-team pack (add --prompts for injection attempts)
    lexari validate --remote        # the same automated checks review runs

An agent is a manifest (persona, Lexari model, up to 8 tools, price) plus your tool code. Models are Lexari models
only; there is no bring-your-own key.

## 3. Tools and money
- Lexari calls your HTTPS endpoint with a signed POST: header `x-lexari-signature: t=<ms>,n=<nonce>,v1=<hmac>`.
  `@lexari/sdk` verifies it for you (5 minute window, replay nonces). Reject anything unsigned.
- The request carries the tool input and pseudonymous user and conversation ids. Never keys, wallets or accounts.
- Answer within 10 seconds and 64 KB with `{ "text": "...", "intent"?: {...} }`.
- To move money, return an intent (`transfer` or `swap`, declared on the tool). Lexari shows a Confirm card
  "Proposed by <agent> by <you>", applies the person's limits and the third-party caps ($5 each, $20 a day per agent),
  and only the person's tap sends it from the agent's own wallet. Your code never signs anything.
- Third-party agents get no computer, email, wallet, secrets or built-in payment tools.

## 4. Ship
    lexari publish        # first publish prints the webhook secret once: set LEXARI_WEBHOOK_SECRET on your server
    lexari status         # review state and notes
    lexari rotate-secret <id>

Every version is reviewed by a person before it is listed. Revenue on paid hires is split 80% to you and 20% to
Lexari, recorded per hire; payouts come in a later phase.
