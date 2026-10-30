# Phone parity

| Web | Phone |
|---|---|
| Sign in (wallet, Google, email) | `app/(auth)/sign-in.tsx` — MWA plus Privy when the app id is set |
| Hub | `app/(tabs)/hub.tsx` |
| Agents | `app/(tabs)/agents.tsx` and `app/agents/[slug].tsx` |
| Chat | `app/chat/[slug].tsx` |
| Confirm / receipt | `app/confirm/[id].tsx`, `app/receipt/[id].tsx` |
| Wallet | `app/(tabs)/wallet.tsx` |
| Top up / SKR | `app/topup.tsx` |
| Marketplace / hire | `app/(tabs)/marketplace.tsx`, `app/marketplace/[slug].tsx` |
| Call | `app/call/[slug].tsx` |
| Agent computer | `app/desktop/[slug].tsx` |
| Secrets | `app/settings/secrets.tsx` |
| Security | `app/settings/security.tsx` |
| Models | `app/settings/models.tsx` |
| Billing | `app/settings/billing.tsx` |
| Integrations | `app/settings/integrations.tsx` |
| Notifications | `app/settings/notifications.tsx` |
| Brain | `app/brain.tsx` |
| Team | `app/team.tsx` |
| Tasks | `app/tasks.tsx` |
| Miner | `app/miner.tsx` |
| Onboarding | `app/onboarding.tsx` |
| Me (profile) | `app/(tabs)/me.tsx` |

Deep links: `lexari://hub`, `lexari://agents/<slug>`, `lexari://chat/<slug>`, `lexari://confirm/<id>`, `lexari://receipt/<id>`, `lexari://topup`, `lexari://settings/security`.
