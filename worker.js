
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Telegram-Init-Data"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) return null;

  params.delete("hash");
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join("\n");

  const secretKey = await hmac(new TextEncoder().encode("WebAppData"), botToken);
  const calculatedHash = hex(await hmac(secretKey, dataCheckString));

  const a = new TextEncoder().encode(calculatedHash);
  const b = new TextEncoder().encode(receivedHash.toLowerCase());
  if (a.length !== b.length) return null;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  if (mismatch !== 0) return null;

  const authDate = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate > now + 60 || now - authDate > 86400) {
    return null;
  }

  try {
    const user = JSON.parse(params.get("user") || "null");
    if (!user || !user.id) return null;
    return user;
  } catch {
    return null;
  }
}

async function authenticate(request, env) {
  const initData = request.headers.get("X-Telegram-Init-Data");
  return validateTelegramInitData(initData, env.BOT_TOKEN);
}

async function handleMe(user, env) {
  const db = env.DB;

  await db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, last_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      updated_at = datetime('now')
  `).bind(
    String(user.id),
    user.username || null,
    user.first_name || null,
    user.last_name || null
  ).run();

  const account = await db.prepare(`
    SELECT balance FROM users WHERE telegram_id = ?
  `).bind(String(user.id)).first();

  const tasksResult = await db.prepare(`
    SELECT id, title, description, reward
    FROM tasks WHERE active = 1 ORDER BY id DESC LIMIT 50
  `).all();

  const withdrawals = await db.prepare(`
    SELECT COUNT(*) AS total FROM withdrawals WHERE telegram_id = ?
  `).bind(String(user.id)).first();

  const referralCount = await db.prepare(`
    SELECT COUNT(*) AS total FROM users WHERE referred_by = ?
  `).bind(String(user.id)).first();

  const referralUrl = env.BOT_USERNAME
    ? `https://t.me/${env.BOT_USERNAME}?start=ref_${user.id}`
    : "";

  return json({
    user: {
      id: String(user.id),
      first_name: user.first_name || "",
      username: user.username || ""
    },
    balance: account?.balance || 0,
    tasks: tasksResult.results || [],
    referral_count: referralCount?.total || 0,
    withdrawal_count: withdrawals?.total || 0,
    referral_url: referralUrl
  });
}

async function handleWithdraw(request, user, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "সঠিক JSON পাঠাও।" }, 400);
  }

  const amount = Number(body.amount);
  const method = String(body.method || "");
  const account = String(body.account || "").trim();

  if (!Number.isSafeInteger(amount) || amount < 500 || amount > 1000000) {
    return json({ error: "উইথড্র পরিমাণ ৳500 থেকে ৳1,000,000-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।" }, 400);
  }
  if (!["bKash", "Nagad", "Rocket"].includes(method)) {
    return json({ error: "পেমেন্ট মাধ্যম সঠিক নয়।" }, 400);
  }
  if (!/^[0-9]{10,15}$/.test(account)) {
    return json({ error: "অ্যাকাউন্ট নম্বর সঠিক নয়।" }, 400);
  }

  const db = env.DB;
  const userId = String(user.id);

  const accountRow = await db.prepare(`
    SELECT balance FROM users WHERE telegram_id = ?
  `).bind(userId).first();

  if (!accountRow) return json({ error: "অ্যাকাউন্ট পাওয়া যায়নি।" }, 404);

  const pending = await db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM withdrawals WHERE telegram_id = ? AND status = 'pending'
  `).bind(userId).first();

  const available = Number(accountRow.balance || 0) - Number(pending?.total || 0);
  if (amount > available) {
    return json({ error: "পর্যাপ্ত ব্যালেন্স নেই অথবা আগের অনুরোধ pending আছে।" }, 400);
  }

  await db.prepare(`
    INSERT INTO withdrawals (telegram_id, amount, method, account, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', datetime('now'))
  `).bind(userId, amount, method, account).run();

  return json({
    ok: true,
    message: "উইথড্র রিকোয়েস্ট জমা হয়েছে। এটি pending আছে; টাকা পাঠানো হয়নি।"
  }, 201);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return json({ service: "Earnova API", ok: true });
    }

    if (!env.DB || !env.BOT_TOKEN) {
      return json({ error: "Backend configuration incomplete." }, 500);
    }

    if (!["GET", "POST"].includes(request.method)) {
      return json({ error: "Method not allowed." }, 405);
    }

    const user = await authenticate(request, env);
    if (!user) return json({ error: "Telegram verification failed. Mini App থেকে আবার খোলো।" }, 401);

    try {
      if (url.pathname === "/api/me" && request.method === "GET") {
        return await handleMe(user, env);
      }

      if (url.pathname === "/api/withdraw" && request.method === "POST") {
        return await handleWithdraw(request, user, env);
      }

      return json({ error: "Endpoint পাওয়া যায়নি।" }, 404);
    } catch (error) {
      console.error("Earnova API error:", error);
      return json({ error: "সার্ভারে সমস্যা হয়েছে। পরে আবার চেষ্টা করো।" }, 500);
    }
  }
};
