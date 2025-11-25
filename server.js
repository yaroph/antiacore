// Simple static + API server for localhost:3000 without external dependencies
// Usage: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const base = __dirname;
const dataDir = path.join(base, 'saves');
const highscoreFile = path.join(dataDir, 'highscore.json');
const accountsFile  = path.join(dataDir, 'accounts.json');

const mime = {
  '.html': 'text/html; charset=UTF-8',
  '.js':   'application/javascript; charset=UTF-8',
  '.css':  'text/css; charset=UTF-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.json': 'application/json; charset=UTF-8',
  '.ico':  'image/x-icon'
};

function ensureHighscoreFile(){
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(highscoreFile)) fs.writeFileSync(highscoreFile, '[]', 'utf8');
  } catch(e) {
    console.error('ensureHighscoreFile error:', e);
  }
}


function ensureAccountsFile(){
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(accountsFile)) fs.writeFileSync(accountsFile, '[]', 'utf8');
  } catch(e) {
    console.error('ensureAccountsFile error:', e);
  }
}

function readAccounts(){
  ensureAccountsFile();
  try {
    const raw = fs.readFileSync(accountsFile, 'utf8') || '[]';
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch(e) {
    console.error('readAccounts error:', e);
    return [];
  }
}

function writeAccounts(list){
  try {
    ensureAccountsFile();
    fs.writeFileSync(accountsFile, JSON.stringify(list, null, 2), 'utf8');
  } catch(e) {
    console.error('writeAccounts error:', e);
  }
}

function normalizeName(s){
  return String(s||'').trim().toLowerCase();
}

function findAccountByName(firstName, lastName){
  const f = normalizeName(firstName);
  const l = normalizeName(lastName);
  const list = readAccounts();
  const index = list.findIndex(a =>
    normalizeName(a.firstName) === f &&
    normalizeName(a.lastName) === l
  );
  return { index, account: index >= 0 ? list[index] : null, list };
}

function hashPassword(password, salt){
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256')
    .update(String(password||'') + ':' + salt)
    .digest('hex');
  return { salt, hash };
}

function readHighscores(){
  ensureHighscoreFile();
  ensureAccountsFile();
  try {
    const raw = fs.readFileSync(highscoreFile, 'utf8');
    const data = JSON.parse(raw || '[]');
    return Array.isArray(data) ? data : [];
  } catch(e) {
    console.error('readHighscores error:', e);
    return [];
  }
}

function writeHighscores(list){
  try {
    fs.writeFileSync(highscoreFile, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch(e) {
    console.error('writeHighscores error:', e);
    return false;
  }
}

function sendJson(res, code, obj){
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
}

function sendText(res, code, text){
  res.writeHead(code, {
    'Content-Type': 'text/plain; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(text);
}

function sendFile(res, filePath){
  fs.readFile(filePath, (err, data) => {
    if (err) return sendText(res, 404, 'Not found');
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const urlPath = parsedUrl.pathname;

  // CORS preflight already handled above for all /api/*

  // Route: POST /api/auth/register
  if (req.method === 'POST' && urlPath === '/api/auth/register') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const firstName = String(payload.firstName || payload.prenom || '').trim();
        const lastName  = String(payload.lastName  || payload.nom    || '').trim();
        const password  = String(payload.password  || '').trim();
        if (!firstName || !lastName || !password) {
          return sendJson(res, 400, { ok:false, error: 'MISSING_FIELDS' });
        }
        const { account, list, index } = findAccountByName(firstName, lastName);
        if (account) {
          return sendJson(res, 400, { ok:false, error: 'ACCOUNT_EXISTS' });
        }
        const fullName = `${firstName} ${lastName}`.trim();
        const { salt, hash } = hashPassword(password);
        const id = `user:${sanitizeNamePart(lastName)}_${sanitizeNamePart(firstName)}`;
        const now = Date.now();
        const newAcc = {
          id,
          firstName,
          lastName,
          fullName,
          salt,
          password: password,
          passwordHash: hash,
          createdAt: now,
          updatedAt: now,
          stats: {
            bestScore: 0,
            bestDistance: 0,
            bestCaptures: 0,
            collection: []
          }
        };
        list.push(newAcc);
        writeAccounts(list);
        return sendJson(res, 200, {
          ok: true,
          account: {
            id: newAcc.id,
            firstName: newAcc.firstName,
            lastName: newAcc.lastName,
            fullName: newAcc.fullName,
            stats: newAcc.stats
          }
        });
      } catch(e) {
        console.error('POST /api/auth/register error:', e);
        return sendJson(res, 400, { ok:false, error: 'INVALID_JSON' });
      }
    });
    return;
  }

  // Route: POST /api/auth/login
  if (req.method === 'POST' && urlPath === '/api/auth/login') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const firstName = String(payload.firstName || payload.prenom || '').trim();
        const lastName  = String(payload.lastName  || payload.nom    || '').trim();
        const password  = String(payload.password  || '').trim();
        if (!firstName || !lastName || !password) {
          return sendJson(res, 400, { ok:false, error: 'MISSING_FIELDS' });
        }
        const { account, index, list } = findAccountByName(firstName, lastName);
        if (!account) {
          return sendJson(res, 404, { ok:false, error: 'NOT_FOUND' });
        }
        const hp = hashPassword(password, account.salt);
        if (hp.hash !== account.passwordHash) {
          return sendJson(res, 401, { ok:false, error: 'BAD_PASSWORD' });
        }
        return sendJson(res, 200, {
          ok: true,
          account: {
            id: account.id,
            firstName: account.firstName,
            lastName: account.lastName,
            fullName: account.fullName,
            stats: account.stats || null
          }
        });
      } catch(e) {
        console.error('POST /api/auth/login error:', e);
        return sendJson(res, 400, { ok:false, error: 'INVALID_JSON' });
      }
    });
    return;
  }

  // Route: POST /api/account/updateStats
  if (req.method === 'POST' && urlPath === '/api/account/updateStats') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const firstName = String(payload.firstName || payload.prenom || '').trim();
        const lastName  = String(payload.lastName  || payload.nom    || '').trim();
        if (!firstName || !lastName) {
          return sendJson(res, 400, { ok:false, error: 'MISSING_NAME' });
        }
        const score    = Number(payload.score)||0;
        const distance = Number(payload.distance)||0;
        const captures = Number(payload.captures)||0;
        const collection = Array.isArray(payload.collection) ? payload.collection : null;

        const find = findAccountByName(firstName, lastName);
        let { account, list, index } = find;
        if (!account) {
          return sendJson(res, 404, { ok:false, error: 'NOT_FOUND' });
        }
        const stats = account.stats || {};
        stats.bestScore     = Math.max(Number(stats.bestScore)||0, score);
        stats.bestDistance  = Math.max(Number(stats.bestDistance)||0, distance);
        stats.bestCaptures  = Math.max(Number(stats.bestCaptures)||0, captures);
        if (collection) {
          stats.collection = collection;
        }
        account.stats = stats;
        account.updatedAt = Date.now();
        if (index >= 0) {
          list[index] = account;
        }
        writeAccounts(list);
        return sendJson(res, 200, { ok:true, stats });
      } catch(e) {
        console.error('POST /api/account/updateStats error:', e);
        return sendJson(res, 400, { ok:false, error: 'INVALID_JSON' });
      }
    });
    return;
  }


  // Route: POST /api/reponses/save (store personal answers server-side)
  if (req.method === 'POST' && urlPath === '/api/reponses/save') {
    return handleSaveReponse(req, res);
  }


  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    return res.end();
  }

  // API: GET highscores
  if (req.method === 'GET' && urlPath === '/api/highscores') {
    return sendJson(res, 200, { highscores: readHighscores() });
  }

  // API: POST upsert highscore
  if (req.method === 'POST' && urlPath === '/api/highscores') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { id, nom, prenom, distance, captures, score } = payload || {};
        if (!id && !prenom && !nom) {
          return sendJson(res, 400, { error: 'Missing player id/nom/prenom' });
        }
        const list = readHighscores();
        const matchIndex = list.findIndex(e => e && (e.id === id ||
          ((e.prenom||'').toLowerCase() === String(prenom||'').toLowerCase() &&
           (e.nom||'').toLowerCase() === String(nom||'').toLowerCase())));
        const entry = {
          id: id || `anon:${Math.random().toString(36).slice(2)}`,
          nom: String(nom||'').trim() || '?',
          prenom: String(prenom||'').trim() || '?',
          distance: Number(distance)||0,
          captures: Number(captures)||0,
          score: Number(score)||0,
          updatedAt: Date.now()
        };
        if (matchIndex === -1) {
          list.push(entry);
        } else {
          const prev = list[matchIndex] || {};
          // Only keep personal bests (greater-or-equal update)
          list[matchIndex] = {
            ...prev,
            nom: entry.nom || prev.nom,
            prenom: entry.prenom || prev.prenom,
            distance: Math.max(Number(prev.distance)||0, entry.distance),
            captures: Math.max(Number(prev.captures)||0, entry.captures),
            score: Math.max(Number(prev.score)||0, entry.score),
            updatedAt: Date.now()
          };
        }
        // Sort desc by score then captures then distance
        list.sort((a,b) => (b.score||0)-(a.score||0) || (b.captures||0)-(a.captures||0) || (b.distance||0)-(a.distance||0));
        writeHighscores(list);
        return sendJson(res, 200, { ok: true, highscores: list });
      } catch(e) {
        console.error('POST /api/highscores error:', e);
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  

// Admin: GET /api/admin/accounts
// Simple listing of accounts + link to their réponses JSON (for the /database page)
if (req.method === 'GET' && urlPath === '/api/admin/accounts') {
  const accounts = readAccounts().map(acc => {
    const first = acc.firstName || '';
    const last  = acc.lastName  || '';
    const fname = sanitizeNamePart(last) + '_' + sanitizeNamePart(first) + '.json';
    const reponsesPath = path.join(base, 'reponses', fname);
    const hasReponses = fs.existsSync(reponsesPath);
    return {
      id: acc.id,
      firstName: first,
      lastName: last,
      fullName: acc.fullName || `${first} ${last}`.trim(),
      password: acc.password || null,
      hasReponses,
      reponsesFile: hasReponses ? `/reponses/${fname}` : null
    };
  });
  return sendJson(res, 200, { ok:true, accounts });
}

// Static files
  let filePath = path.join(base, decodeURIComponent(urlPath.replace(/^\/+/, '')));

// Hidden admin page: /database -> /database.html
if (urlPath === '/database') {
  filePath = path.join(base, 'database.html');
}

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (urlPath === '/' || !fs.existsSync(filePath)) {
    filePath = path.join(base, 'index.html');
  }
  return sendFile(res, filePath);
});


// === Personal answers save API ===
function ensureReponsesDir(){
  const dir = path.join(base, 'reponses');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function sanitizeNamePart(s){
  s = String(s||'').trim().toLowerCase();
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return s || 'x';
}
async function handleSaveReponse(req, res){
  try{
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    await new Promise(r => req.on('end', r));
    const data = JSON.parse(body||'{}');
    const first = data.firstName || data.first || '';
    const last  = data.lastName  || data.last  || '';
    if (!first || !last) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
      res.end(JSON.stringify({ ok:false, error:'missing first/last name' }));
      return;
    }
    const question = String(data.question||'');
    const tag = String(data.tag||'');
    const answer = String(data.answer||data.anwser||'');
    const dir = ensureReponsesDir();
    const fname = sanitizeNamePart(last) + '_' + sanitizeNamePart(first) + '.json';
    const fpath = path.join(dir, fname);
    let fileJson = { firstName:first, lastName:last, updatedAt: Date.now(), answers: [] };
    if (fs.existsSync(fpath)) {
      try{ fileJson = JSON.parse(fs.readFileSync(fpath, 'utf-8')||'{}'); }
      catch(e){ /* ignore */ }
      if (!Array.isArray(fileJson.answers)) fileJson.answers = [];
    }
    // upsert by tag if present else by question
    const key = tag || question;
    let entry = fileJson.answers.find(a => (a.tag||a.question) === key);
    if (!entry) {
      entry = { question, tag, anwser: "", anwserlast: "" };
      fileJson.answers.push(entry);
    } else {
      // keep question/tag fresh
      if (question) entry.question = question;
      if (tag) entry.tag = tag;
    }
    if (!entry.anwser) {
      entry.anwser = answer;
    } else {
      entry.anwserlast = answer;
    }
    fileJson.updatedAt = Date.now();
    fs.writeFileSync(fpath, JSON.stringify(fileJson, null, 2), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
    res.end(JSON.stringify({ ok:true, file: '/reponses/'+fname }));
  }catch(e){
    res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8' });
    res.end(JSON.stringify({ ok:false, error: String(e&&e.message || e) }));
  }
}

server.on('request', (req, res) => {});
server.listen(PORT, () => {
  ensureHighscoreFile();
  ensureAccountsFile();
  console.log(`Server running at http://localhost:${PORT}`);
});