# FormData uploads and the shared axios instance

**Symptom.** The practitioner import upload (`POST /admin/practitioner-import/upload`)
returned:

```json
{ "message": ["property file should not exist"], "error": "Bad Request", "statusCode": 400 }
```

The DevTools Network panel showed the whole request weighing about 1.3 kB — the
`.xlsx` never left the browser.

## Cause

`Frontend/web/src/lib/api.ts` creates the shared axios instance with a blanket
JSON content type:

```ts
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },   // applies to every request
});
```

axios v1's default `transformRequest` inspects the declared content type *before*
serialising the payload. Roughly:

```js
if (isFormData(data)) {
  return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
}
```

So with `application/json` declared, a `FormData` body is not sent as multipart at
all — it is flattened by `formDataToJSON()` and stringified. A `File` has no
enumerable own properties, so it serialises to `{}`, and the request that actually
went out was:

```
Content-Type: application/json

{"file":{},"sourceLabel":"Bay Area 2 Aug 26 import"}
```

On the server this is an ordinary JSON body. `FileInterceptor`'s multer sees a
non-multipart request and skips it, leaving `req.file` undefined — but `req.body`
now carries a stray `file` key, and the global `ValidationPipe`
(`whitelist: true, forbidNonWhitelisted: true`, see `main.ts`) rejects it against
`UploadImportDto` before the handler's own "Attach an .xlsx file" check can run.

The misleading part is the error text: it names `file`, so it reads like the file
*was* received and refused. The opposite is true — the file was dropped and only
its name survived.

## Fix

Strip the inherited content type whenever the payload is `FormData`, in the
existing request interceptor, so every current and future upload is covered:

```ts
if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
  config.headers.delete('Content-Type');
}
```

With no `Content-Type` set, axios's browser adapter lets the browser write
`multipart/form-data; boundary=…` itself. Setting the header to
`'multipart/form-data'` by hand at the call site would also work, but only because
the adapter throws that value away — it carries no boundary and is a trap to copy.

## Rules

- Never hand-write `Content-Type: multipart/form-data`. Only the browser can
  attach a valid boundary.
- An axios instance with a default JSON content type will silently corrupt
  `FormData`. It fails as a validation error about a *body field*, never as an
  upload error — don't read "property file should not exist" as a server-side
  file-handling bug.
- This was the first `FileInterceptor` endpoint in the API. Every other upload
  goes straight to S3 via a pre-signed PUT, which is why the instance default had
  never been exercised.

## Files

- `Frontend/web/src/lib/api.ts` — the interceptor fix.
- `Backend/api/src/modules/practitioner-import/practitioner-import.controller.ts`
  — the endpoint; unchanged, it was correct.
