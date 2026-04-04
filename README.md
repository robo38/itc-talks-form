# Tripetto Event Registration and QR Check-In

Production-ready Next.js App Router application in TypeScript for:

1. Receiving Tripetto webhook submissions
2. Creating attendee registrations in PostgreSQL (Prisma)
3. Generating secure ticket tokens and QR codes
4. Sending attendee confirmation emails over SMTP (Nodemailer)
5. Running protected staff-only check-in workflows

## Tech Stack

1. Next.js App Router + TypeScript
2. Tailwind CSS
3. Zod validation
4. Prisma + PostgreSQL
5. QRCode package (`qrcode`)
6. Nodemailer (SMTP)

## File Structure

```text
prisma/
	schema.prisma
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
		email.ts
		emailTemplates/
			attendeeConfirmation.ts
		extractTripettoFields.ts
		generateQrCode.ts
		generateRegistrationId.ts
		generateTicketToken.ts
		tripettoSignature.ts
middleware.ts
postcss.config.mjs
.env.example
```

## Environment Variables

Copy `.env.example` into `.env.local` and set values.

```bash
cp .env.example .env.local
```

Required values:

1. `DATABASE_URL` for PostgreSQL
2. `TRIPETTO_WEBHOOK_SECRET`
3. `APP_BASE_URL`
4. `STAFF_AUTH_SECRET`
5. `STAFF_LOGIN_PASSWORD`
6. `EVENT_FROM_EMAIL`

Email transport behavior:

1. Email is sent via SMTP using Nodemailer.
2. Configure SMTP credentials in environment variables.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Generate Prisma client:

```bash
npm run prisma:generate
```

3. Run migrations (or first migration):

```bash
npm run prisma:migrate -- --name init
```

4. Start dev server:

```bash
npm run dev
```

## API Endpoints

### 1) Tripetto webhook

`POST /api/tripetto-webhook`

Behavior:

1. Validates signature (`x-tripetto-signature`, `tripetto-signature`, or `x-webhook-signature`)
2. Parses payload and extracts attendee fields
3. Creates registration record with unique `registrationId` and `ticketToken`
4. Builds secure QR value (`APP_BASE_URL/staff/check-in?token=...`)
5. Sends styled HTML confirmation email with embedded QR image

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

1. Verifies authenticated staff session
2. Resolves attendee by token
3. Returns attendee status for lookup
4. If confirmed and not already checked in, updates:
	 - `checkInStatus = checked_in`
	 - `checkedInAt`
	 - `checkedInBy`

### 3) Registration lookup

`GET /api/registration/[token]` (protected)

Returns attendee details and check-in status.

### 4) Staff summary

`GET /api/staff/summary` (protected)

Returns total registrations and checked-in counts (used for simple dashboard view).

## Staff Authentication

1. Staff sign in at `/staff/login` using `STAFF_LOGIN_PASSWORD`
2. Server sets signed HTTP-only session cookie
3. `middleware.ts` blocks access to staff pages and staff APIs without session cookie
4. Protected route handlers verify the signed session server-side

This ensures public QR scans do not mutate check-in state.

## Tripetto Payload Extraction

Extraction logic is modular in `src/lib/extractTripettoFields.ts` and can be adjusted without touching the webhook route.

Current extraction supports fallback paths for:

1. Full name
2. Email
3. Phone
4. Custom answer fields

Example payload shape handled:

```json
{
	"event": "tripetto.form.completed",
	"data": {
		"respondent": {
			"name": "Ada Lovelace",
			"email": "ada@example.com",
			"phone": "+1-555-0100"
		},
		"answers": [
			{
				"question": { "label": "Company" },
				"value": "Analytical Engines Ltd"
			}
		]
	}
}
```

## Check-In Flow

1. Staff open `/staff/check-in`
2. Scan QR via camera when browser supports `BarcodeDetector`
3. Manual token entry is always available
4. Staff can lookup attendee first, then confirm check-in
5. Already checked-in tickets are handled safely (no duplicate mutation)

## Vercel Deployment

1. Push project to GitHub
2. Import repo in Vercel
3. Set environment variables from `.env.example`
4. Set `APP_BASE_URL` to your production URL
5. Configure PostgreSQL and `DATABASE_URL`
6. Run Prisma migrations in CI/CD or via deploy command:

```bash
npm run prisma:deploy
```

## Connect Tripetto Webhook

1. Deploy app and get your production URL, e.g. `https://your-app.vercel.app`
2. In Tripetto webhook settings set endpoint to:
	 `https://your-app.vercel.app/api/tripetto-webhook`
3. Configure secret in Tripetto and match `TRIPETTO_WEBHOOK_SECRET`
4. Send a test submission from Tripetto
5. Verify registration row in DB and confirmation email delivery

## Create Staff Login and Test

1. Set `STAFF_LOGIN_PASSWORD` in environment
2. Visit `/staff/login`
3. Sign in and open `/staff/check-in`
4. Use token from generated QR URL or from DB
5. Confirm check-in and verify DB fields updated (`checkedInAt`, `checkedInBy`, `checkInStatus`)

## Security Notes

1. QR encodes only secure token URL, not personal PII.
2. Public QR scans cannot check in attendees without staff authentication.
3. Webhook signatures are verified before processing payload.
4. Sensitive settings are read only from environment variables.
