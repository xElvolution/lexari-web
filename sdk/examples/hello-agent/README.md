# Hello Agent

The smallest Lexari agent: a persona and one read tool (`time_in`).

    lexari dev        # chat with it (or /call time_in {"zone":"Africa/Lagos"})
    lexari test       # the red-team pack
    lexari publish    # submit for review; store the webhook secret it shows once

Run `server.ts` on your own HTTPS host with `LEXARI_WEBHOOK_SECRET` and `LEXARI_TOOL_URL` set.
