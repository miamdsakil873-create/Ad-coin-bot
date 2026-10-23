
# Earnova Premium — মোবাইল সেটআপ

## 1. GitHub Pages frontend

Repository-এর root-এ এই ফাইলগুলো রাখো:
- index.html
- style.css
- app.js

Repository → Settings → Pages:
- Source: Deploy from a branch
- Branch: main
- Folder: / (root)
- Save

## 2. Cloudflare D1

1. Cloudflare Dashboard খোলো।
2. Workers & Pages → D1 SQL Database → Create database।
3. Database name: earnova-db
4. SQL Console-এ schema.sql-এর সব কোড পেস্ট করে চালাও।

## 3. Cloudflare Worker

1. Workers & Pages থেকে একটি Worker তৈরি করো।
2. worker.js-এর সম্পূর্ণ কোড Worker editor-এ বসাও।
3. Deploy করো।
4. Settings → Variables and Secrets-এ যোগ করো:
   - BOT_TOKEN: BotFather-এর bot token, Secret হিসেবে
   - BOT_USERNAME: bot username, @ ছাড়া
5. Bindings-এ D1 database যোগ করো:
   - Variable name: DB
   - Database: earnova-db
6. Save করে আবার Deploy করো।

## 4. Frontend API URL

GitHub-এর app.js খুলে এই লাইনটি খুঁজো:

const API_BASE = "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE";

এখানে তোমার আসল Worker URL বসাও। উদাহরণস্বরূপ:

const API_BASE = "https://your-worker-name.your-subdomain.workers.dev";

নিজের আসল URL ব্যবহার করবে; উদাহরণটি কপি করে রেখো না।

## 5. Telegram Mini App

1. Telegram-এ @BotFather খোলো।
2. নিজের bot নির্বাচন করো।
3. Mini App বা Menu Button সেটিংসে GitHub Pages URL দাও।
4. Telegram অ্যাপের ভেতর থেকে Mini App খুলে পরীক্ষা করো।

## নিরাপত্তা ও সীমাবদ্ধতা

- BOT_TOKEN কখনো GitHub-এ আপলোড করবে না।
- Telegram initData server-side যাচাই করা হয়।
- এই starter-এ task reward crediting, referral bonus, admin panel এবং automatic payment নেই।
- Withdrawal request মানেই টাকা পাঠানো নয়।
- Real-money চালুর আগে rate limiting, admin review, audit log, balance ledger, backups এবং payment verification যোগ করো।
- প্রথমে test bot ও test data দিয়ে পরীক্ষা করো।
