# یادنو

یادآور فارسی و راست‌چین برای Telegram Mini App با ظاهر مینیمال نئونی. کارها در سه وضعیت «باید انجام بشه»، «در حال انجام» و «انجام شده» مدیریت می‌شوند و داده‌ها در Cloudflare D1 ذخیره می‌شوند. هر کاربر تلگرام فقط یادآورهای خودش را می‌بیند.

## اجرا در محیط توسعه

```bash
npm install
npm run dev
```

در `npm run dev` اگر binding واقعی D1 وجود نداشته باشد، داده‌ها در SQLite محلی (`.data/db_file.sqlite`) ذخیره می‌شوند و **به Cloudflare نمی‌رسند**. برای تست روی D1 واقعی از `npm run preview:cf` یا دیپلوی استفاده کن.

## دیپلوی روی Cloudflare Workers

```bash
npm run deploy        # = nuxt build && npx wrangler deploy
```

دستور را حتماً از **ریشهٔ پروژه** اجرا کن تا `wrangler.jsonc` (و binding دیتابیس `db_link`) خوانده شود. اگر از داخل پوشهٔ `.output` دیپلوی کنی، binding وجود ندارد و داده ذخیره نمی‌شود.

### توکن بات (برای جداسازی و امنیت کاربران)

```bash
npx wrangler secret put BOT_TOKEN
```

بدون این مقدار، شناسهٔ کاربر بدون تأیید امضا پذیرفته می‌شود. با آن، `initData` تلگرام با HMAC بررسی می‌شود و درخواست‌های جعلی رد می‌شوند.

### بررسی اتصال

بعد از دیپلوی این آدرس را در مرورگر باز کن:

```
https://<your-worker>.workers.dev/api/health
```

باید `"backend": "d1"` ببینی. اگر خطای «binding is missing» دیدی، Worker بدون تنظیمات `wrangler.jsonc` دیپلوی شده است.

### یادآورهای قدیمی

یادآورهای ساخته‌شده قبل از این نسخه با شناسهٔ `guest` ذخیره شده‌اند. برای انتقال به حساب خودت (شناسهٔ عددی تلگرامت را جایگزین کن):

```bash
npx wrangler d1 execute mini-app-nuxt-db --remote --command "UPDATE reminders SET user_id='123456789' WHERE user_id='guest'"
```

## API

- `GET /api/tasks` — دریافت یادآورهای کاربر
- `POST /api/tasks` — ساخت یادآور
- `PUT /api/tasks/:id` — ویرایش یا تغییر وضعیت
- `DELETE /api/tasks/:id` — حذف یادآور
- `GET /api/health` — بررسی اتصال دیتابیس

همهٔ درخواست‌ها هدر `x-telegram-init-data` دارند. وضعیت‌ها: `todo`، `in_progress` و `done`.
