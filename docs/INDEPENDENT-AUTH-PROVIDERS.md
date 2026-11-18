# Independent sign-in provider setup

The login UI supports email OTP and Saudi mobile SMS OTP. Provider credentials are server-only and must never use a `VITE_` prefix.

## Email OTP

Configure these server environment variables:

- `RESEND_API_KEY`
- `ALASSAUL_AUTH_EMAIL_FROM` (a sender/domain verified with Resend)
- `ALASSAUL_OWNER_EMAIL` (the verified owner email)

## Saudi phone OTP

The SMS adapter currently uses Twilio Verify. Configure:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `ALASSAUL_OWNER_PHONE` (owner phone in E.164, e.g. `+9665XXXXXXXX`)

The API accepts Saudi local mobile format (`05XXXXXXXX`) and normalizes it to E.164 before calling Verify. A successfully verified owner phone maps to the same stable local account as the owner email; other verified phones receive their own local identity.

**Saudi delivery caveat:** Twilio's current Saudi Arabia SMS guidance requires a registered Alphanumeric Sender ID for supported traffic and documents restrictions for Saudi-based domestic brands. Confirm the account's Saudi sender-ID eligibility and Verify Geo Permissions before enabling this method. Do not assume SMS delivery works until a real end-to-end test reaches the owner's device.

## Deployment safety

Do not add these values to source code, client-side variables, or chat messages. Add them only as server environment variables after the provider account and sender eligibility are confirmed. The Neon migration `drizzle/neon/0005_email_login_codes.sql` must be reviewed and applied separately; it is not run automatically by the app. Production deployment and live database changes remain a separate approval step.
