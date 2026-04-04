# Tripetto Event Registration and QR Check-In

Production-ready Next.js App Router application in TypeScript for:

1. Receiving Tripetto webhook submissions
2. Creating attendee registrations in MongoDB
3. Generating secure ticket tokens and QR codes
4. Sending attendee confirmation emails (Resend preferred, SMTP fallback)
5. Running protected staff-only check-in workflows

## Tech Stack

1. Next.js App Router + TypeScript
2. Tailwind CSS
3. Zod validation
4. MongoDB + Mongoose
5. QRCode package (`qrcode`)
6. Resend API (optional) + Nodemailer SMTP

## File Structure

```text
src/
  app/
    api/
      tripetto-webhook/route.ts
      staff/
        login/route.ts
        logout/route.ts
        check-in/route.ts
        summary/route.ts
      registration/[token]/route.ts
    staff/
      login/page.tsx
      check-in/page.tsx
    layout.tsx
    page.tsx
    globals.css
  components/
    StaffCheckInClient.tsx
  lib/
    auth.ts
    db.ts
    mongodb.ts
    models/
      Registration.ts
    email.ts
    emailTemplates/
      attendeeConfirmation.ts
      adminSubmission.ts
    extractTripettoFields.ts
    generateQrCode.ts
    generateRegistrationId.ts
    generateTicketToken.ts
    tripettoSignature.ts
middleware.ts
.env.example
```

## Environment Variables

Copy `.env.example` into `.env.local` and set values.

```bash
cp .env.example .env.local
```

Required values:

1. `MONGODB_URI`
2. `WEBHOOK_TOKEN`
3. `STAFF_AUTH_SECRET`
4. `STAFF_LOGIN_PASSWORD`
5. `EMAIL_PROVIDER=smtp` (default)
6. `EMAIL_FROM` (or `EVENT_FROM_EMAIL` / `SMTP_USER` fallback)

Optional values:

1. `MONGODB_DB_NAME` (recommended)
2. `APP_BASE_URL` (if empty on Vercel, `VERCEL_URL` is used)
3. `TRIPETTO_WEBHOOK_SECRET` (optional signature hardening)
4. `ADMIN_EMAIL` (send admin copy)
5. `RESEND_API_KEY` (only needed when `EMAIL_PROVIDER=resend`)

## MongoDB Setup

### Option 1: Local MongoDB

1. Install MongoDB Community Edition.
2. Start MongoDB locally (`mongod`).
3. Use `MONGODB_URI=mongodb://localhost:27017/tripetto_event`.
4. Set `MONGODB_DB_NAME=tripetto_event`.

### Option 2: MongoDB Atlas

1. Create a free cluster in MongoDB Atlas.
2. Create a database user and allow your app IP in Network Access.
3. Copy the connection string and set it as `MONGODB_URI`.
4. Set `MONGODB_DB_NAME` to your database name.

No Prisma schema generation or migrations are required.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

## API Endpoints

### 1) Tripetto webhook

`POST /api/tripetto-webhook?token=YOUR_SECRET`

Behavior:

1. Validates `token` query parameter against `WEBHOOK_TOKEN`.
2. Reads raw body via `request.text()` and logs headers + raw payload.
3. Optionally validates signature when both signature header and `TRIPETTO_WEBHOOK_SECRET` exist.
4. Extracts attendee fields from both flat Tripetto payload keys and alternative nested formats.
5. Stores registration in MongoDB with `registrationId`, `ticketToken`, status, metadata, payload, and timestamps.
6. Builds secure QR value (`APP_BASE_URL/staff/check-in?token=...`).
7. Sends attendee email and optionally admin notification email.

### 2) Staff check-in mutation

`POST /api/staff/check-in` (protected)

Input JSON:

```json
{
  "token": "ticket-token",
  "confirm": true
}
```

Behavior:

1. Verifies authenticated staff session.
2. Looks up attendee by `ticketToken`.
3. Returns attendee status for lookup.
4. If confirmed and not already checked in, updates check-in fields.

### 3) Registration lookup

`GET /api/registration/[token]` (protected)

Returns attendee details and check-in status.

### 4) Staff summary

`GET /api/staff/summary` (protected)

Returns total registrations, checked-in count, and recent registrations.

## Check-In Flow

1. Staff open `/staff/check-in`.
2. Scan QR via camera when browser supports `BarcodeDetector`.
3. Manual token entry is always available.
4. Staff can lookup attendee first, then confirm check-in.
5. Already checked-in tickets are handled safely.

## Vercel Deployment

1. Push project to GitHub.
2. Import repo in Vercel.
3. Set environment variables from `.env.example`.
4. If you do not use a custom domain, leave `APP_BASE_URL` empty and Vercel default domain will be used.
5. Ensure `MONGODB_URI` and `MONGODB_DB_NAME` are set.

## Connect Tripetto Webhook

1. Deploy app and get your production URL, for example `https://your-app.vercel.app`.
2. In Tripetto webhook settings set endpoint to:
   `https://your-app.vercel.app/api/tripetto-webhook?token=YOUR_SECRET`
3. Set `WEBHOOK_TOKEN=YOUR_SECRET` in deployment environment variables.
4. Send a test submission from Tripetto.
5. Verify registration document in MongoDB and confirmation email delivery.

## Security Notes

1. QR encodes only secure token URL, not personal PII.
2. Public QR scans cannot check in attendees without staff authentication.
3. Webhook requests require a secret URL token before processing.
4. Signature validation is available as an optional hardening layer.
5. Sensitive settings are read only from environment variables.
