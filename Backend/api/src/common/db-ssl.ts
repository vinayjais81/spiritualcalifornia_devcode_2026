import { readFileSync, existsSync } from 'fs';
import type { PoolConfig } from 'pg';

/**
 * Pool options for connecting to RDS over verified TLS.
 *
 * THE PROBLEM
 * RDS presents a certificate signed by the Amazon RDS root CA, which is not
 * in Node's default trust store. `node-postgres` verifies the chain when the
 * URL says `sslmode=require` (libpq historically did not, which is why the
 * setting reads as though it should only mean "encrypt"), so connecting
 * fails with:
 *
 *   P1011 TlsConnectionError: self-signed certificate in certificate chain
 *
 * Confusingly, `prisma migrate deploy` succeeds against the same database —
 * the migration engine and the runtime adapter take different code paths, so
 * migrations can pass while every application query fails.
 *
 * THE FIX, AND THE ONE NOT TAKEN
 * The quick way out is `sslmode=no-verify`, or `rejectUnauthorized: false`.
 * Both keep the connection encrypted while accepting ANY certificate — which
 * means an attacker positioned between the app and the database can present
 * their own and read everything in clear. For a database holding payment
 * records and government identity documents that is not a reasonable trade
 * to make for the sake of one config line.
 *
 * Instead we hand Node the RDS CA bundle and keep verification ON. The
 * bundle is a public certificate, not a secret; the deploy fetches it to
 * DATABASE_CA_CERT_PATH.
 *
 * When the variable is unset — local development, or a Postgres without TLS
 * — the connection is built exactly as before, so nothing changes off RDS.
 */
export function buildPoolConfig(connectionString: string | undefined, poolMax?: number): PoolConfig {
  const caPath = process.env.DATABASE_CA_CERT_PATH;
  const useCa = !!caPath && existsSync(caPath);

  /**
   * `sslmode` has to come OUT of the URL when we supply a CA.
   *
   * node-postgres parses the connection string and derives its own `ssl`
   * object from `sslmode`, which then competes with the one passed
   * alongside it. The URL wins, our CA is discarded, and the connection
   * fails with the same "self-signed certificate in certificate chain" as
   * if nothing had been configured at all — the fix looks applied and has
   * no effect.
   *
   * Removing the parameter leaves exactly one source of truth. TLS is still
   * mandatory: the `ssl` object below turns it on, and RDS enforces it
   * server-side anyway via rds.force_ssl=1.
   */
  const url = useCa ? stripSslMode(connectionString) : connectionString;

  const config: PoolConfig = { connectionString: url };

  if (poolMax && poolMax > 0) {
    config.max = poolMax;
  }

  if (useCa) {
    config.ssl = {
      ca: readFileSync(caPath as string, 'utf8'),
      // The entire point. Never set this to false to make an error go away.
      rejectUnauthorized: true,
    };
  }

  return config;
}

/** Remove any `sslmode=...` parameter, leaving the rest of the URL intact. */
function stripSslMode(connectionString: string | undefined): string | undefined {
  if (!connectionString) return connectionString;

  return connectionString
    .replace(/([?&])sslmode=[^&]*&/i, '$1')
    .replace(/[?&]sslmode=[^&]*$/i, '');
}
