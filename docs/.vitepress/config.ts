import { defineConfig } from 'vitepress'
import { fileURLToPath, URL } from 'node:url'
import topLevelAwait from 'vite-plugin-top-level-await'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
  title: 'minesweeper-board',
  description: 'Vue 3 Minesweeper board component.',
  base: process.env.VITEPRESS_BASE ?? '/',
  vite: {
    resolve: {
      alias: [
        {
          find: '@putianyi888/vue3-minesweeper-board/style.css',
          replacement: fileURLToPath(new URL('../../src/styles/border.css', import.meta.url)),
        },
        {
          find: '@putianyi888/vue3-minesweeper-board',
          replacement: fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
        },
      ],
    },
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
      { text: 'Video', link: '/video' },
      { text: 'API', link: '/api/' },
    ],
    sidebar: [
      { text: 'Guide', link: '/guide' },
      { text: 'Example', link: '/example' },
      { text: 'Video', link: '/video' },
      {
        text: 'API',
        items: [
          { text: 'Overview', link: '/api/' },
          { text: 'MinesweeperBoard', link: '/api/minesweeper-board' },
          { text: 'BoardBackground', link: '/api/board-background' },
          { text: 'BoardForeground', link: '/api/board-foreground' },
          { text: 'BoardProbability', link: '/api/board-probability' },
          { text: 'MouseTrace', link: '/api/mouse-trace' },
          { text: 'Counter', link: '/api/counter' },
          { text: 'Border Classes', link: '/api/border-classes' },
        ],
      },
    ],
  },
})
