# Integrate your protocol with Lexari

Every protocol Lexari agents can use lives in this folder, one folder per protocol. The Integrations page in the app is
built from it. To add yours, open a pull request against `main`.

## What you get
Once your pull request is merged, your protocol shows on the Integrations page and becomes a dApp people can add to
their team. Their agents call your tools with the same safety rules as every third-party agent on Lexari:

- Your tools are HTTPS endpoints you run. Lexari signs every call (`x-lexari-signature`, verified by `@lexari/sdk`) and
  sends only the tool input and pseudonymous ids. Your code never sees a key, a wallet or an account.
- Money only moves through intents your tool declares (`transfer` or `swap`). Each one becomes a Confirm card,
  labelled "Proposed by <your protocol>", inside the person's limits and the third-party caps ($5 each, $20 a day).
  Nothing is ever signed without the person's tap.
- Testnet and devnet only during the alpha. Agents can't sign directly, and dApps get no computer, email or wallet tools.

## How to apply
1. Fork `xElvolution/lexari` and copy `integrations/TEMPLATE` to `integrations/<your-slug>/`.
2. Fill in `integration.json` (see `schema.json` for every field):
   name, description, chains, contract addresses, website, docs and API, contact, what agents can do (`actions`),
   and an `agent` block: a Lexari agent manifest whose `id` is your slug, listing your tools. Keep `status` as `in-review`
   and `kind` as `dapp`.
3. Add a square `logo.svg` (no scripts or external references) or `logo.png` (at least 64 px), up to 200 KB, and a
   short `README.md`.
4. Build your tools with `@lexari/sdk` (see `sdk/examples/tip-jar`) and run `lexari test` against your endpoint.
5. Check the folder: `npx tsx integrations/scripts/validate.ts`. CI runs the same checks on your pull request.
6. Open the pull request. Title it `Integration: <name>`.

## Review
A Lexari reviewer checks the entry, calls your tools on testnet and reads every intent they can return. On approval we
set `status` to `live-testnet` or `live-devnet`, run `validate.ts --write` (which refreshes the app's copy and logos),
merge, and send your webhook signing secret to the contact on file privately. Changes later go through a new pull
request. Pull requests that ask for keys, move money outside intents, or point tools at private hosts are closed.

Plain language, no em dashes. Entries with `kind: "built-in"` are Lexari's own connectors and only Lexari adds them.
