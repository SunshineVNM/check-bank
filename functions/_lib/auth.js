const API_BASE = 'https://api.banklookup.net';
const SESSION_COOKIE = 'tkbank_session';
const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;

export { API_BASE, SESSION_COOKIE, SESSION_MAX_AGE_SEC };

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key) out[key] = decodeURIComponent(rest.join('='));
  }
  return out;
}

export async function sessionToken(secret) {
  if (!secret) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('authenticated'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function isAuthenticated(request, env) {
  const secret = env.APP_ACCESS_SECRET || '';
  if (!secret) return true;
  const token = parseCookies(request.headers.get('Cookie'))[SESSION_COOKIE];
  const expected = await sessionToken(secret);
  if (!token || !expected) return false;
  return timingSafeEqual(token, expected);
}

function cookieFlags(request) {
  const url = new URL(request.url);
  return url.protocol === 'https:' ? '; Secure' : '';
}

export function sessionCookieHeader(token, request, maxAgeSec = SESSION_MAX_AGE_SEC) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${cookieFlags(request)}`;
}

export function clearSessionCookieHeader(request) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${cookieFlags(request)}`;
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export async function requireAuth(request, env) {
  if (await isAuthenticated(request, env)) return null;
  return json({ success: false, msg: 'Chưa có quyền truy cập. Nhập mã bí mật.' }, 401);
}

export function bankApiHeaders(env) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': env.BANKLOOKUP_API_KEY || '',
    'x-api-secret': env.BANKLOOKUP_API_SECRET || '',
  };
}
