require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE = 'https://api.banklookup.net';
const ACCESS_SECRET = process.env.APP_ACCESS_SECRET || '';
const SESSION_COOKIE = 'tkbank_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

app.use(express.json());

function sessionToken() {
  if (!ACCESS_SECRET) return null;
  return crypto.createHmac('sha256', ACCESS_SECRET).update('authenticated').digest('hex');
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key) out[key] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function isAuthenticated(req) {
  if (!ACCESS_SECRET) return true;
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const expected = sessionToken();
  if (!token || !expected || token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  res.status(401).json({ success: false, msg: 'Chưa có quyền truy cập. Nhập mã bí mật.' });
}

function setSessionCookie(res) {
  const token = sessionToken();
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
  );
}

app.get('/api/auth/status', (req, res) => {
  res.json({
    success: true,
    protected: Boolean(ACCESS_SECRET),
    authenticated: isAuthenticated(req),
  });
});

app.post('/api/auth', (req, res) => {
  if (!ACCESS_SECRET) {
    return res.json({ success: true, authenticated: true });
  }

  const { secret } = req.body || {};
  const input = String(secret || '');
  const expected = ACCESS_SECRET;

  if (input.length !== expected.length) {
    return res.status(401).json({ success: false, msg: 'Mã bí mật không đúng.' });
  }

  try {
    if (!crypto.timingSafeEqual(Buffer.from(input), Buffer.from(expected))) {
      return res.status(401).json({ success: false, msg: 'Mã bí mật không đúng.' });
    }
  } catch {
    return res.status(401).json({ success: false, msg: 'Mã bí mật không đúng.' });
  }

  setSessionCookie(res);
  res.json({ success: true, authenticated: true });
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.BANKLOOKUP_API_KEY || '',
    'x-api-secret': process.env.BANKLOOKUP_API_SECRET || '',
  };
}

app.get('/api/banks', requireAuth, async (_req, res) => {
  try {
    const response = await fetch(`${API_BASE}/bank/list`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

app.post('/api/lookup', requireAuth, async (req, res) => {
  const { bank, account } = req.body || {};

  if (!bank || !account) {
    return res.status(400).json({
      success: false,
      msg: 'Vui lòng chọn ngân hàng và nhập số tài khoản.',
    });
  }

  if (!process.env.BANKLOOKUP_API_KEY || !process.env.BANKLOOKUP_API_SECRET) {
    return res.status(500).json({
      success: false,
      msg: 'Thiếu API key/secret. Cấu hình trong file .env',
    });
  }

  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ bank, account: String(account).trim() }),
    });
    const data = await response.json();
    res.status(response.ok ? 200 : 400).json(data);
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  if (!ACCESS_SECRET) {
    console.warn('Cảnh báo: APP_ACCESS_SECRET chưa cấu hình — app đang mở không cần mã.');
  }
});
