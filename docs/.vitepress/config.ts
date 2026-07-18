import { defineConfig } from 'vitepress'
import topLevelAwait from 'vite-plugin-top-level-await'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
  title: 'minesweeper-board',
  description: 'Vue 3 Minesweeper board component.',
  base: process.env.VITEPRESS_BASE ?? '/',
  vite: {
    build: {
      target: 'esnext',
    },
    plugins: [wasm(), topLevelAwait()],
    ssr: {
      noExternal: ['ms-toollib'],
    },
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide' },
      { text: 'Example', link: '/example' },
      { text: 'API', link: '/api' },
    ],
    sidebar: [
      { text: 'Guide', link: '/guide' },
      { text: 'Example', link: '/example' },
      { text: 'API', link: '/api' },
    ],
  },
})
