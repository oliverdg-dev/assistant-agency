// Wires the staff inbox to real services: Neon in production, the local
// database in development, Resend or the terminal for email.
import type { AdminDeps, ClientUpdate } from "./adminApi.js";
import { buildCodeEmail, staffDomainsFromEnv, type StaffUser } from "./auth.js";
import { escapeHtml, readEmailConfig, sendEmail, type EmailConfig, type OutgoingEmail } from "./bookingEmail.js";
import { BRAND } from "./brand.js";
import { databaseUrlFromEnv, neonHttpDb, type Db } from "./db.js";
import type { ApiRequest } from "./http.js";
import { siteUrlFromEnv } from "./shortlist.js";
import { buildShortlistChoicesEmail, buildShortlistLinkEmail } from "./shortlistEmail.js";

// "Maria Santos at Your Agency <requests@agency.com>": the client sees a named
// person, and replies go to that person.
export const senderFor = (author: StaffUser, from: string): string => {
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const name = (author.name || author.email.split("@")[0]).replace(/["<>\r\n]/g, "").trim();
  return `${name} at ${BRAND.name.replace(/["<>\r\n]/g, "")} <${address}>`;
};

// Staff write the body; it is escaped and kept as plain paragraphs.
export const buildClientUpdateEmail = (update: ClientUpdate): OutgoingEmail => {
  const greeting = `Hi ${update.clientFirstName.trim().split(/\s+/)[0] || "there"},`;
  const about = [
    `Role: ${update.role}`,
    update.stage ? `Stage: ${update.stage}` : null,
    update.reference ? `Reference ID: ${update.reference}` : null,
  ].filter((line): line is string => Boolean(line));
  const signature = update.author.name || update.author.email;
  const replyLine = "Reply to this email to reach me directly.";

  const paragraphs = update.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#0f1f3a">
    <p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
    ${paragraphs.map((p) => `<p style="margin:0 0 12px;white-space:pre-wrap">${escapeHtml(p)}</p>`).join("")}
    <p style="margin:16px 0 4px">${escapeHtml(signature)}</p>
    <p style="margin:0 0 16px;color:#4a5568">${escapeHtml(BRAND.name)}</p>
    <div style="padding:12px 16px;border:1px solid #e4e2dc;border-radius:8px;background:#fafaf8;color:#4a5568">
      ${about.map((line) => `<p style="margin:0 0 4px">${escapeHtml(line)}</p>`).join("")}
    </div>
    <p style="margin:16px 0 0;color:#4a5568">${escapeHtml(replyLine)}</p>
  </div>`;
  const text = [greeting, "", ...paragraphs.flatMap((p) => [p, ""]), signature, BRAND.name, "", ...about, "", replyLine].join("\n");

  return {
    to: [update.to],
    replyTo: update.author.email,
    subject: `Update on your ${update.role} request`,
    html,
    text,
  };
};

type Senders = Pick<AdminDeps, "sendCode" | "sendClientUpdate" | "sendShortlistLink" | "sendShortlistChoices">;

const realSenders = (config: EmailConfig): Senders => ({
  sendCode: async (user, code) => {
    const email = buildCodeEmail(user, code);
    const result = await sendEmail({ ...email, replyTo: config.internalTo }, "sign-in-code", `user=${user.id}`, { config });
    return result === "sent";
  },
  sendClientUpdate: (update) =>
    sendEmail(buildClientUpdateEmail(update), "client-update", `user=${update.author.id}`, {
      config: { ...config, from: senderFor(update.author, config.from) },
    }),
  sendShortlistLink: (message) => {
    const email = buildShortlistLinkEmail(message);
    return sendEmail({ ...email, replyTo: email.replyTo || config.internalTo }, "shortlist-link", `user=${message.sender?.id ?? "none"}`, {
      config: message.sender ? { ...config, from: senderFor(message.sender, config.from) } : config,
    });
  },
  // No owner on the request: the team inbox hears instead.
  sendShortlistChoices: (message) =>
    sendEmail(buildShortlistChoicesEmail({ ...message, to: message.to || config.internalTo }), "shortlist-choices", "owner", { config }),
});

// Development: emails print to the terminal (with the sign-in code) when
// Resend isn't configured, like the booking emails.
const printedSenders = (config: EmailConfig): Senders => {
  const print = (email: OutgoingEmail, from: string) =>
    console.info(
      [
        "",
        "──── Email (dev, not sent) ────",
        `From: ${from}`,
        `To: ${email.to.join(", ")}`,
        `Reply-To: ${email.replyTo}`,
        `Subject: ${email.subject}`,
        "",
        email.text,
        "───────────────────────────────",
      ].join("\n"),
    );
  return {
    sendCode: async (user, code) => {
      print({ ...buildCodeEmail(user, code), replyTo: "-" }, "sign-in");
      return true;
    },
    sendClientUpdate: async (update) => {
      print(buildClientUpdateEmail(update), senderFor(update.author, "dev@localhost"));
      return "sent";
    },
    sendShortlistLink: async (message) => {
      print(buildShortlistLinkEmail(message), message.sender ? senderFor(message.sender, "dev@localhost") : "dev@localhost");
      return "sent";
    },
    sendShortlistChoices: async (message) => {
      print(buildShortlistChoicesEmail({ ...message, to: message.to || config.internalTo }), "dev@localhost");
      return "sent";
    },
  };
};

export const adminDepsFor = (db: Db, env = process.env, options: { dev?: boolean } = {}): AdminDeps => {
  const config = readEmailConfig(env);
  const emailConfigured = Boolean(config.apiKey && config.from);
  const senders = options.dev && !emailConfigured ? printedSenders(config) : realSenders(config);
  const configuredSite = siteUrlFromEnv(env);
  return {
    db,
    staffDomains: staffDomainsFromEnv(env),
    secureCookies: !options.dev,
    // Locally, links point at whichever port the dev server is on. Deployed,
    // only configured addresses are used, never request headers.
    siteUrl: options.dev ? (req: ApiRequest) => configuredSite ?? `http://${req.headers.host ?? "localhost:3000"}` : () => configuredSite,
    ...senders,
  };
};

// Production: null when no database is configured.
export const productionAdminDeps = (env = process.env): AdminDeps | null => {
  const url = databaseUrlFromEnv(env);
  return url ? adminDepsFor(neonHttpDb(url), env) : null;
};
