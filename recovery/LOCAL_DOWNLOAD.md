# Download the canonical deployment locally

This workspace cannot reach api.vercel.com through the CLI. Run this on a local PC with Node.js and normal Vercel API access. It performs GET requests only. It does not deploy, change aliases, apply migrations, modify the Git checkout, or include CLI credentials in the archive.

From the restore/vercel-2026-09-09 branch repository root:

```sh
npm install -g vercel@62.2.0
vercel login
node recovery/download-canonical-source.mjs
```

Upload `vercel-original-2026-09-09.tar.gz` to this conversation. Do not send tokens or passwords.

The script verifies the exact deployment and project, obtains the full src/ tree from the deployment files API, fetches original base64 bytes, validates every SHA-1 against its file UID, and writes an archive with a SHA-256 manifest. Existing output paths cause an abort to avoid overwriting an earlier attempt. If it fails, share the error text only; never manually repair a truncated file.

The script passed offline checks for deep paths, binary data, CRLF preservation, empty files, archive extraction, and hash-mismatch rejection. Real API retrieval remains to be verified on the local PC.
