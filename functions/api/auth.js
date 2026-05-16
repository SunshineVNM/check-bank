import {
  json,
  sessionCookieHeader,
  sessionToken,
  timingSafeEqual,
} from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const secret = env.APP_ACCESS_SECRET || '';

  if (!secret) {
    return json({ success: true, authenticated: true });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, msg: 'Dữ liệu không hợp lệ.' }, 400);
  }

  const input = String(body.secret || '');

  if (input.length !== secret.length) {
    return json({ success: false, msg: 'Mã bí mật không đúng.' }, 401);
  }

  if (!timingSafeEqual(input, secret)) {
    return json({ success: false, msg: 'Mã bí mật không đúng.' }, 401);
  }

  const token = await sessionToken(secret);
  return json({ success: true, authenticated: true }, 200, {
    'Set-Cookie': sessionCookieHeader(token, request),
  });
}
