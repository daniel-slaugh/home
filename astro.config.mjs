// @ts-check
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import cloudflare from '@astrojs/cloudflare'
import tailwindcss from '@tailwindcss/vite'

// https://astro.build/config
export default defineConfig({
  site: 'https://danielslaugh.com',
  integrations: [mdx(), sitemap()],
  image: {
    service: {
      entrypoint: 'astro/assets/services/compile',
    },
  },
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  vite: { plugins: [tailwindcss()] },
})
