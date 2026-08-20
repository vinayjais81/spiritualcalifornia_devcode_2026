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
  const config: PoolConfig = { connectionString };

  if (poolMax && poolMax > 0) {
    config.max = poolMax;
  }

  const caPath = process.env.DATABASE_CA_CERT_PATH;
  if (caPath && existsSync(caPath)) {
    config.ssl = {
      ca: readFileSync(caPath, 'utf8'),
      // The entire point. Never set this to false to make an error go away.
      rejectUnauthorized: true,
    };
  }

  return config;
}
