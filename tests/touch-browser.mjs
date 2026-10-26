import assert from 'node:assert/strict'
import { cpus, platform, arch } from 'node:os'
import { resolve } from 'node:path'
import { checkNativeBrowser } from './native-browser.mjs'

await checkNativeBrowser({
    configFile: resolve('tests/fixtures/touch-trace/vite.config.ts'),
    timeoutMs: 180_000,
    check: async ({ evaluate, call }) => {
        await call('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: 2, mobile: false })
        await call('Performance.enable')
        const result = await evaluate('window.touchTraceCheck()')
        const memory = async () => {
            await call('HeapProfiler.collectGarbage')
            const dom = await call('Memory.getDOMCounters')
            const { metrics } = await call('Performance.getMetrics')
            return { ...dom, heapUsed: metrics.find(({ name }) => name === 'JSHeapUsedSize').value }
        }
        await evaluate('window.touchTraceCycles(30)')
        const first = await memory()
        await evaluate('window.touchTraceCycles(30)')
        const second = await memory()
        assert.ok(second.nodes <= first.nodes + 50, `DOM nodes accumulate: ${JSON.stringify({ first, second })}`)
        assert.ok(second.heapUsed <= first.heapUsed + 2_000_000, `Heap grows after 30 more recording switches: ${JSON.stringify({ first, second })}`)
        await evaluate('window.disposeTouchTrace()')
        const disposed = await memory()
        assert.ok(disposed.nodes < 100, `Detached nodes remain after unmount: ${JSON.stringify(disposed)}`)
        const browser = await call('Browser.getVersion')
        return { ...result, browser: browser.product, node: process.version,
            platform: `${platform()} ${arch()}`, cpu: cpus()[0].model, after30Cycles: first, after60Cycles: second, afterUnmount: disposed }
    },
})
