
"use strict";

const API_BASE = "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const telegram = window.Telegram?.WebApp;
telegram?.ready();
telegram?.expand();

function readPreference(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable in some browser contexts.
  }
}

function setTheme(theme) {
  const allowed = ["emerald", "purple", "blue", "pink", "orange"];
  if (!allowed.includes(theme)) theme = "emerald";

  document.documentElement.dataset.theme = theme;
  savePreference("earnova-theme", theme);

  $$("[data-theme]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.theme === theme);
    button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
  });
}

function setMode(mode) {
  mode = mode === "light" ? "light" : "dark";
  document.documentElement.dataset.mode = mode;
  savePreference("earnova-mode", mode);

  const button = $("#mode-toggle");
  if (button) {
    button.textContent = mode === "dark" ? "☀️" : "🌙";
    button.setAttribute("aria-label", mode === "dark" ? "Light mode" : "Dark mode");
  }

  const themeColor = mode === "dark" ? "#101522" : "#f3f5fb";
  $('meta[name="theme-color"]')?.setAttribute("content", themeColor);
}

function toggleMode() {
  setMode(document.documentElement.dataset.mode === "dark" ? "light" : "dark");
}

function showPage(page) {
  const allowed = ["home", "tasks", "referral", "wallet", "withdraw", "profile"];
  if (!allowed.includes(page)) page = "home";

  $$(".page-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== `page-${page}`);
  });

  $$(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  if (page !== "home") {
    $(`#page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function money(amount) {
  const number = Number(amount);
  if (!Number.isFinite(number)) return "৳ 0.00";
  return "৳ " + number.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function showStatus(message, target = "#app-status") {
  const element = $(target);
  if (element) element.textContent = message;
}

function setProfile(user) {
  const name = user?.first_name || user?.username || "বন্ধু";
  $("#user-name").textContent = name;
  $("#profile-avatar").textContent = [...name][0]?.toUpperCase() || "U";
}

function setTasks(tasks) {
  const list = $("#tasks-list");
  if (!list) return;

  list.replaceChildren();

  if (!Array.isArray(tasks) || tasks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "subtext";
    empty.textContent = "এখন কোনো টাস্ক উপলব্ধ নেই।";
    list.appendChild(empty);
    $("#task-count").textContent = "0";
    return;
  }

  $("#task-count").textContent = String(tasks.length);

  tasks.forEach((task) => {
    const card = document.createElement("div");
    card.className = "task-row";
    card.style.cssText =
      "padding:12px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px;align-items:center";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = task.title || "টাস্ক";
    const description = document.createElement("p");
    description.className = "subtext";
    description.style.margin = "5px 0 0";
    description.textContent = task.description || "টাস্কের বিস্তারিত";
    info.append(title, description);

    const reward = document.createElement("span");
    reward.style.color = "var(--accent)";
    reward.style.fontWeight = "800";
    reward.textContent = money(task.reward || 0);

    card.append(info, reward);
    list.appendChild(card);
  });
}

async function apiRequest(path, options = {}) {
  if (!API_BASE.startsWith("https://")) {
    throw new Error("আগে app.js-এ Cloudflare Worker URL বসাও।");
  }

  const initData = telegram?.initData;
  if (!initData) {
    throw new Error("Telegram Mini App-এর ভেতর থেকে অ্যাপটি খোলো।");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "সার্ভারে সমস্যা হয়েছে।");
  }

  return data;
}

async function loadDashboard() {
  if (!telegram?.initData) {
    showStatus("Preview mode: আসল ডেটার জন্য Telegram Mini App থেকে খুলতে হবে.", "#app-status");
    setTasks([]);
    return;
  }

  if (!API_BASE.startsWith("https://")) {
    showStatus("Cloudflare Worker URL সেট করা হয়নি।", "#status-message");
    showStatus("Worker URL সেট করলে আসল ডেটা লোড হবে।", "#app-status");
    setTasks([]);
    return;
  }

  showStatus("ডেটা লোড হচ্ছে...", "#status-message");

  try {
    const data = await apiRequest("/api/me");
    setProfile(data.user);
    $("#balance").textContent = money(data.balance);
    $("#wallet-balance").textContent = money(data.balance);
    $("#ref-count").textContent = String(data.referral_count || 0);
    $("#withdraw-count").textContent = String(data.withdrawal_count || 0);
    $("#referral-link").value = data.referral_url || "";
    setTasks(data.tasks || []);
    showStatus("অ্যাকাউন্ট সফলভাবে লোড হয়েছে।", "#status-message");
    showStatus("সার্ভারের সঙ্গে সংযুক্ত।", "#app-status");
  } catch (error) {
    showStatus(error.message || "ডেটা লোড করা যায়নি।", "#status-message");
    showStatus(error.message || "সার্ভারের সঙ্গে সংযোগ হয়নি।", "#app-status");
  }
}

$$("[data-page]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    showPage(button.dataset.page);
  });
});

$$("[data-theme]").forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.theme));
});

$("#mode-toggle")?.addEventListener("click", toggleMode);
$("#settings-mode-toggle")?.addEventListener("click", toggleMode);

$("#copy-referral")?.addEventListener("click", async () => {
  const link = $("#referral-link").value.trim();
  if (!link) {
    showStatus("আগে Telegram referral link লোড হতে হবে.", "#app-status");
    return;
  }

  try {
    await navigator.clipboard.writeText(link);
    showStatus("রেফারেল লিংক কপি হয়েছে।", "#app-status");
  } catch {
    $("#referral-link").select();
    showStatus("লিংকটি সিলেক্ট হয়েছে। কপি অপশন ব্যবহার করো।", "#app-status");
  }
});

$("#withdraw-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const amount = Number($("#withdraw-amount").value);
  const method = $("#withdraw-method").value;
  const account = $("#withdraw-account").value.trim();
  const button = $("#withdraw-submit");

  if (!Number.isFinite(amount) || amount < 500) {
    showStatus("সর্বনিম্ন উইথড্র অনুরোধ ৳500।", "#withdraw-message");
    return;
  }

  if (!/^[0-9]{10,15}$/.test(account)) {
    showStatus("সঠিক অ্যাকাউন্ট নম্বর দাও (১০–১৫টি সংখ্যা)।", "#withdraw-message");
    return;
  }

  button.disabled = true;
  button.textContent = "জমা হচ্ছে...";
  showStatus("রিকোয়েস্ট পাঠানো হচ্ছে...", "#withdraw-message");

  try {
    const result = await apiRequest("/api/withdraw", {
      method: "POST",
      body: { amount, method, account }
    });
    showStatus(result.message || "রিকোয়েস্ট জমা হয়েছে; অ্যাডমিন যাচাই করবে।", "#withdraw-message");
    $("#withdraw-form").reset();
    await loadDashboard();
  } catch (error) {
    showStatus(error.message || "রিকোয়েস্ট জমা হয়নি।", "#withdraw-message");
  } finally {
    button.disabled = false;
    button.textContent = "রিকোয়েস্ট জমা দাও ↗";
  }
});

setTheme(readPreference("earnova-theme", "emerald"));
setMode(readPreference("earnova-mode", "dark"));
showPage("home");

if (telegram?.initDataUnsafe?.user) {
  setProfile(telegram.initDataUnsafe.user);
}

loadDashboard();
