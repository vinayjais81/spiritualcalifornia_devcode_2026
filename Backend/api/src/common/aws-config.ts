import type { ConfigService } from '@nestjs/config';

/**
 * Shared configuration for every AWS SDK client.
 *
 * The SDK's default credential chain finds an EC2 instance profile on its
 * own — but ONLY if no explicit `credentials` object is passed. Passing one
 * built from empty strings does not fall back; it fails with an unhelpful
 * signature error.
 *
 * That matters because production authenticates via an instance role
 * (sc-prod-ec2-role) precisely so that no static AWS key exists to leak, and
 * so credentials rotate automatically. Every client therefore has to OMIT
 * the credentials field there, while still honouring explicit keys locally
 * and on QA, where there is no instance profile to inherit.
 *
 * Returns `credentials` only when real-looking keys are present.
 */
export function awsSdkConfig(config: ConfigService): {
  region: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
} {
  const region = config.get<string>('AWS_REGION', 'us-west-1');
  const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID', '') ?? '';
  const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY', '') ?? '';

  if (hasExplicitAwsKeys(accessKeyId, secretAccessKey)) {
    return { region, credentials: { accessKeyId, secretAccessKey } };
  }

  // No usable keys — let the default chain resolve the instance profile.
  return { region };
}

/**
 * True when the environment carries real, usable AWS keys.
 *
 * `your-` is the prefix used throughout .env.example, and the placeholder
 * values the deployment template ships with. Treating those as absent is
 * what keeps a half-filled .env from producing confusing signature errors
 * instead of an obvious "not configured".
 */
export function hasExplicitAwsKeys(accessKeyId: string, secretAccessKey: string): boolean {
  return (
    !!accessKeyId &&
    !!secretAccessKey &&
    !accessKeyId.startsWith('your-') &&
    !accessKeyId.toUpperCase().startsWith('PLACEHOLDER')
  );
}
