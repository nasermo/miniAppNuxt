// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      title: 'یادنو | یادآور کارها',
      htmlAttrs: {
        lang: 'fa',
        dir: 'rtl'
      },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
      ]
    }
  },
  nitro: {
    preset: 'cloudflare_module',
    experimental: {
      database: true
    },
    database: {
      mainDB_cf: {
        connector: "cloudflare-d1",
        options: {
          bindingName: "db_link"
        }

      },
      mainDB_local: {
        connector: "sqlite",
        options: {
          name: "db_file"
        }
      }
    }
  }
})
