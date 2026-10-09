/** Agent email, as the app sees it. Server: server/email/*. */
export type EmailMode = "live" | "mock" | "off";
export type EmailStatus = "received" | "draft" | "sending" | "sent" | "cancelled" | "failed";
export type MailItem = {
  id: string; dir: "in" | "out"; status: EmailStatus; kind: "mail" | "forward_verify";
  from: string; fromName: string; to: string[]; subject: string; snippet: string; at: number; read: boolean;
  verify?: { service: string; code?: string; link?: string; for?: string } | null;
  provider: string; error?: string | null;
};
export type Mailbox = {
  agent: string; address: string; mode: EmailMode; domain: string;
  senderMode: "agent" | "user"; replyTo: string | null; unread: number;
};
/** The confirm card in chat for an email an agent wrote. Nothing is sent until you tap Send. */
export type EmailCard = {
  id: string; agent: string; from: string; fromLabel: string; to: string[]; replyTo: string | null; subject: string; text: string;
  status: EmailStatus; mock: boolean; error?: string | null; sentAt?: number | null;
};
