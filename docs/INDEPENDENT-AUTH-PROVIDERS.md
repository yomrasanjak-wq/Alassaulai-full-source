# Independent sign-in provider setup

The login UI supports email OTP and Saudi mobile SMS OTP. Provider credentials are server-only and must never use a `VITE_` prefix.

## Email OTP

Configure these server environment variables:

- `RESEND_API_KEY`
- `ALASSAUL_AUTH_EMAIL_FROM` (a sender/domain verified with Resend)
- `ALASSAUL_OWNER_EMAIL` (the verified owner email)

## Saudi phone OTP

The SMS adapter uses **Unifonic Authenticate**, whose official verification API supports SMS OTP to Saudi-format numbers.

Configure these server environment variables:

- `UNIFONIC_AUTHENTICATE_APP_ID`
- `UNIFONIC_AUTHENTICATE_TOKEN`
- `ALASSAUL_OWNER_PHONE` (owner phone in E.164, e.g. `+9665XXXXXXXX`)

The API accepts Saudi local mobile format (`05XXXXXXXX`) and normalizes it to E.164 before calling Unifonic. It requests a six-digit Arabic SMS code and checks it through Unifonic's verification endpoint. A successfully verified owner phone maps to the same stable local account as the owner email; other verified phones receive their own local identity.

The application also limits each destination to three OTP sends per 15 minutes and ten per 24 hours using a keyed hash of the phone number. Raw phone numbers and OTP values are not written to the request-throttle table or application logs.

Before enabling production SMS, the account owner must complete Unifonic onboarding, obtain an Authenticate application, and confirm that the account's sender ID and Saudi delivery are approved. A successful API response is not proof that a carrier delivered the message; perform a real device test.

## Deployment safety

Do not add these values to source code, client-side variables, or chat messages. Add them only as server environment variables after the provider account and sender eligibility are confirmed. Neon migrations `0005_email_login_codes.sql` and `0006_phone_login_requests.sql` must be reviewed and applied separately; they are not run automatically by the app. Production deployment and live database changes remain a separate approval step.
