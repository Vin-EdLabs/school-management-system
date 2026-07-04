const BASE = 'http://localhost:3001/api';

async function login(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.token;
}

async function get(token, path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const passwords = ['admin123', 'password', 'VINCE', 'test123', 'demo123'];
let token = null;
for (const pw of passwords) {
  try {
    token = await login('VINCE', pw);
    console.log('Logged in with password:', pw);
    break;
  } catch {}
}
if (!token) {
  console.error('Could not login as VINCE — try password manually');
  process.exit(1);
}

const endpoints = [
  '/reports/financial-summary',
  '/reports/admin-overview',
  '/reports/outstanding-fees',
  '/fee-calculations/students/outstanding-fees',
  '/fee-calculations/students/balances',
];

for (const ep of endpoints) {
  const { status, data } = await get(token, ep);
  console.log(`\n=== ${ep} [${status}] ===`);
  if (typeof data === 'object') {
    const preview = JSON.stringify(data, null, 2);
    console.log(preview.slice(0, 1500));
  } else {
    console.log(String(data).slice(0, 500));
  }
}
