import { isAuthenticated, json } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const secret = env.APP_ACCESS_SECRET || '';
  return json({
    success: true,
    protected: Boolean(secret),
    authenticated: await isAuthenticated(request, env),
  });
}
