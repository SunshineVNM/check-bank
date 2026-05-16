import { API_BASE, bankApiHeaders, requireAuth, json } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
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
