import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
    root: __dirname,
    plugins: [vue()],
    build: { outDir: resolve(__dirname, '../../../coverage/touch-trace'), emptyOutDir: true },
})
