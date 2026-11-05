# Private cloud work in progress

This local branch is not deployed. `firestore.rules` denies all access until the owner UID is established and the generated, emulator-tested rules are reviewed and deployed. Never import records before verifying the real rules and account.

Cloudflare build: `npm ci && npm ci --prefix Dashboard2 && npm run build:cloudflare`; output directory `cloudflare-dist`. The build requires Firebase web configuration in `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, and the provisioned `VITE_OWNER_UID`. Web configuration is public identification, not an administrative credential. Do not put a service-account key in the app or repository. Set the required values in Cloudflare, and authorize the deployed domain in Firebase Authentication.

The original Campus SQLite export utility reads the database in read-only mode, including its WAL, and writes only to the Git-ignored `private-cloud/local` directory. The export contains private records and must be handled as a backup. ECTS data should be exported from the original application's current browser session; dated backups may not be current.
