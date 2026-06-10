/**
 * Pre-deploy smoke test — hits public + authenticated GET endpoints.
 * Usage: node scripts/smoke-test.mjs [baseUrl]
 */
const BASE = (process.argv[2] || process.env.API_BASE || 'http://127.0.0.1:3001').replace(/\/$/, '');

const results = { pass: [], fail: [], skip: [] };

async function req(method, path, { token, body, tenantId, expect = [200, 201, 204] } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId != null) headers['X-Tenant-Id'] = String(tenantId);
  const opts = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  const ok = expect.includes(res.status);
  return { ok, status: res.status, data };
}

function record(name, ok, status, detail) {
  const entry = { name, status, detail };
  if (ok) results.pass.push(entry);
  else results.fail.push(entry);
}

async function testGet(name, path, opts = {}) {
  try {
    const { ok, status, data } = await req('GET', path, opts);
    const detail = !ok ? (typeof data === 'object' ? data?.error || JSON.stringify(data).slice(0, 120) : String(data).slice(0, 120)) : undefined;
    record(name, ok, status, detail);
    return ok ? data : null;
  } catch (err) {
    record(name, false, 0, err.message);
    return null;
  }
}

async function testPost(name, path, body, opts = {}) {
  try {
    const { ok, status, data } = await req('POST', path, { ...opts, body });
    const detail = !ok ? (typeof data === 'object' ? data?.error || JSON.stringify(data).slice(0, 120) : String(data).slice(0, 120)) : undefined;
    record(name, ok, status, detail);
    return ok ? data : null;
  } catch (err) {
    record(name, false, 0, err.message);
    return null;
  }
}

async function login(username, password, tenantId = null) {
  const body = { username, password };
  if (tenantId != null) body.tenantId = tenantId;
  const data = await testPost(`POST /api/auth/login (${username})`, '/api/auth/login', body, {
    expect: [200],
  });
  return data?.token || null;
}

async function main() {
  console.log(`\n🔍 Smoke test → ${BASE}\n`);

  // --- Public ---
  await testGet('GET /api/health', '/api/health');
  await testGet('GET /api/tenant/public-stats', '/api/tenant/public-stats');
  await testPost('POST /api/visit', '/api/visit', { visitorId: 'smoke-test', page: '/' }, { expect: [200, 201, 204] });

  // Resolve tenant — prefer first active school from super-admin list
  let tenantId = 1;
  const saTokenEarly = await login('superadmin', 'superadmin123');
  if (saTokenEarly) {
    const schools = await testGet('GET /api/schools (resolve tenant)', '/api/schools', { token: saTokenEarly });
    if (Array.isArray(schools) && schools.length > 0) {
      tenantId = schools[0].id;
    }
  } else {
    const resolve = await testGet('GET /api/tenant/resolve?slug=rosa', '/api/tenant/resolve?slug=rosa', {
      expect: [200, 404],
    });
    tenantId = resolve?.tenant?.id ?? resolve?.id ?? 1;
  }

  // --- Super admin ---
  const saToken = saTokenEarly || (await login('superadmin', 'superadmin123'));
  if (saToken) {
    await testGet('GET /api/schools (super-admin)', '/api/schools', { token: saToken });
    await testGet('GET /api/stats/visits', '/api/stats/visits', { token: saToken });
    await testGet('GET /api/system/health', '/api/system/health', { token: saToken });
    await testGet('GET /api/system/errors', '/api/system/errors', { token: saToken });
  } else {
    results.skip.push({ name: 'super-admin routes', detail: 'login failed' });
  }

  // --- Tenant-scoped routes (super-admin token + tenant id) ---
  const smokeUser = process.env.SMOKE_USER;
  const smokePass = process.env.SMOKE_PASS;
  let token = saToken;
  if (smokeUser && smokePass) {
    token = (await login(smokeUser, smokePass, tenantId)) || saToken;
  }
  if (!token) {
    console.error('\n❌ No auth token — remaining tests skipped.\n');
    printSummary();
    process.exit(1);
  }

  console.log(`Using tenantId=${tenantId}${smokeUser ? ` as ${smokeUser}` : ' (super-admin token)'}\n`);

  const tq = (path) => {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}tenantId=${tenantId}`;
  };

  const auth = { token, tenantId };

  await testGet('GET /api/auth/me', '/api/auth/me', auth);
  await testGet('GET /api/auth/push/public-key', '/api/auth/push/public-key', { ...auth, expect: [200, 403] });

  const students = await testGet('GET /api/students', tq('/api/students'), auth);
  await testGet('GET /api/students?status=all', tq('/api/students?status=all'), auth);
  if (students?.[0]?.id) {
    await testGet('GET /api/students/:id', tq(`/api/students/${students[0].id}`), auth);
  }

  await testGet('GET /api/classes', tq('/api/classes'), auth);
  await testGet('GET /api/teachers', tq('/api/teachers'), auth);
  await testGet('GET /api/subjects', tq('/api/subjects'), auth);
  await testGet('GET /api/class-levels', tq('/api/class-levels'), auth);
  await testGet('GET /api/fees', tq('/api/fees'), auth);
  await testGet('GET /api/payments', tq('/api/payments'), auth);
  await testGet('GET /api/income', tq('/api/income'), auth);
  await testGet('GET /api/expenses', tq('/api/expenses'), auth);
  await testGet('GET /api/settings', tq('/api/settings'), auth);
  await testGet('GET /api/settings/academic-terms', tq('/api/settings/academic-terms'), auth);
  await testGet('GET /api/settings/users', tq('/api/settings/users'), auth);
  await testGet('GET /api/settings/push/stats', tq('/api/settings/push/stats'), auth);
  await testGet('GET /api/attendance', tq('/api/attendance'), { ...auth, expect: [200, 400] });
  await testGet('GET /api/grades/assignments', tq('/api/grades/assignments'), { ...auth, expect: [200, 400] });
  await testGet('GET /api/grades/subjects', tq('/api/grades/subjects'), { ...auth, expect: [200, 400] });
  await testGet('GET /api/payroll', tq('/api/payroll'), auth);
  await testGet('GET /api/payroll/settings', tq('/api/payroll/settings'), auth);
  await testGet('GET /api/payroll/other-staff', tq('/api/payroll/other-staff'), auth);
  await testGet('GET /api/enrollments', tq('/api/enrollments'), auth);
  await testGet('GET /api/events', tq('/api/events'), auth);
  await testGet('GET /api/global-chat', '/api/global-chat', auth);
  await testGet('GET /api/global-chat/mentions', '/api/global-chat/mentions', auth);
  await testGet('GET /api/conversations', '/api/conversations', auth);
  await testGet('GET /api/support-chat', tq('/api/support-chat'), auth);
  await testGet('GET /api/support-chat/unread-count', tq('/api/support-chat/unread-count'), auth);
  await testGet('GET /api/support-chat/conversations', tq('/api/support-chat/conversations'), auth);
  await testGet('GET /api/messages/admin/list', tq('/api/messages/admin/list'), auth);
  await testGet('GET /api/messages/admin/unread-count', tq('/api/messages/admin/unread-count'), auth);
  await testGet('GET /api/finance/terms', tq('/api/finance/terms'), auth);
  await testGet('GET /api/finance/manual-adjustments', tq('/api/finance/manual-adjustments'), auth);
  await testGet('GET /api/fee-calculations/arrears-balances', tq('/api/fee-calculations/arrears-balances'), auth);
  await testGet('GET /api/records/profile-lookup?id=test', tq('/api/records/profile-lookup?id=test'), { ...auth, expect: [200, 404] });
  await testGet(`GET /api/schools/${tenantId}/setup-progress`, `/api/schools/${tenantId}/setup-progress`, { ...auth, expect: [200, 403] });
  await testGet(`GET /api/schools/${tenantId}/academic-years`, `/api/schools/${tenantId}/academic-years`, auth);
  await testGet(`GET /api/schools/${tenantId}`, `/api/schools/${tenantId}`, auth);

  // Reports (may need term/year — expect 200 or 400)
  const reportPaths = [
    '/api/reports/fee-status',
    '/api/reports/financial-summary',
    '/api/reports/fees-by-class',
    '/api/reports/outstanding-fees',
    '/api/reports/expenditure',
    '/api/reports/payroll-summary',
    '/api/reports/academic-performance',
    '/api/reports/attendance-summary',
    '/api/reports/income-vs-expenditure',
  ];
  for (const p of reportPaths) {
    await testGet(`GET ${p}`, tq(p), { ...auth, expect: [200, 400] });
  }

  // PWA (tenant slug header)
  await testGet('GET /api/pwa/manifest', `/api/pwa/manifest?tenant=${tenantId}`, { expect: [200, 400, 404] });

  printSummary();
  process.exit(results.fail.length ? 1 : 0);
}

function printSummary() {
  console.log('\n--- Results ---');
  console.log(`✅ Passed: ${results.pass.length}`);
  console.log(`❌ Failed: ${results.fail.length}`);
  if (results.skip.length) console.log(`⏭ Skipped: ${results.skip.length}`);

  if (results.fail.length) {
    console.log('\nFailures:');
    for (const f of results.fail) {
      console.log(`  • ${f.name} → HTTP ${f.status}${f.detail ? `: ${f.detail}` : ''}`);
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
