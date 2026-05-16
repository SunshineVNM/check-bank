import {
  API_BASE,
  bankApiHeaders,
  clearSessionCookieHeader,
  isAuthenticated,
  json,
  requireAuth,
  sessionCookieHeader,
  sessionToken,
  timingSafeEqual,
} from '../functions/_lib/auth.js';

async function handleAuthStatus(request, env) {
  const secret = env.APP_ACCESS_SECRET || '';
  return json({
    success: true,
    protected: Boolean(secret),
    authenticated: await isAuthenticated(request, env),
  });
}

async function handleAuthPost(request, env) {
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

async function handleAuthLogout(request) {
  return json({ success: true }, 200, {
    'Set-Cookie': clearSessionCookieHeader(request),
  });
}

async function handleBanks(request, env) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;

  try {
    const response = await fetch(`${API_BASE}/bank/list`);
    const data = await response.json();
    return json(data, response.ok ? 200 : response.status);
  } catch (err) {
    return json({ success: false, msg: err.message }, 500);
  }
}

async function handleLookup(request, env) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, msg: 'Dữ liệu không hợp lệ.' }, 400);
  }

  const { bank, account } = body || {};
  if (!bank || !account) {
    return json({
      success: false,
      msg: 'Vui lòng chọn ngân hàng và nhập số tài khoản.',
    }, 400);
  }

  if (!env.BANKLOOKUP_API_KEY || !env.BANKLOOKUP_API_SECRET) {
    return json({
      success: false,
      msg: 'Thiếu API key/secret. Cấu hình biến môi trường trên Cloudflare.',
    }, 500);
  }

  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: bankApiHeaders(env),
      body: JSON.stringify({ bank, account: String(account).trim() }),
    });
    const data = await response.json();
    return json(data, response.ok ? 200 : 400);
  } catch (err) {
    return json({ success: false, msg: err.message }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (pathname === '/api/auth/status' && method === 'GET') {
      return handleAuthStatus(request, env);
    }
    if (pathname === '/api/auth' && method === 'POST') {
      return handleAuthPost(request, env);
    }
    if (pathname === '/api/auth/logout' && method === 'POST') {
      return handleAuthLogout(request);
    }
    if (pathname === '/api/banks' && method === 'GET') {
      return handleBanks(request, env);
    }
    if (pathname === '/api/lookup' && method === 'POST') {
      return handleLookup(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
