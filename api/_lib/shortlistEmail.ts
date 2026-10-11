import { escapeHtml, type OutgoingEmail } from "./bookingEmail.js";
import { BRAND } from "./brand.js";
import { SHORTLIST_LINK_DAYS } from "./requestStatus.js";
import type { ShortlistChoicesMessage, ShortlistLinkMessage } from "./shortlist.js";

// "Wednesday, October 14"
export const formatRespondBy = (date: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

const STYLE = "font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#0f1f3a";

// To the client. One button, with the plain link underneath for email apps
// that strip buttons.
export const buildShortlistLinkEmail = (message: ShortlistLinkMessage): OutgoingEmail => {
  const first = message.clientFirstName.trim().split(/\s+/)[0] || "there";
  const people = message.count === 1 ? "1 candidate" : `${message.count} candidates`;
  const intro = `We've picked ${people} for your ${message.role} role. Have a look and tell us who you'd like to interview.`;
  const respond = message.respondBy ? `It helps us most if you can reply by ${formatRespondBy(message.respondBy)}.` : "";
  const privacy = `This link is just for you and works for ${SHORTLIST_LINK_DAYS} days. Please don't forward it.`;
  const signature = message.sender ? message.sender.name || message.sender.email : `The ${BRAND.name} team`;

  const html = `
  <div style="${STYLE}">
    <p style="margin:0 0 12px">Hi ${escapeHtml(first)},</p>
    <p style="margin:0 0 20px">${escapeHtml(intro)}</p>
    <p style="margin:0 0 8px"><a href="${escapeHtml(message.url)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#0047b3;color:#ffffff;font-weight:600;text-decoration:none">Review the shortlist</a></p>
    <p style="margin:0 0 20px;font-size:13px;color:#4a5568">Or copy this link: <a href="${escapeHtml(message.url)}" style="color:#0047b3;word-break:break-all">${escapeHtml(message.url)}</a></p>
    ${respond ? `<p style="margin:0 0 12px">${escapeHtml(respond)}</p>` : ""}
    <p style="margin:0 0 16px;color:#4a5568">${escapeHtml(privacy)}</p>
    <p style="margin:0">${escapeHtml(signature)}<br><span style="color:#4a5568">${escapeHtml(BRAND.name)}</span></p>
    ${message.reference ? `<p style="margin:16px 0 0;font-size:13px;color:#4a5568">Reference ID: ${escapeHtml(message.reference)}</p>` : ""}
  </div>`;
  const text = [
    `Hi ${first},`,
    "",
    intro,
    "",
    `Review the shortlist: ${message.url}`,
    "",
    respond,
    privacy,
    "",
    signature,
    BRAND.name,
    message.reference ? `\nReference ID: ${message.reference}` : "",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");

  return {
    to: [message.to],
    replyTo: message.sender?.email ?? "",
    subject: `Your shortlist for ${message.role} is ready`,
    html,
    text,
  };
};

// To the request owner, when the client sends their choices.
export const buildShortlistChoicesEmail = (message: ShortlistChoicesMessage): OutgoingEmail => {
  const subject = message.allPassed
    ? `${message.company} passed on every candidate (${message.role})`
    : `${message.company} replied to the shortlist (${message.role})`;
  const lines = message.choices.map(
    (choice) => `${choice.name}: ${choice.decision === "interview" ? "Interview" : `Pass${choice.reason ? `, "${choice.reason}"` : ""}`}`,
  );
  const next = message.allPassed
    ? "The request is back in Sourcing."
    : "Next: book the interviews. Reply to this email to reach the client.";
  const html = `
  <div style="${STYLE}">
    <p style="margin:0 0 12px">${escapeHtml(message.clientName)} at ${escapeHtml(message.company)} sent their choices for the ${escapeHtml(message.role)} shortlist:</p>
    <ul style="margin:0 0 16px;padding-left:20px">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    <p style="margin:0 0 12px">${escapeHtml(next)}</p>
    ${message.requestUrl ? `<p style="margin:0"><a href="${escapeHtml(message.requestUrl)}" style="color:#0047b3">Open the request</a></p>` : ""}
  </div>`;
  const text = [
    `${message.clientName} at ${message.company} sent their choices for the ${message.role} shortlist:`,
    "",
    ...lines.map((line) => `- ${line}`),
    "",
    next,
    message.requestUrl ? `Open the request: ${message.requestUrl}` : "",
  ].join("\n");
  return { to: [message.to], replyTo: message.clientEmail, subject, html, text };
};
