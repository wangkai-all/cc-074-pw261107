// 使用 Vite 8 自带的 rolldown 把 TS 测试打包为 ESM，再在 Node 中执行
import { rolldown } from 'rolldown'
import { pathToFileURL } from 'node:url'
import { rmSync } from 'node:fs'

const outDir = '/tmp/dcr-smoke'
rmSync(outDir, { recursive: true, force: true })

const bundle = await rolldown({
  input: 'scripts/smoke.mjs',
  resolve: { extensions: ['.ts', '.tsx', '.mjs', '.js'] },
})
await bundle.write({ dir: outDir, format: 'esm' })
await bundle.close()

await import(pathToFileURL(`${outDir}/smoke.js`).href)
