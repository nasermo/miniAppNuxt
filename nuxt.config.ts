// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'یادنو | یادآور کارها',
      htmlAttrs: { lang: 'fa', dir: 'rtl' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#06070b' },
        { name: 'color-scheme', content: 'dark' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossorigin: '' },
        // فونت وزیرمتن؛ اگر لود نشد فونت سیستم جایگزین می‌شود
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/vazirmatn@33.0.3/Vazirmatn-font-face.css' },
      ],
      script: [
        // SDK رسمی مینی‌اپ تلگرام (باید قبل از اپ لود شود)
        { src: 'https://telegram.org/js/telegram-web-app.js' },
      ],
    },
  },

  // توکن بات برای اعتبارسنجی initData؛ با  `wrangler secret put BOT_TOKEN`  تنظیم می‌شود
  runtimeConfig: {
    botToken: '',
  },

  // پاسخ‌های API هرگز نباید کش شوند (وب‌ویو تلگرام گاهی کش می‌کند)
  routeRules: {
    '/api/**': { headers: { 'cache-control': 'no-store' } },
  },

  nitro: {
    preset: 'cloudflare_module',
    experimental: {
      database: true,
    },
    database: {
      // production: Cloudflare D1 (binding در wrangler.jsonc با نام db_link)
      mainDB_cf: {
        connector: 'cloudflare-d1',
        options: { bindingName: 'db_link' },
      },
      // فقط وقتی binding واقعی نیست و در حالت dev هستیم (server/utils/db.ts)
      mainDB_local: {
        connector: 'sqlite',
        options: { name: 'db_file' },
      },
    },
  },
})
