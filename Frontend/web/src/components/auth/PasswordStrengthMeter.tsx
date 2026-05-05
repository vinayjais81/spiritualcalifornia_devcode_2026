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
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (password.length === 0) score = 0;
  else if (passedCount <= 2) score = 1;
  else if (passedCount <= 4) score = 2;
  else if (passedCount <= 6) score = 3;
  else score = 4;

  return { rules, passedCount, totalCount, allPassed, score };
}

const SCORE_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
const SCORE_COLOR = ['#E0DDD7', '#C0392B', '#E8A33D', '#5AA85A', '#3A8B4D'];

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
        {result.rules.map((rule) => (
          <li
            key={rule.key}
            style={{
              fontSize: 12,
              color: rule.passed ? '#3A8B4D' : '#8A8278',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span aria-hidden="true">{rule.passed ? '✓' : '○'}</span>
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
