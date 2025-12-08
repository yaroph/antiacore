import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const accountsStore   = getStore("angry-flappy-accounts");
const highscoresStore = getStore("angry-flappy-highscores");
const reponsesStore   = getStore("angry-flappy-reponses");

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

function normalizeName(s){
  return String(s || "").trim().toLowerCase();
}

function sanitizeNamePart(s){
  s = String(s||"").trim().toLowerCase();
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return s || "x";
}

function hashPassword(password, salt){
  salt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256")
    .update(String(password || "") + ":" + salt)
    .digest("hex");
  return { salt, hash };
}

async function readAccounts(){
  const data = await accountsStore.get("all", { type: "json" }).catch(() => null);
  return Array.isArray(data) ? data : [];
}

async function writeAccounts(list){
  await accountsStore.setJSON("all", list);
}

async function readHighscores(){
  const data = await highscoresStore.get("all", { type: "json" }).catch(() => null);
  return Array.isArray(data) ? data : [];
}

async function writeHighscores(list){
  await highscoresStore.setJSON("all", list);
}

async function findAccountByName(firstName, lastName){
  const f = normalizeName(firstName);
  const l = normalizeName(lastName);
  const list = await readAccounts();
  const index = list.findIndex(a =>
    normalizeName(a.firstName) === f &&
    normalizeName(a.lastName) === l
  );
  return { index, account: index >= 0 ? list[index] : null, list };
}

async function getReponsesInfoForAccount(acc){
  const first = acc.firstName || "";
  const last  = acc.lastName  || "";
  const fname = sanitizeNamePart(last) + "_" + sanitizeNamePart(first) + ".json";
  const key   = fname;
  const entry = await reponsesStore.getWithMetadata(key).catch(() => null);
  const hasReponses = !!entry;
  return {
    hasReponses,
    reponsesFile: hasReponses ? ("/reponses/" + fname) : null
  };
}

export const config = {
  path: ["/api/*", "/reponses/*"]
};

export default async (req, context) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: JSON_HEADERS });
  }

  // --------- Download a single réponses file (for /reponses/xxx.json) ----------
  if (pathname.startsWith("/reponses/") && req.method === "GET") {
    const fname = pathname.replace(/^\/reponses\//, "");
    if (!fname) {
      return new Response("Missing file name", { status: 400 });
    }
    const entry = await reponsesStore.get(fname, { type: "text" }).catch(() => null);
    if (entry === null) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(entry, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Access-Control-Allow-Origin": "*",
        "Content-Disposition": `attachment; filename="${fname}"`
      }
    });
  }

  // Helper to parse JSON body safely
  async function readBodyJSON(){
    try {
      return await req.json();
    } catch (e) {
      return null;
    }
  }

  // ------------------- Auth: Register -------------------
  if (pathname === "/api/auth/register" && req.method === "POST") {
    const body = await readBodyJSON();
    if (!body) return json(400, { ok:false, error: "Invalid JSON" });

    const firstName = String(body.firstName || body.first || "").trim();
    const lastName  = String(body.lastName  || body.last  || "").trim();
    const password  = String(body.password  || "").trim();

    if (!firstName || !lastName || !password){
      return json(400, { ok:false, error: "MISSING_FIELDS" });
    }

    const { index, account, list } = await findAccountByName(firstName, lastName);
    if (account){
      return json(400, { ok:false, error: "ACCOUNT_EXISTS" });
    }

    const { salt, hash } = hashPassword(password);
    const now = Date.now();

    const newAccount = {
      id: "acc_" + now.toString(36) + "_" + Math.random().toString(36).slice(2),
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      password,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
      stats: {
        bestScore: 0,
        bestDistance: 0,
        bestCaptures: 0,
        totalGames: 0
      }
    };

    list.push(newAccount);
    await writeAccounts(list);

    const { passwordSalt, passwordHash, ...safeAccount } = newAccount;
    return json(200, { ok:true, account: safeAccount });
  }

  // ------------------- Auth: Login -------------------
  if (pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readBodyJSON();
    if (!body) return json(400, { ok:false, error: "Invalid JSON" });

    const firstName = String(body.firstName || body.first || "").trim();
    const lastName  = String(body.lastName  || body.last  || "").trim();
    const password  = String(body.password  || "").trim();

    if (!firstName || !lastName || !password){
      return json(400, { ok:false, error: "MISSING_FIELDS" });
    }

    const { account } = await findAccountByName(firstName, lastName);
    if (!account){
      return json(404, { ok:false, error: "NOT_FOUND" });
    }

    const { hash } = hashPassword(password, account.passwordSalt);
    if (hash !== account.passwordHash){
      return json(401, { ok:false, error: "BAD_PASSWORD" });
    }

    const { passwordSalt, passwordHash, password: clearPass, ...safeAccount } = account;
    return json(200, { ok:true, account: safeAccount });
  }

  // ------------------- Account stats update -------------------
  if (pathname === "/api/account/updateStats" && req.method === "POST") {
    const body = await readBodyJSON();
    if (!body) return json(400, { ok:false, error: "Invalid JSON" });

    const firstName = String(body.firstName || body.first || "").trim();
    const lastName  = String(body.lastName  || body.last  || "").trim();
    if (!firstName || !lastName) {
      return json(400, { ok:false, error: "MISSING_NAME" });
    }

    const { index, account, list } = await findAccountByName(firstName, lastName);
    if (!account) {
      return json(404, { ok:false, error: "NOT_FOUND" });
    }

    const now = Date.now();
    const dist = Number(body.distance || body.bestDistance || 0) || 0;
    const caps = Number(body.captures || body.bestCaptures || 0) || 0;
    const score = Number(body.score || body.bestScore || 0) || 0;
    const totalGames = Number(body.totalGames || 0) || 0;

    account.stats = account.stats || {
      bestScore: 0,
      bestDistance: 0,
      bestCaptures: 0,
      totalGames: 0
    };

    account.stats.bestScore    = Math.max(account.stats.bestScore    || 0, score);
    account.stats.bestDistance = Math.max(account.stats.bestDistance || 0, dist);
    account.stats.bestCaptures = Math.max(account.stats.bestCaptures || 0, caps);
    account.stats.totalGames   = Math.max(account.stats.totalGames   || 0, totalGames);

    account.updatedAt = now;
    list[index] = account;
    await writeAccounts(list);

    return json(200, { ok:true, stats: account.stats });
  }

  
  
  // ------------------- Personal answers: POST /api/reponses/save -------------------
  if (pathname === "/api/reponses/save" && req.method === "POST") {
    const body = await readBodyJSON();
    if (!body) return json(400, { ok:false, error: "Invalid JSON" });

    const first = String(body.firstName || body.first || "").trim();
    const last  = String(body.lastName  || body.last  || "").trim();
    if (!first || !last) {
      return json(400, { ok:false, error: "MISSING_NAME" });
    }

    const question = String(body.question || "").trim();
    const tag      = String(body.tag || "").trim();
    const answer   = String(body.answer || body.anwser || "").trim();

    if (!question && !answer) {
      return json(400, { ok:false, error: "EMPTY_PAYLOAD" });
    }

    const fname = sanitizeNamePart(last) + "_" + sanitizeNamePart(first) + ".json";
    const key   = fname;

    let fileJson = await reponsesStore.get(key, { type: "json" }).catch(() => null);
    const now = Date.now();
    if (!fileJson || typeof fileJson !== "object") {
      fileJson = {
        firstName: first,
        lastName: last,
        fullName: `${first} ${last}`.trim(),
        createdAt: now,
        updatedAt: now,
        answers: []
      };
    }

    const answers = Array.isArray(fileJson.answers) ? fileJson.answers : [];

    let entry = answers.find(e =>
      String(e.question || "") === question &&
      String(e.tag || "") === tag
    );

    if (!entry) {
      entry = {
        id: "q_" + now.toString(36) + "_" + Math.random().toString(36).slice(2),
        question,
        tag,
        anwser: answer,
        createdAt: now,
        lastAnswerAt: now
      };
      answers.push(entry);
    } else {
      if (question) entry.question = question;
      if (tag) entry.tag = tag;
      if (!entry.anwser) {
        entry.anwser = answer;
      } else {
        entry.anwserlast = answer;
      }
      entry.lastAnswerAt = now;
    }

    fileJson.answers = answers;
    fileJson.firstName = first;
    fileJson.lastName = last;
    fileJson.fullName = `${first} ${last}`.trim();
    fileJson.updatedAt = now;

    await reponsesStore.setJSON(key, fileJson);

    return json(200, { ok:true, file: "/reponses/" + fname });
  }

// ------------------- Highscores: GET -------------------
  if (pathname === "/api/highscores" && req.method === "GET") {
    const highscores = await readHighscores();
    return json(200, { ok:true, highscores });
  }

  // ------------------- Highscores: POST (submit) -------------------
  if (pathname === "/api/highscores" && req.method === "POST") {
    const body = await readBodyJSON();
    if (!body) return json(400, { ok:false, error: "Invalid JSON" });

    const prenom   = String(body.prenom || body.firstName || "").trim();
    const nom      = String(body.nom    || body.lastName  || "").trim();
    const id       = body.id ? String(body.id) : null;
    const distance = Number(body.distance || 0) || 0;
    const captures = Number(body.captures || 0) || 0;
    const score    = Number(body.score    || 0) || 0;

    if (!id && !prenom && !nom){
      return json(400, { ok:false, error: "MISSING_PLAYER" });
    }

    const list = await readHighscores();
    const matchIndex = list.findIndex(e => e && (
      (id && e.id === id) ||
      ((!id) &&
       (String(e.prenom || "").toLowerCase() === prenom.toLowerCase()) &&
       (String(e.nom    || "").toLowerCase() === nom.toLowerCase()))
    ));

    const entry = {
      id: id || `anon:${Math.random().toString(36).slice(2)}`,
      nom: nom || "?",
      prenom: prenom || "?",
      distance,
      captures,
      score,
      updatedAt: Date.now()
    };

    if (matchIndex === -1) {
      list.push(entry);
    } else {
      const old = list[matchIndex];
      entry.distance = Math.max(old.distance || 0, distance);
      entry.captures = Math.max(old.captures || 0, captures);
      entry.score    = Math.max(old.score    || 0, score);
      list[matchIndex] = entry;
    }

    // sort by score desc, then distance desc, then captures desc
    list.sort((a, b) => (b.score || 0) - (a.score || 0) ||
                        (b.distance || 0) - (a.distance || 0) ||
                        (b.captures || 0) - (a.captures || 0));

    await writeHighscores(list);
    return json(200, { ok:true, highscores: list });
  }

  
  // ------------------- Admin: list accounts -------------------
  if (pathname === "/api/admin/accounts" && req.method === "GET") {
    const accountsList = await readAccounts();

    const enriched = [];
    for (const acc of accountsList) {
      const info = await getReponsesInfoForAccount(acc);
      enriched.push({
        id: acc.id,
        firstName: acc.firstName || "",
        lastName: acc.lastName || "",
        fullName: acc.fullName || `${acc.firstName || ""} ${acc.lastName || ""}`.trim(),
        password: acc.password || null,
        hasReponses: info.hasReponses,
        reponsesFile: info.reponsesFile,
        updatedAt: acc.updatedAt || acc.createdAt || null
      });
    }

    return json(200, { ok:true, accounts: enriched });
  }

  // Fallback
  return json(404, { ok:false, error: "Not found" });
};
