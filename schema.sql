
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  referred_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reward INTEGER NOT NULL DEFAULT 0 CHECK (reward >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 500),
  method TEXT NOT NULL CHECK (method IN ('bKash', 'Nagad', 'Rocket')),
  account TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  admin_note TEXT,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user
  ON withdrawals(telegram_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_active
  ON tasks(active);

-- Demo task only. Reward is zero until a verified task/reward system is built.
INSERT INTO tasks (title, description, reward, active)
SELECT
  'Earnova-এর নিয়ম পড়ো',
  'অ্যাকাউন্ট সুরক্ষা ও ব্যবহারের নিয়ম জেনে নাও।',
  0,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM tasks WHERE title = 'Earnova-এর নিয়ম পড়ো'
);
