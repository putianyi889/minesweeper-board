import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Separate build preserves the existing ESM and UMD component entry, and keeps Vue/CSS out of the Worker graph.
export default defineConfig({
    build: {
        emptyOutDir: false,
        lib: {
            entry: resolve(__dirname, 'src/worker.ts'),
            formats: ['es'],
            fileName: 'worker',
        },
    },
})
