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

export function attendeeConfirmationTemplate(input: ConfirmationTemplateInput): {
  subject: string;
  html: string;
  text: string;
} {
  const safeName = sanitizeHtml(input.attendeeName);
  const safeRegistrationId = sanitizeHtml(input.registrationId);
  const safeQrImageUrl = sanitizeHtml(input.qrCodeImageUrl);

  const subject = "Your event ticket and QR check-in pass";

  const html = `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f2f5f8;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dde6ef;">
          <tr>
            <td style="padding:28px;background:#0f172a;color:#ffffff;font-family:Arial,sans-serif;">
              <h1 style="margin:0;font-size:24px;line-height:1.2;">Event Registration Confirmed</h1>
              <p style="margin:10px 0 0;font-size:14px;opacity:0.92;">Your ticket is ready. Please keep this email for check-in.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px 8px;font-family:Arial,sans-serif;color:#1f2937;">
              <p style="margin:0 0 10px;font-size:16px;">Hi <strong>${safeName}</strong>,</p>
              <p style="margin:0;font-size:15px;line-height:1.6;">Thanks for registering. Present the QR code below at the entrance.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 28px 16px;">
              <img src="${safeQrImageUrl}" alt="Ticket QR Code" width="220" height="220" style="display:block;border-radius:12px;border:1px solid #d1d5db;background:#ffffff;padding:10px;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 22px;font-family:Arial,sans-serif;color:#374151;">
              <p style="margin:0 0 8px;font-size:14px;"><strong>Registration ID:</strong> ${safeRegistrationId}</p>
              <p style="margin:0 0 8px;font-size:14px;"><strong>Event details:</strong> Venue, date, and time go here.</p>
              <p style="margin:0;font-size:13px;color:#6b7280;word-break:break-all;">Ticket reference: ${sanitizeHtml(input.qrValue)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;color:#6b7280;font-size:12px;line-height:1.5;">
              This message was sent automatically. If you need help, reply to this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;

  const text = [
    `Hi ${input.attendeeName},`,
    "",
    "Your event registration is confirmed.",
    `Registration ID: ${input.registrationId}`,
    "",
    "Present your QR code at check-in.",
    `Ticket URL: ${input.qrValue}`,
    "",
    "Event details: Venue, date, and time go here.",
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}
