# Credential Document Upload — Dashboard Fix

## Symptom

A guide uploaded a certificate copy from **Guide Dashboard → Verification**
(`/guide/dashboard/verification`), the file name showed in the "Add Certification"
modal, and the credential appeared in the list — but **no document link showed in
the admin verification queue** (`View doc` absent) and nothing was viewable.

## Root cause

The dashboard's `addCredential` **never uploaded the selected file**. It captured
`certFile`, displayed its name in the modal for looks, then on submit POSTed only
the text fields to `/guides/onboarding/credentials`:

```ts
await api.post('/guides/onboarding/credentials', {
  title, institution, issuedYear,
  // documentS3Key would be set after S3 upload   ← never implemented
});
```

With no `documentS3Key`, the backend set `credential.documentUrl = undefined`
(`guides.service.ts addCredential`). The admin queue correctly hides `View doc`
whenever `documentUrl` is null, so the document simply never existed.

The **onboarding wizard** (`Step3Credentials.tsx`) already did this correctly:
GET pre-signed URL → PUT file to S3 → send `documentS3Key`. The dashboard page was
an unfinished parallel implementation.

## Fix

`Frontend/web/src/app/guide/dashboard/verification/page.tsx` — `addCredential` now
performs the same direct-to-S3 upload before creating the credential:

1. `GET /upload/presigned-url?folder=credentials&fileName=&contentType=`
2. `PUT` the file to the returned `uploadUrl`; throw on non-OK so failures surface
   instead of silently dropping the document.
3. Include `documentS3Key: presigned.key` in the credential POST.

Added a `savingCred` state so the modal button shows "Uploading…" and can't be
double-submitted.

## Notes

- **Storage is real S3, not stub.** The backend `.env` (untracked, per-box) carries
  real `AWS_ACCESS_KEY_ID` / bucket / CloudFront, so `UploadService.isStub` is
  false and pre-signed PUTs go to the real bucket.
- **S3 bucket CORS** must allow `PUT` from the site origin
  (`https://spiritualcalifornia.nityo.in`) or the browser upload fails. If
  onboarding-created credentials also lack documents, verify the bucket CORS
  policy — that is the next thing to check.
- **Public profile does not show the document image** by design — credential docs
  are private verification artifacts. The public profile lists title / org / year
  only; the reviewable copy is admin-only via a short-lived pre-signed download
  (`admin.service.getCredentialDocumentUrl`, 10-min TTL).
- **Existing doc-less credentials** (created before this fix) stay `documentUrl =
  null`; delete and re-add them to attach a document.
