#!/usr/bin/env node
/**
 * Lokal stedfortreder for Supabase, til utvikling og test uten Docker.
 *
 *   REST     → ekte PostgREST foran den lokale databasen (RLS virker som i prod)
 *   Auth     → utsteder økter uten e-post (se «Logge inn» i README.md)
 *   Storage  → filer på disk; hver operasjon sjekkes mot policyene på
 *              storage.objects ved å kjøre den som brukerens rolle i databasen
 *
 * Startes av supabase/local/start.sh. Skal aldri kjøre i produksjon: den
 * logger inn hvem som helst uten bevis for e-postadressen.
 */
import { createServer, request as httpRequest } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const PORT = Number(process.env.LOCAL_SUPABASE_PORT ?? 54400);
const REST_PORT = Number(process.env.LOCAL_POSTGREST_PORT ?? 54401);
const SECRET = process.env.LOCAL_JWT_SECRET ?? 'lokal-utvikling-hemmelighet-minst-32-tegn-lang';
const FILES = process.env.LOCAL_STORAGE_DIR ?? '/tmp/nwc-local-storage';
const PG = {
  PGHOST: process.env.PGHOST ?? '127.0.0.1',
  PGPORT: process.env.PGPORT ?? '54329',
  PGUSER: process.env.PGUSER ?? 'postgres',
  PGDATABASE: process.env.PGDATABASE ?? 'nwc',
};

const b64 = (value) => Buffer.from(value).toString('base64url');
const unb64 = (value) => Buffer.from(value, 'base64url').toString('utf8');

function sign(payload) {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify(payload));
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

function verify(token) {
  const [head, body, sig] = (token ?? '').split('.');
  if (!head || !body || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  if (expected !== sig) return null;
  const claims = JSON.parse(unb64(body));
  return claims.exp && claims.exp < Date.now() / 1000 ? null : claims;
}

// `node server.mjs --print-anon-key`: anon-nøkkelen til .env.local.
if (process.argv.includes('--print-anon-key')) {
  console.log(sign({ role: 'anon', iss: 'local', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 3650 }));
  process.exit(0);
}

/** Kjører SQL som superbruker og returnerer JSON fra første kolonne. */
function sql(query, vars = {}) {
  const args = ['-Atq', '-v', 'ON_ERROR_STOP=1'];
  for (const [key, value] of Object.entries(vars)) args.push('-v', `${key}=${value}`);
  const out = execFileSync('psql', args, { env: { ...process.env, ...PG }, input: query, encoding: 'utf8' });
  // Siste linje er svaret; linjene foran kommer fra set_config og lignende.
  const line = out.trim().split('\n').filter(Boolean).pop();
  if (!line) return null;
  try { return JSON.parse(line); } catch { return null; }
}

/**
 * Kjører SQL slik PostgREST ville gjort det for denne forespørselen: som
 * rollen i JWT-en, med claims satt. Da avgjør policyene på storage.objects.
 */
function sqlAs(claims, query, vars = {}) {
  const role = claims?.role === 'authenticated' ? 'authenticated' : 'anon';
  return sql(
    `begin;
     select set_config('request.jwt.claims', :'claims', true);
     set local role ${role};
     ${query}
     commit;`,
    { ...vars, claims: JSON.stringify(claims ?? { role: 'anon' }) },
  );
}

function userFor(email) {
  const normalized = email.trim().toLowerCase();
  return sql(
    `insert into auth.users (email, email_confirmed_at)
     values (:'email', now())
     on conflict (email) do update set email_confirmed_at = coalesce(auth.users.email_confirmed_at, now())
     returning json_build_object('id', id, 'email', email, 'created_at', created_at,
                                 'app_metadata', raw_app_meta_data);`,
    { email: normalized },
  );
}

function session(user) {
  const now = Math.floor(Date.now() / 1000);
  const expires = now + 60 * 60 * 24;
  const access_token = sign({
    sub: user.id, role: 'authenticated', aud: 'authenticated', email: user.email,
    app_metadata: user.app_metadata ?? {}, user_metadata: {}, iat: now, exp: expires,
  });
  return {
    access_token,
    token_type: 'bearer',
    expires_in: expires - now,
    expires_at: expires,
    refresh_token: b64(user.email),
    user: authUser(user),
  };
}

const authUser = (user) => ({
  id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email,
  email_confirmed_at: user.created_at, confirmed_at: user.created_at,
  app_metadata: { provider: 'email', providers: ['email'], ...(user.app_metadata ?? {}) },
  user_metadata: {}, identities: [], created_at: user.created_at, updated_at: user.created_at,
});

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json' : 'text/plain',
    ...CORS, ...headers,
  });
  res.end(payload);
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
  'access-control-expose-headers': '*',
};

const bearer = (req) => verify((req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')) ?? { role: 'anon' };
const filePath = (bucket, name) => join(FILES, bucket, name);

async function handleAuth(req, res, url) {
  const path = url.pathname.replace('/auth/v1', '');
  const body = ['POST', 'PUT'].includes(req.method) ? JSON.parse((await readBody(req)).toString() || '{}') : {};

  if (path === '/settings') return send(res, 200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: false });

  // «Send innloggingslenke»: det sendes ingen e-post. Koden er adressen selv,
  // og skrives ut her slik at man kan åpne lenken.
  if (path === '/otp' && req.method === 'POST') {
    userFor(body.email);
    console.log(`\n[auth] Innloggingslenke for ${body.email}:\n       http://localhost:3000/auth/callback?code=${b64(body.email.toLowerCase())}\n`);
    return send(res, 200, {});
  }

  if (path === '/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    const email = grant === 'pkce' ? unb64(body.auth_code ?? '') : grant === 'refresh_token' ? unb64(body.refresh_token ?? '') : body.email;
    if (!email || !email.includes('@')) return send(res, 400, { error: 'invalid_grant', error_description: 'Ugyldig kode' });
    return send(res, 200, session(userFor(email)));
  }

  if (path === '/user' && req.method === 'GET') {
    const claims = bearer(req);
    if (!claims.sub) return send(res, 401, { code: 401, msg: 'Ugyldig token' });
    return send(res, 200, authUser(userFor(claims.email)));
  }

  if (path === '/logout') return send(res, 204);
  return send(res, 404, { error: `auth: ${path} er ikke støttet lokalt` });
}

async function handleStorage(req, res, url) {
  const claims = bearer(req);
  const parts = url.pathname.replace('/storage/v1/object/', '').split('/').map(decodeURIComponent);

  // Offentlig bøtte
  if (parts[0] === 'public' && req.method === 'GET') {
    const [, bucket, ...rest] = parts;
    const file = filePath(bucket, rest.join('/'));
    return existsSync(file) ? send(res, 200, readFileSync(file), { 'content-type': 'image/jpeg' }) : send(res, 404, { error: 'not_found' });
  }

  // Signerte lenker
  if (parts[0] === 'sign') {
    const [, bucket, ...rest] = parts;
    if (req.method === 'GET') {
      const file = filePath(bucket, rest.join('/'));
      const ok = verify(url.searchParams.get('token'))?.path === `${bucket}/${rest.join('/')}`;
      return ok && existsSync(file) ? send(res, 200, readFileSync(file), { 'content-type': 'image/jpeg' }) : send(res, 400, { error: 'invalid_token' });
    }
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    const wanted = rest.length ? [rest.join('/')] : body.paths ?? [];
    // Bare filene denne rollen får lese, blir signert.
    const visible = sqlAs(claims,
      `select coalesce(json_agg(name), '[]'::json) from storage.objects
       where bucket_id = :'bucket' and name = any (string_to_array(:'names', chr(31)));`,
      { bucket, names: wanted.join('\u001f') });
    const exp = Math.floor(Date.now() / 1000) + (body.expiresIn ?? 3600);
    const signedFor = (name) => `/object/sign/${bucket}/${name}?token=${sign({ path: `${bucket}/${name}`, exp })}`;
    if (rest.length) {
      return visible.includes(wanted[0])
        ? send(res, 200, { signedURL: signedFor(wanted[0]) })
        : send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    }
    return send(res, 200, wanted.map((name) => visible.includes(name)
      ? { path: name, signedURL: signedFor(name), error: null }
      : { path: name, signedURL: null, error: 'Either the object does not exist or you do not have access to it' }));
  }

  const [bucket, ...rest] = parts;
  const name = rest.join('/');

  if (req.method === 'POST' || req.method === 'PUT') {
    const raw = await readBody(req);
    try {
      // Uten RETURNING: da kreves bare INSERT-policyen, som i Supabase Storage.
      sqlAs(claims, `insert into storage.objects (bucket_id, name, owner)
                     values (:'bucket', :'name', nullif(:'owner', '')::uuid);`,
        { bucket, name, owner: claims.sub ?? '' });
    } catch (error) {
      const message = String(error.stderr ?? error.message);
      const denied = /row-level security|permission denied/.test(message);
      const duplicate = /duplicate key/.test(message);
      console.log(`[storage] AVVIST opplasting ${bucket}/${name} (${claims.role}): ${denied ? 'policy' : duplicate ? 'finnes' : message.trim().split('\n')[0]}`);
      return send(res, 400, {
        statusCode: denied ? '403' : duplicate ? '409' : '400',
        error: denied ? 'Unauthorized' : duplicate ? 'Duplicate' : 'Error',
        message: denied ? 'new row violates row-level security policy' : 'The resource already exists',
      });
    }
    const file = filePath(bucket, name);
    mkdirSync(dirname(file), { recursive: true });
    // supabase-js sender enten rå bytes eller multipart; ta ut filen fra multipart.
    const type = req.headers['content-type'] ?? '';
    let data = raw;
    if (type.startsWith('multipart/form-data')) {
      // supabase-js sender cacheControl som eget felt foran filen; filen er
      // delen som har et filnavn.
      const boundary = Buffer.from(`--${type.split('boundary=')[1]}`);
      const filePart = raw.indexOf(Buffer.from('filename='));
      const start = raw.indexOf(Buffer.from('\r\n\r\n'), filePart >= 0 ? filePart : raw.indexOf(boundary)) + 4;
      const end = raw.indexOf(boundary, start) - 2;
      data = raw.subarray(start, end);
    }
    writeFileSync(file, data);
    return send(res, 200, { Key: `${bucket}/${name}`, Id: randomUUID() });
  }

  if (req.method === 'GET') {
    const visible = sqlAs(claims,
      `select to_json(count(*)) from storage.objects where bucket_id = :'bucket' and name = :'name';`, { bucket, name });
    const file = filePath(bucket, name);
    return visible > 0 && existsSync(file)
      ? send(res, 200, readFileSync(file), { 'content-type': 'image/jpeg' })
      : send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
  }

  if (req.method === 'DELETE') {
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    const names = name ? [name] : body.prefixes ?? [];
    const deleted = sqlAs(claims,
      `with gone as (delete from storage.objects
         where bucket_id = :'bucket' and name = any (string_to_array(:'names', chr(31))) returning name)
       select coalesce(json_agg(json_build_object('name', name)), '[]'::json) from gone;`,
      { bucket: name ? bucket : parts[0], names: names.join('\u001f') });
    for (const item of deleted) rmSync(filePath(name ? bucket : parts[0], item.name), { force: true });
    return send(res, 200, deleted);
  }

  return send(res, 405, { error: 'method_not_allowed' });
}

function proxyRest(req, res, url) {
  const upstream = httpRequest(
    { host: '127.0.0.1', port: REST_PORT, method: req.method, path: url.pathname.replace('/rest/v1', '') + url.search, headers: { ...req.headers, host: `127.0.0.1:${REST_PORT}` } },
    (up) => { res.writeHead(up.statusCode ?? 502, { ...up.headers, ...CORS }); up.pipe(res); },
  );
  upstream.on('error', () => send(res, 502, { message: 'PostgREST svarer ikke. Kjører start.sh?' }));
  req.pipe(upstream);
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === 'OPTIONS') return send(res, 204);
    if (url.pathname.startsWith('/rest/v1')) return proxyRest(req, res, url);
    if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url);
    if (url.pathname.startsWith('/storage/v1/object')) return await handleStorage(req, res, url);
    return send(res, 404, { error: 'ikke støttet lokalt', path: url.pathname });
  } catch (error) {
    console.error('[local]', req.method, url.pathname, String(error.stderr ?? error.message).trim().split('\n')[0]);
    return send(res, 500, { message: 'Lokal feil – se terminalen.' });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Lokal Supabase på http://localhost:${PORT}  (PostgREST :${REST_PORT}, filer i ${FILES})`);
});
