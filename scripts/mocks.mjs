// Node 环境下的浏览器 API 最小模拟，必须在任何业务模块之前 import
class MemStorage {
  m = new Map()
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null }
  setItem(k, v) { this.m.set(k, String(v)) }
  removeItem(k) { this.m.delete(k) }
}
globalThis.localStorage = new MemStorage()
globalThis.window = { addEventListener() {}, removeEventListener() {} }
globalThis.document = {
  createElement: () => ({ click() {}, style: {}, set href(_) {}, download: '' }),
  body: { appendChild() {}, removeChild() {} },
}
globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} }
globalThis.Blob = class {}
globalThis.confirm = () => true
