import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;

// Lowercased — input is normalized before lookup. Keep the list short and
// targeted at the most-guessed candidates; full breach-corpus checks belong
// at a higher layer (e.g. HIBP API in a follow-up).
const COMMON_PASSWORDS = new Set<string>([
  'password',
  'password1',
  'password123',
  'password123!',
  'p@ssw0rd',
  'p@ssw0rd1',
  'p@ssw0rd123',
  'qwerty',
  'qwerty123',
  'qwerty12345',
  '123456789',
  '1234567890',
  'iloveyou',
  'iloveyou1',
  'welcome1',
  'welcome123',
  'admin',
  'admin123',
  'letmein',
  'letmein1',
  'monkey123',
  'football1',
  'baseball1',
  'sunshine1',
  'princess1',
  'changeme',
  'changeme1',
  'spiritual',
  'spiritual1',
  'california1',
  'california123',
]);

export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
}

/**
 * Pure-function password policy checker. Use directly in services for
 * cross-field validation (e.g. password ≠ email local-part).
 */
export function checkPasswordPolicy(
  password: unknown,
): PasswordPolicyResult {
  const errors: string[] = [];

  if (typeof password !== 'string') {
    return { valid: false, errors: ['Password must be a string.'] };
  }

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters.`);
  }
  if (password.length > MAX_LENGTH) {
    errors.push(`Password must be at most ${MAX_LENGTH} characters.`);
  }
  if (password !== password.trim()) {
    errors.push('Password cannot start or end with whitespace.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit.');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character.');
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common — choose something less guessable.');
  }

  return { valid: errors.length === 0, errors };
}

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  private lastErrors: string[] = [];

  validate(value: unknown): boolean {
    const result = checkPasswordPolicy(value);
    this.lastErrors = result.errors;
    return result.valid;
  }

  defaultMessage(_args: ValidationArguments): string {
    return this.lastErrors.length > 0
      ? this.lastErrors.join(' ')
      : 'Password does not meet complexity requirements.';
  }
}

/**
 * Class-validator decorator enforcing the platform password policy:
 *   • 10–128 characters
 *   • at least one uppercase, lowercase, digit, and special character
 *   • no leading/trailing whitespace
 *   • not on the common-passwords deny list
 */
export function IsStrongPassword(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
