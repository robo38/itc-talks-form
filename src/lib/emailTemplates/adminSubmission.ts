interface AdminSubmissionTemplateInput {
  attendeeName: string;
  attendeeEmail: string;
  registrationId: string;
  ticketToken: string;
  customFields: Record<string, string>;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function adminSubmissionTemplate(input: AdminSubmissionTemplateInput): {
  subject: string;
  html: string;
  text: string;
} {
  const fields = Object.entries(input.customFields);
  const fieldsHtml = fields.length > 0
    ? fields
        .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</li>`)
        .join("")
    : "<li>No custom fields submitted.</li>";

  const fieldsText = fields.length > 0
    ? fields.map(([key, value]) => `- ${key}: ${value}`).join("\n")
    : "- No custom fields submitted.";

  const subject = `New Tripetto registration: ${input.attendeeName}`;

  const html = `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f7fb;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;background:#ffffff;border-radius:14px;border:1px solid #dbe4ee;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;background:#0f172a;color:#ffffff;font-family:Arial,sans-serif;">
              <h2 style="margin:0;font-size:20px;">New Tripetto Submission</h2>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;font-family:Arial,sans-serif;color:#111827;font-size:14px;line-height:1.6;">
              <p style="margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(input.attendeeName)}</p>
              <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(input.attendeeEmail)}</p>
              <p style="margin:0 0 8px;"><strong>Registration ID:</strong> ${escapeHtml(input.registrationId)}</p>
              <p style="margin:0 0 14px;"><strong>Ticket token:</strong> ${escapeHtml(input.ticketToken)}</p>
              <p style="margin:0 0 8px;"><strong>Custom fields</strong></p>
              <ul style="margin:0;padding-left:18px;">${fieldsHtml}</ul>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;

  const text = [
    "New Tripetto submission",
    "",
    `Name: ${input.attendeeName}`,
    `Email: ${input.attendeeEmail}`,
    `Registration ID: ${input.registrationId}`,
    `Ticket token: ${input.ticketToken}`,
    "",
    "Custom fields:",
    fieldsText,
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}
