import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import dts from 'vite-plugin-dts'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      entryRoot: 'src',
      include: ['src'],
      exclude: ['tests', 'vite.config.ts'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MinesweeperBoard',
      fileName: 'minesweeper-board',
    },
    rollupOptions: {
      external: ['vue', '@putianyi888/vue3-plots'],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          '@putianyi888/vue3-plots': 'Vue3Plots',
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
