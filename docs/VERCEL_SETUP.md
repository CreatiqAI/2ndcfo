# Vercel environment setup

Use `.env.vercel.local` as the private import file. `.env.vercel.example` is the
secret-free template. Neither file changes the running localhost connection.
The private import file reuses the existing OpenAI key and sets `gpt-5-mini`.
No temperature, top_p or reasoning overrides are sent to OpenAI.

## What to obtain

Use **2ndCFO(new)**, project `btpolwpgnekvyimpqegu`, not the old project.

| Information | Where | Put it in |
| --- | --- | --- |
| PostgreSQL URI including database password | Supabase > Connect > Session pooler > URI | `DATABASE_URL` |
| S3 Access Key ID | Supabase > Storage > S3 > Access keys | `AWS_ACCESS_KEY_ID` |
| S3 Secret Access Key | Same S3 key creation screen | `AWS_SECRET_ACCESS_KEY` |
| Final website URL | Vercel project domain or your custom domain | `APP_ORIGIN` |

Database password is the project's database password, not your Supabase login
password. URL-encode special characters inside the password when building the URI.
Keep session pooler port 5432: current database queries rely on connection-level
`search_path=finance,public`. Do not substitute transaction pooler port 6543 without
adapting database schema handling. Runtime database permissions and connection
capacity should be reviewed before scaling to many concurrent Vercel instances.

The app uses its own email/password accounts in `finance.users`. No anon or
service_role API key is needed for current login, SQL access or S3 storage.
The publishable key (or legacy anon key) is only used by the optional Google login
flow. That setup is postponed. Do not reuse the old project's key for the new project.
S3 keys and service_role keys are different credentials.

## Deployment sequence

1. Complete `.env.vercel.local`. Keep the existing OpenAI key, model, private bucket,
   region, endpoint, database schema and certificate path as supplied.
2. Complete and verify the database + file migration before using the new project.
   At the time this document was written, migration is still waiting for credentials;
   the new `finance` schema is not ready for the application.
3. Import the GitHub repository into Vercel with the Next.js preset, Node.js 24,
   install command `npm ci` and build command `npm run build`.
4. Import `.env.vercel.local` in Environment Variables for **Production**. Use the
   exact HTTPS domain as `APP_ORIGIN`, without a trailing slash. Redeploy when env
   values change. Do not import local `DATABASE_MODE=local` settings or migration-only
   variables. Do not expose secrets with `NEXT_PUBLIC_`.
5. Use a separate test database/bucket for Preview environments; their domains also
   need their own matching `APP_ORIGIN`. Do not attach production data to untrusted previews.
6. Verify login, one small upload, extraction, review preview, download and bank matching
   on the deployed URL. Production deployment has not yet been tested.

`npm ci` copies PDF preview assets through the existing postinstall script. The
database TLS CA is explicitly included in API function bundles. Extraction requests
have a 120-second function budget around the existing 90-second AI call timeout.
The durable queue runs one job per browser-triggered request; a permanently running
worker is not provided by Vercel Functions. A separate worker is needed to keep
processing when no browser is driving the queue.

## Known deployment limitation: original file size

Vercel Functions limit request **and response** payloads to 4.5 MB. Current uploads
and authenticated document downloads pass through API functions, while the product
supports files up to 20 MB. Environment variables cannot remove this platform limit.
Do not treat this environment setup as full Vercel production readiness: preserving
20 MB uploads/downloads requires an authenticated direct-to-storage upload/download
flow (including validation, immutable evidence handling and preview access).
No existing 20 MB product requirement has been reduced.

References:
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/environment-variables/reserved-environment-variables
- https://supabase.com/docs/guides/storage/s3/authentication
- https://developers.openai.com/api/docs/models/gpt-5-mini
