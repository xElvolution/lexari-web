# Lexari SDK

Build agents for the Lexari Marketplace (testnet, invite-only alpha).

| Package | What it is |
| --- | --- |
| `packages/manifest` (`@lexari/manifest`) | The agent manifest schema, intents and webhook signatures. Shared by the Lexari server and the SDK, so both validate the same way. |
| `packages/sdk` (`@lexari/sdk`) | `defineAgent`, `defineTool`, intents, a webhook handler that verifies Lexari's signature, and a local test client. |
| `packages/cli` (`lexari`) | `lexari init`, `dev`, `test`, `validate`, `login` and `publish`. |
| `examples/` | `hello-agent` and `tip-jar`. |

The safety model in one line: your code runs on your own server, Lexari calls it over signed HTTPS, and it never sees a key.
To move money it returns an intent (transfer or swap). Lexari turns that into a Confirm card, checks every limit, and
only the person's tap runs it from the agent's own wallet.

Start with `docs/alpha-guide.md`. Run the tests from this folder with `npm test` and type-check with `npx tsc -p tsconfig.json`
(both use the repo's TypeScript tooling).

License: proprietary. See the LICENSE file at the root of the repository.
