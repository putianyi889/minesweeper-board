import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Uses the package's published self-reference (dist/worker.js), not a source alias.
export default defineConfig({
    root: __dirname,
    base: '/export/',
    build: {
        outDir: resolve(__dirname, '../../../coverage/worker-vite'),
        emptyOutDir: true,
    },
})
