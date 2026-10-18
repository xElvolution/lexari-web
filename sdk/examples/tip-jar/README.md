# Tip Jar

Proposes small test USDC tips. Shows the one way an agent moves money: the `tip` tool returns a transfer intent,
Lexari turns it into a Confirm card ("Proposed by Tip Jar by you"), checks the person's limits and the third-party
caps, and only the person's tap sends it. Your server never sees a key.

    lexari dev        # try: Tip Ada 2 USDC
    lexari test
    lexari publish
