import { API_BASE, requireAuth, json } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
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
