// 核心业务规则冒烟测试：由 scripts/run-smoke.mjs 用 rolldown 打包后在 Node 执行
import './mocks.mjs'

globalThis.setTimeout = setTimeout

const store = await import('../src/store.ts')
const seed = store.getState()
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1 } else console.log('PASS:', msg) }

// 1. 种子数据
assert(seed.datasets.length === 4, '种子含 4 个数据集')
assert(seed.fields.every((f) => f.datasetId), '每个字段都有显式 datasetId')
assert(store.pendingAppsForUser(seed, 'u01').length === 2, 'u01 名下有 2 条待审批（a8, a10）')
assert(store.pendingAppsForUser(seed, 'u02').length === 0, 'u02 名下无待审批')

// 2. 重复申请合并（与 a8 同字段同用途）
const r1 = store.submitApp({
  datasetId: 'ds1', consumerId: 'c8', applicantId: 'u05',
  fieldIds: ['f101', 'f102', 'f103'], purposeId: 'p8', reason: '第三次重复提交', validityDays: 365,
})
assert(r1.ok, '重复申请提交成功')
const dup = store.getState().apps.find((a) => a.reason === '第三次重复提交')
assert(dup?.status === 'duplicate' && dup.mergedIntoId === 'a8', '重复申请被标记 duplicate 并并入 a8')
const mainApp = store.getState().apps.find((a) => a.id === 'a8')
assert(mainApp.records.some((r) => r.action === '收到重复申请'), '主单保留收到重复申请的处理记录')
assert(dup.records.length === 2, '重复单自身保留独立处理记录（提交+合并）')

// 3. 敏感级别上限拦截
const r2 = store.submitApp({
  datasetId: 'ds1', consumerId: 'c6', applicantId: 'u07',
  fieldIds: ['f104'], purposeId: 'p6', reason: 'L4 字段申请 L3 用途', validityDays: 90,
})
assert(!r2.ok && /超出/.test(r2.error || ''), 'L4 字段申请 L3 用途被拦截')

// 4. 正常审批生成授权
const before = store.getState().grants.length
const r3 = store.approveApp('a8', '同意')
assert(r3.ok, '待审批申请 a8 批准成功')
const after = store.getState()
const newGrant = after.grants.find((g) => g.sourceAppId === 'a8')
assert(after.grants.length === before + 1 && newGrant?.status === 'active', '批准生成新的生效授权')
assert(newGrant.expiresAt !== null, '按 365 天写入到期时间')

// 5. 字段结构性变更触发重新确认
store.updateField('f103', { name: 'phone', sensitivity: 'L4', changeNote: '手机号提升为高敏级' })
const g2 = store.getState().grants.find((g) => g.id === 'g2')
const g3 = store.getState().grants.find((g) => g.id === 'g3')
const gNew = store.getState().grants.find((g) => g.sourceAppId === 'a8')
assert(g2.status === 'reconfirming' && g3.status === 'reconfirming', '引用 phone 的 g2/g3 转入待重新确认')
assert(gNew.status === 'reconfirming', '新授权同样被挂起')
const g1 = store.getState().grants.find((g) => g.id === 'g1')
assert(g1.status === 'active', '未引用该字段的 g1 不受影响')

// 6. 重新确认通过 -> 版本链
store.reconfirmGrant('g7', true, ['f401', 'f403', 'f405', 'f406'], '已知悉口径变更')
const st6 = store.getState()
const oldG7 = st6.grants.find((g) => g.id === 'g7')
const newG7 = st6.grants.find((g) => g.previousGrantId === 'g7')
assert(oldG7.status === 'superseded' && newG7?.status === 'active', '重新确认后旧版 superseded、新版 active')
assert(st6.apps.find((a) => a.id === 'a7')?.grantId === newG7.id, '来源申请指向新版本授权')

// 7. 重新确认拒绝 -> 撤销
store.reconfirmGrant('g2', false, ['f101'], '营销场景不再允许手机号')
const st7 = store.getState()
assert(st7.grants.find((g) => g.id === 'g2').status === 'revoked', '拒绝确认后授权撤销')
assert(st7.apps.find((a) => a.id === 'a2').status === 'revoked', '来源申请同步撤销态')

// 8. 删除字段触发重新确认
const refsBefore = store.getState().grants.filter((g) => g.fieldIds.includes('f303') && g.status === 'active').length
store.deleteField('f303')
const g6 = store.getState().grants.find((g) => g.id === 'g6')
assert(refsBefore > 0 && g6.status === 'reconfirming', '删除字段导致引用授权待重新确认')
assert(store.getState().fields.find((f) => f.id === 'f303').status === 'deleted', '字段为软删除')

// 9. 到期不可沿用 & 到期重申
const g5 = store.getState().grants.find((g) => g.id === 'g5')
assert(store.effectiveStatus(store.getState(), g5) === 'expired', 'g5 派生状态为已到期')
const appsBefore = store.getState().apps.length
store.reapplyFromGrant('g5')
const st9 = store.getState()
assert(st9.apps.length === appsBefore + 1, '到期重申生成一条新申请而非沿用旧授权')
const reapp = st9.apps[st9.apps.length - 1]
assert(reapp.status === 'pending' && !reapp.grantId, '重申申请是全新待审批单')

// 10. 撤销授权
const g4 = store.getState().grants.find((g) => g.id === 'g4')
store.revokeGrant('g4', '驾驶舱改版下线')
assert(store.getState().grants.find((g) => g.id === 'g4').status === 'revoked', 'g4 已撤销')
assert(store.getState().apps.find((a) => a.id === 'a4').status === 'revoked', '撤销同步到来源申请')

// 11. 负责人变更转交
const pendingBefore = store.pendingAppsForUser(store.getState(), 'u01').length
const ds1PendingBefore = store.getState().apps.filter((a) => a.datasetId === 'ds1' && a.status === 'pending').length
store.changeDatasetOwner('ds1', 'u02')
const st11 = store.getState()
assert(st11.datasets.find((d) => d.id === 'ds1').ownerId === 'u02', 'ds1 负责人变为 u02')
assert(store.pendingAppsForUser(st11, 'u02').length >= 1, '待审批事项转交到 u02')
assert(store.pendingAppsForUser(st11, 'u01').length === pendingBefore - ds1PendingBefore, 'u01 待办相应减少')
const a10 = st11.apps.find((a) => a.id === 'a10')
assert(a10.records.some((r) => r.action === '负责人变更转交'), '转交给待办申请留下处理记录')

// 12. 用途级别下调触发重新确认（g3 已在步骤5/7变化，改用 g1: p1 上限 L3 -> L2，g1 字段均 L1，应不受影响；再测停用用途 p5）
const g1Still = store.getState().grants.find((g) => g.id === 'g1')
store.setPurposeMaxSensitivity('p1', 'L2')
assert(store.getState().grants.find((g) => g.id === 'g1').status === g1Still.status, 'g1 字段均不超过 L2，下调用途级别不影响它')
store.togglePurposeActive('p5')
const g6After = store.getState().grants.find((g) => g.id === 'g6')
assert(g6After.status === 'reconfirming' && /停用/.test(g6After.reconfirmReason || ''), '停用用途 p5 使 g6 待重新确认')

// 13. 数据集详情可看到使用方
const users = store.activeConsumersOfDataset(store.getState(), 'ds1')
assert(users.length >= 2, 'ds1 详情能列出多个正在使用的消费方')

// 14. 持久化与递增
assert(store.getState().seq > seed.seq, '序列号随操作递增')

console.log('\n冒烟测试完成')
