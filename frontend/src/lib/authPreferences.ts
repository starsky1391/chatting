const LAST_EMAIL_COOKIE = 'chat_last_email';
const LAST_EMAIL_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export function getLastLoginEmail(): string {
  if (typeof document === 'undefined') {
    return '';
  }

  const cookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${LAST_EMAIL_COOKIE}=`));

  if (!cookie) {
    return '';
  }

  try {
    return decodeURIComponent(cookie.split('=').slice(1).join('='));
  } catch {
    return '';
  }
}

export function saveLastLoginEmail(email: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    clearLastLoginEmail();
    return;
  }

  document.cookie = [
    `${LAST_EMAIL_COOKIE}=${encodeURIComponent(normalizedEmail)}`,
    `Max-Age=${LAST_EMAIL_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
  ].join('; ');
}

export function clearLastLoginEmail(): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${LAST_EMAIL_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
