import { clearSessionCookieHeader, json } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  return json({ success: true }, 200, {
    'Set-Cookie': clearSessionCookieHeader(context.request),
  });
}
