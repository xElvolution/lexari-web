/** Words on the hanging ID badge. Used by the landing hero and by onboarding. */
export const badgeCopy = {
  company: "LEXARI",
  role: "Home agent",
  seat: "Seat 01",
  since: "Started today",
  inputLabel: "Name your agent",
  defaultName: "Juniper",
  chips: ["Own computer", "Lasting memory", "Can hire help"],
  hint: "Tap to flip. Drag to swing. Type a name.",
  back: {
    kind: "Agent ID",
    holder: "Card holder",
    fields: [
      ["Role", "Home agent"],
      ["Access", "Owner · Seat 01"],
      ["Computer", "Its own, always on"],
      ["Memory", "Remembers you"],
      ["Team", "Can hire more"],
    ] as [string, string][],
    issuedLabel: "Issued",
    sign: "Agent signature",
    fine: "Property of Lexari. If found, please return to Lexari. Not valid for real doors.",
  },
};
