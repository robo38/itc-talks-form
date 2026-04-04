import { readFileSync } from "node:fs";
import path from "node:path";

interface ConfirmationTemplateInput {
  attendeeName: string;
  registrationId: string;
  qrCodeImageUrl: string;
  qrValue: string;
}

function sanitizeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

let cachedTemplate: string | null = null;

function loadTemplate(): string {
  if (cachedTemplate) {
    return cachedTemplate;
  }

  const templatePath = path.join(process.cwd(), "src", "lib", "emailTemplates", "attendeeConfirmation.html");
  cachedTemplate = readFileSync(templatePath, "utf8");

  return cachedTemplate;
}

function renderTemplate(template: string, input: ConfirmationTemplateInput): string {
  const replacements: Record<string, string> = {
    attendeeName: sanitizeHtml(input.attendeeName),
    registrationId: sanitizeHtml(input.registrationId),
    qrCodeImageUrl: sanitizeHtml(input.qrCodeImageUrl),
    qrValue: sanitizeHtml(input.qrValue),
  };

  return template
    .replaceAll("{{attendeeName}}", replacements.attendeeName)
    .replaceAll("{{registrationId}}", replacements.registrationId)
    .replaceAll("{{qrCodeImageUrl}}", replacements.qrCodeImageUrl)
    .replaceAll("{{qrValue}}", replacements.qrValue);
}

export function attendeeConfirmationTemplate(input: ConfirmationTemplateInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Your event ticket and QR check-in pass";
  const html = renderTemplate(loadTemplate(), input);

  const text = [
    `Hi ${input.attendeeName},`,
    "",
    "Your event registration is confirmed.",
    `Registration ID: ${input.registrationId}`,
    "",
    "Present your QR code at check-in.",
    `Ticket URL: ${input.qrValue}`,
    "",
    "Event details: ITC Talks 7, April 7, 2026.",
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}
