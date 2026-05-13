'use client';

import { useMemo } from 'react';

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set<string>([
  'password', 'password1', 'password123', 'password123!', 'p@ssw0rd',
  'p@ssw0rd1', 'p@ssw0rd123', 'qwerty', 'qwerty123', 'qwerty12345',
  '123456789', '1234567890', 'iloveyou', 'iloveyou1', 'welcome1',
  'welcome123', 'admin', 'admin123', 'letmein', 'letmein1', 'monkey123',
  'football1', 'baseball1', 'sunshine1', 'princess1', 'changeme',
  'changeme1', 'spiritual', 'spiritual1', 'california1', 'california123',
]);

export interface PasswordRule {
  key: string;
  label: string;
  passed: boolean;
}

export interface PasswordStrengthResult {
  rules: PasswordRule[];
  passedCount: number;
  totalCount: number;
  allPassed: boolean;
  score: 0 | 1 | 2 | 3 | 4;
}

export function evaluatePassword(
  password: string,
  context?: { email?: string; firstName?: string; lastName?: string },
): PasswordStrengthResult {
  const lower = password.toLowerCase();
  const localPart = (context?.email ?? '').split('@')[0]?.toLowerCase() ?? '';
  const personalCandidates = [
    localPart,
    context?.firstName?.toLowerCase() ?? '',
    context?.lastName?.toLowerCase() ?? '',
  ].filter((s) => s.length >= 4);
  const containsPersonal = personalCandidates.some((c) => lower.includes(c));

  const rules: PasswordRule[] = [
    {
      key: 'length',
      label: `${MIN_LENGTH}–${MAX_LENGTH} characters`,
      passed: password.length >= MIN_LENGTH && password.length <= MAX_LENGTH,
    },
    {
      // Backend's checkPasswordPolicy rejects any leading/trailing whitespace.
      // Pasted passwords from password managers commonly include a trailing
      // space the user can't see — without this rule the strength meter
      // would show all green and the server would 400. Treat empty as
      // not-yet-evaluated so the meter doesn't shout "whitespace!" on a
      // pristine input.
      key: 'noWhitespace',
      label: 'No spaces at the start or end',
      passed: password.length === 0 ? false : password === password.trim(),
    },
    {
      key: 'upper',
      label: 'One uppercase letter (A–Z)',
      passed: /[A-Z]/.test(password),
    },
    {
      key: 'lower',
      label: 'One lowercase letter (a–z)',
      passed: /[a-z]/.test(password),
    },
    {
      key: 'digit',
      label: 'One digit (0–9)',
      passed: /[0-9]/.test(password),
    },
    {
      key: 'special',
      label: 'One special character',
      passed: /[^A-Za-z0-9]/.test(password),
    },
    {
      key: 'notCommon',
      label: 'Not a common password',
      passed: password.length === 0 ? false : !COMMON_PASSWORDS.has(lower),
    },
    {
      key: 'notPersonal',
      label: 'Does not contain your name or email',
      passed: password.length === 0 ? false : !containsPersonal,
    },
  ];

  const passedCount = rules.filter((r) => r.passed).length;
  const totalCount = rules.length;
  const allPassed = passedCount === totalCount;

  // Map raw rule pass count → 0..4 strength bucket for the bar.
  // Critical: scores 1-3 all use amber/red to signal "not done yet".
  // We only enter the green "Strong" state (score 4) when *every*
  // rule passes. Otherwise the meter would show green while the
  // backend rejects the password — a misleading UX that buries the
  // missing requirement under positive-language cues.
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (password.length === 0) score = 0;
  else if (allPassed) score = 4;
  else if (passedCount <= 3) score = 1;
  else if (passedCount <= 5) score = 2;
  else score = 3;

  return { rules, passedCount, totalCount, allPassed, score };
}

// Labels never imply success until `allPassed`. Colors progress from
// red → amber → green only when policy is fully satisfied.
const SCORE_LABEL = ['', 'Weak', 'Keep going', 'Almost there', 'Strong'] as const;
const SCORE_COLOR = ['#E0DDD7', '#C0392B', '#E8A33D', '#E8A33D', '#3A8B4D'];

export interface PasswordStrengthMeterProps {
  password: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  /** Hide the meter and rule list when password is empty. */
  hideWhenEmpty?: boolean;
}

export function PasswordStrengthMeter({
  password,
  email,
  firstName,
  lastName,
  hideWhenEmpty = true,
}: PasswordStrengthMeterProps) {
  const result = useMemo(
    () => evaluatePassword(password, { email, firstName, lastName }),
    [password, email, firstName, lastName],
  );

  if (hideWhenEmpty && password.length === 0) return null;

  const segments = [1, 2, 3, 4];

  return (
    <div
      style={{
        marginTop: 8,
        fontFamily: 'var(--font-inter), sans-serif',
      }}
    >
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {segments.map((seg) => (
          <div
            key={seg}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background:
                seg <= result.score ? SCORE_COLOR[result.score] : '#E0DDD7',
              transition: 'background 150ms ease',
            }}
          />
        ))}
      </div>

      {result.score > 0 && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: SCORE_COLOR[result.score],
            marginBottom: 6,
          }}
        >
          {SCORE_LABEL[result.score]}
        </div>
      )}

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '4px 12px',
        }}
      >
        {result.rules.map((rule) => {
          // Three states: passed (green ✓), failed-and-typed (red ✕),
          // not-yet-typed (gray ○). Calling out failures in red makes
          // the missing requirement obvious instead of blending it in
          // with passing checks.
          const isFailedWithInput = !rule.passed && password.length > 0;
          const color = rule.passed
            ? '#3A8B4D'
            : isFailedWithInput
              ? 'var(--color-error)'
              : '#8A8278';
          const icon = rule.passed ? '✓' : isFailedWithInput ? '✕' : '○';
          return (
            <li
              key={rule.key}
              style={{
                fontSize: 12,
                color,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span aria-hidden="true" style={{ fontWeight: isFailedWithInput ? 700 : 400 }}>{icon}</span>
              <span>{rule.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
