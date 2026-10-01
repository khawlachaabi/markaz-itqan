/* مركز الإتقان — المنطق الأساسي (يعمل على Netlify Functions أو أي بيئة تدعم Request/Response) */
import crypto from 'node:crypto';
import TEMPLATE from './template.mjs';
import DEFAULTS from './defaults.mjs';

const SEC = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};
const J = (obj, status = 200, headers) => {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEC });
  for (const [k, v] of headers || []) h.append(k, v);
  return new Response(JSON.stringify(obj), { status, headers: h });
};
const T = (text, status = 200, type = 'text/plain; charset=utf-8', headers) => {
  const h = new Headers({ 'content-type': type, 'cache-control': 'no-store', ...SEC });
  for (const [k, v] of headers || []) h.set(k, v);
  return new Response(text, { status, headers: h });
};
const fail = (status, message) => Object.assign(new Error(message), { status });

/* ---------- أدوات ---------- */
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const ICONS = ['megaphone', 'pen', 'chip', 'chart', 'laptop', 'sprout', 'target', 'users', 'cert', 'screen'];
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
const cleanId = (v, pre) => (/^[A-Za-z0-9_-]{1,40}$/.test(String(v || '')) ? String(v) : pre + crypto.randomBytes(5).toString('hex'));
const IMG_RE = /^\/(assets|uploads)\/[A-Za-z0-9._-]+$/;
const cleanImg = (v, fb) => (IMG_RE.test(String(v || '')) && !String(v).includes('..') ? String(v) : fb);
const digitsLatin = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const STATUS = { new: 'جديد', contacted: 'تم التواصل', confirmed: 'مؤكد', cancelled: 'ملغى' };

/* ---------- الحالة المخزّنة ---------- */
const secretCache = new WeakMap();
async function getSecret(S) {
  if (secretCache.has(S)) return secretCache.get(S);
  let s = await S.getJSON('secret');
  if (!s || !s.v || s.v.length < 32) { s = { v: crypto.randomBytes(32).toString('hex') }; await S.setJSON('secret', s); }
  secretCache.set(S, s.v);
  return s.v;
}
async function getAuth(S) {
  let a = await S.getJSON('auth');
  if (!a) {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw fail(503, 'admin not configured');
    const email = String(process.env.ADMIN_EMAIL).trim().toLowerCase();
    const pw = String(process.env.ADMIN_PASSWORD);
    const salt = crypto.randomBytes(16).toString('hex');
    a = { email, salt, hash: hashPw(pw, salt), ver: 1 };
    await S.setJSON('auth', a);
  }
  return a;
}
async function getSite(S) {
  let d = await S.getJSON('site');
  if (!d) { d = JSON.parse(JSON.stringify(DEFAULTS)); d.updatedAt = Date.now(); await S.setJSON('site', d); }
  return d;
}

/* ---------- الجلسات ---------- */
const hmac = (secret, s) => crypto.createHmac('sha256', secret).update(s).digest('hex');
const newSession = (secret, auth) => {
  const body = (Date.now() + 12 * 3600e3) + '.' + crypto.randomBytes(12).toString('hex') + '.' + auth.ver;
  return body + '.' + hmac(secret, body);
};
function cookieOf(req, name) {
  const m = (req.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}
function sessionOf(req, secret, auth) {
  const c = cookieOf(req, 'sid');
  const p = c.split('.');
  if (p.length !== 4) return null;
  if (!safeEq(hmac(secret, p[0] + '.' + p[1] + '.' + p[2]), p[3])) return null;
  if (+p[0] < Date.now() || +p[2] !== auth.ver) return null;
  return c;
}
const csrfOf = (secret, sid) => hmac(secret, 'csrf.' + sid);
const setCookie = (req, value, maxAge) =>
  [['set-cookie', 'sid=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + (new URL(req.url).protocol === 'https:' ? '; Secure' : '')]];

/* ---------- تحديد المعدّل (مخزّن في Blobs ليعمل بين النسخ) ---------- */
async function limited(S, req, scope, max, windowMs) {
  const ip = req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const key = 'rl/' + scope + '-' + crypto.createHash('sha1').update(ip).digest('hex').slice(0, 16);
  const now = Date.now();
  let h = await S.getJSON(key);
  if (!h || h.reset < now) h = { n: 0, reset: now + windowMs };
  h.n++;
  await S.setJSON(key, h);
  return h.n > max;
}
async function clearLimit(S, req, scope) {
  const ip = req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  await S.del('rl/' + scope + '-' + crypto.createHash('sha1').update(ip).digest('hex').slice(0, 16));
}

/* ---------- الطلب ---------- */
async function readBuf(req, max) {
  const len = +req.headers.get('content-length') || 0;
  if (len > max) throw fail(413, 'big');
  const b = Buffer.from(await req.arrayBuffer());
  if (b.length > max) throw fail(413, 'big');
  return b;
}
async function readJson(req, max) {
  const b = await readBuf(req, max || 1e6);
  try { return JSON.parse(b.toString('utf8') || '{}'); } catch (e) { throw fail(400, 'bad json'); }
}
function sameOrigin(req) {
  const o = req.headers.get('origin');
  if (!o) return true;
  try { return new URL(o).host === new URL(req.url).host; } catch (e) { return false; }
}

/* ---------- تنقية البيانات ---------- */
function cleanData(inp, cur) {
  const st = (inp && inp.site) || {};
  const site = {
    phone: str(st.phone, 30), wa: str(st.wa, 30), currency: str(st.currency, 12) || 'د.ل',
    email: str(st.email, 120), addr: str(st.addr, 200),
    fb: str(st.fb, 200), ig: str(st.ig, 200), tg: str(st.tg, 200),
    h1a: str(st.h1a, 80), h1b: str(st.h1b, 80), hsub: str(st.hsub, 400), about: str(st.about, 1200),
    imgHero: cleanImg(st.imgHero, cur.site.imgHero), imgEmblem: cleanImg(st.imgEmblem, cur.site.imgEmblem), imgFull: cleanImg(st.imgFull, cur.site.imgFull),
  };
  let cats = (Array.isArray(inp.cats) ? inp.cats : []).slice(0, 30)
    .map((c) => ({ id: cleanId(c && c.id, 'k'), n: str(c && c.n, 60) })).filter((c) => c.n);
  if (!cats.length) cats = cur.cats;
  const seen = new Set();
  const courses = (Array.isArray(inp.courses) ? inp.courses : []).slice(0, 200).map((x) => {
    x = x || {};
    return {
      id: cleanId(x.id, 'c'), t: str(x.t, 120), c: cats.some((k) => k.id === x.c) ? x.c : cats[0].id,
      ic: ICONS.includes(x.ic) ? x.ic : 'target', d: str(x.d, 600), tag: str(x.tag, 30), price: str(x.price, 30),
      fmt: str(x.fmt, 60), dur: str(x.dur, 60), start: str(x.start, 60), ins: str(x.ins, 80), top: str(x.top, 1500),
      hide: !!x.hide, closed: !!x.closed,
    };
  }).filter((x) => x.t && !seen.has(x.id) && seen.add(x.id));
  return { site, cats, courses };
}
const publicData = (d) => ({ site: d.site, cats: d.cats, courses: d.courses.filter((c) => !c.hide), v: d.updatedAt });
const adminData = (d) => ({ site: d.site, cats: d.cats, courses: d.courses, v: d.updatedAt });

function renderIndex(d) {
  const s = d.site;
  const data = JSON.stringify(publicData(d)).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return TEMPLATE.split('__DATA__').join(data)
    .split('__IMG_HERO__').join(s.imgHero).split('__IMG_EMBLEM__').join(s.imgEmblem).split('__IMG_FULL__').join(s.imgFull);
}

/* ---------- الصور ---------- */
function sniffImage(b) {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
async function cleanupUploads(S, d) {
  const used = new Set([d.site.imgHero, d.site.imgEmblem, d.site.imgFull].map((u) => u.split('/').pop()));
  const keys = await S.list('up/');
  for (const k of keys) {
    const name = k.slice(3);
    const ts = parseInt((name.split('-')[1] || ''), 36);
    if (!used.has(name) && ts && Date.now() - ts > 24 * 3600e3) await S.del(k);
  }
}

/* ---------- التسجيلات (كل تسجيل في ملف مستقل لتفادي الضياع عند التزامن) ---------- */
const REG_ID = /^\d{14}-[a-f0-9]{8}$/;
async function loadRegs(S, limit) {
  const keys = (await S.list('reg/')).sort().reverse();
  const slice = limit ? keys.slice(0, limit) : keys;
  const out = [];
  for (let i = 0; i < slice.length; i += 25) {
    const part = await Promise.all(slice.slice(i, i + 25).map((k) => S.getJSON(k)));
    part.forEach((r) => r && out.push(r));
  }
  return { regs: out, total: keys.length };
}
const csvCell = (v) => {
  v = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return '"' + v.replace(/"/g, '""') + '"';
};

/* ---------- المسارات ---------- */
async function route(req, S) {
  const url = new URL(req.url);
  const p = url.pathname;
  const method = req.method;

  if (p === '/' || p === '/index.html') {
    const d = await getSite(S);
    return T(renderIndex(d), 200, 'text/html; charset=utf-8');
  }

  if (p.startsWith('/uploads/')) {
    const name = p.slice(9);
    if (!/^[A-Za-z0-9._-]+$/.test(name)) return T('not found', 404);
    const b = await S.getBin('up/' + name);
    if (!b) return T('not found', 404);
    return new Response(b, { status: 200, headers: { 'content-type': MIME[name.split('.').pop()] || 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable', ...SEC } });
  }

  if (!p.startsWith('/api/')) return T('not found', 404);
  if (method !== 'GET' && !sameOrigin(req)) return J({ error: 'origin' }, 403);

  const secret = await getSecret(S);
  const auth = await getAuth(S);

  if (p === '/api/me' && method === 'GET') {
    const sid = sessionOf(req, secret, auth);
    return J(sid ? { admin: true, csrf: csrfOf(secret, sid), email: auth.email } : { admin: false });
  }

  if (p === '/api/login' && method === 'POST') {
    if (await limited(S, req, 'login', 8, 10 * 60e3)) return J({ error: 'many' }, 429);
    const b = await readJson(req, 10e3);
    const email = str(b.email, 200).toLowerCase();
    const h = hashPw(String(b.password || '').slice(0, 200), auth.salt);
    const ok = safeEq(email, auth.email) && safeEq(h, auth.hash);
    if (!ok) return J({ error: 'bad' }, 401);
    await clearLimit(S, req, 'login');
    const sid = newSession(secret, auth);
    return J({ ok: true, csrf: csrfOf(secret, sid), email: auth.email }, 200, setCookie(req, sid, 12 * 3600));
  }

  if (p === '/api/logout' && method === 'POST') return J({ ok: true }, 200, setCookie(req, '', 0));

  if (p === '/api/register' && method === 'POST') {
    if (await limited(S, req, 'reg', 6, 3600e3)) return J({ error: 'many' }, 429);
    const b = await readJson(req, 20e3);
    if (str(b.hp, 50)) return J({ ok: true });
    const site = await getSite(S);
    const name = str(b.name, 80), phone = digitsLatin(str(b.phone, 30)), note = str(b.note, 500);
    const course = site.courses.find((c) => c.id === b.courseId && !c.hide);
    if (name.length < 2 || !/^[0-9+\s()\-]{6,30}$/.test(phone) || !course) return J({ error: 'invalid' }, 400);
    if (course.closed) return J({ error: 'closed' }, 400);
    const ts = Date.now();
    const id = String(ts).padStart(14, '0') + '-' + crypto.randomBytes(4).toString('hex');
    await S.setJSON('reg/' + id, { id, ts, name, phone, courseId: course.id, courseTitle: course.t, note, status: 'new' });
    return J({ ok: true });
  }

  if (p.startsWith('/api/admin/')) {
    const sid = sessionOf(req, secret, auth);
    if (!sid) return J({ error: 'auth' }, 401);
    if (method !== 'GET' && !safeEq(req.headers.get('x-csrf') || '', csrfOf(secret, sid))) return J({ error: 'csrf' }, 403);

    if (p === '/api/admin/data' && method === 'GET') return J({ ...adminData(await getSite(S)), email: auth.email });

    if (p === '/api/admin/data' && method === 'PUT') {
      const b = await readJson(req, 1e6);
      const cur = await getSite(S);
      if (b.baseVersion !== cur.updatedAt) return J({ error: 'stale', v: cur.updatedAt }, 409);
      const d = cleanData(b, cur);
      const next = { site: d.site, cats: d.cats, courses: d.courses, updatedAt: Date.now() };
      await S.setJSON('site', next);
      await cleanupUploads(S, next).catch(() => {});
      return J({ ...adminData(next), ok: true });
    }

    if (p === '/api/admin/password' && method === 'POST') {
      if (await limited(S, req, 'pw', 8, 10 * 60e3)) return J({ error: 'many' }, 429);
      const b = await readJson(req, 10e3);
      if (!safeEq(hashPw(String(b.oldPassword || '').slice(0, 200), auth.salt), auth.hash)) return J({ error: 'bad' }, 401);
      const email = str(b.newEmail, 200).toLowerCase() || auth.email;
      const pw = String(b.newPassword || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return J({ error: 'email' }, 400);
      if (pw.length < 8 || pw.length > 200) return J({ error: 'short' }, 400);
      const salt = crypto.randomBytes(16).toString('hex');
      const next = { email, salt, hash: hashPw(pw, salt), ver: auth.ver + 1 };
      await S.setJSON('auth', next);
      const nsid = newSession(secret, next);
      return J({ ok: true, csrf: csrfOf(secret, nsid), email }, 200, setCookie(req, nsid, 12 * 3600));
    }

    if (p === '/api/admin/upload' && method === 'POST') {
      const kind = url.searchParams.get('kind');
      if (!['hero', 'emblem', 'full'].includes(kind)) return J({ error: 'kind' }, 400);
      const buf = await readBuf(req, 4e6);
      const ext = sniffImage(buf);
      if (!ext) return J({ error: 'type' }, 400);
      const name = kind + '-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex') + '.' + ext;
      await S.setBin('up/' + name, buf);
      return J({ url: '/uploads/' + name });
    }

    if (p === '/api/admin/registrations' && method === 'GET') {
      const r = await loadRegs(S, 300);
      return J(r);
    }
    if (p === '/api/admin/registrations.csv' && method === 'GET') {
      const { regs } = await loadRegs(S, 0);
      const rows = [['التاريخ', 'الاسم', 'الهاتف', 'الدورة', 'ملاحظات', 'الحالة']];
      regs.forEach((r) => rows.push([new Date(r.ts).toISOString().replace('T', ' ').slice(0, 16), r.name, r.phone, r.courseTitle, r.note, STATUS[r.status] || r.status]));
      return T('\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'), 200, 'text/csv; charset=utf-8', [['content-disposition', 'attachment; filename="registrations.csv"']]);
    }
    const m = p.match(/^\/api\/admin\/registrations\/(.+)$/);
    if (m && REG_ID.test(m[1])) {
      const key = 'reg/' + m[1];
      if (method === 'PATCH') {
        const b = await readJson(req, 2e3);
        const r = await S.getJSON(key);
        if (!r || !STATUS[b.status]) return J({ error: 'invalid' }, 400);
        r.status = b.status;
        await S.setJSON(key, r);
        return J({ ok: true });
      }
      if (method === 'DELETE') { await S.del(key); return J({ ok: true }); }
    }
  }
  return J({ error: 'not found' }, 404);
}

export async function handle(req, S) {
  try {
    return await route(req, S);
  } catch (e) {
    if (e && e.status) return J({ error: e.message }, e.status);
    console.error(e);
    return J({ error: 'server' }, 500);
  }
}
