import type {
  AppState, Consumer, ConsumptionApp, DataField, Dataset,
  Grant, ProcessRecord, Purpose, UserProfile,
} from './types'

// ---------- 时间工具（相对今天生成，保证到期/生效示例始终成立） ----------
const now = new Date()
const day = 24 * 3600 * 1000
export const daysAgo = (n: number) => new Date(now.getTime() - n * day).toISOString()
export const daysAhead = (n: number) => new Date(now.getTime() + n * day).toISOString()
export const todayStr = () => now.toISOString().slice(0, 10)

let seq = 100
const nid = (p: string) => `${p}${++seq}`
const rec = (byUserId: string, action: string, comment?: string, at = daysAgo(0)): ProcessRecord =>
  ({ id: nid('PR'), at, byUserId, action, comment })

// ---------- 人员目录（虚构） ----------
const users: UserProfile[] = [
  { id: 'u01', name: '王敏', dept: '数据平台部·数据治理组', title: '数据集负责人' },
  { id: 'u02', name: '李强', dept: '交易研发部', title: '数据集负责人' },
  { id: 'u03', name: '赵倩', dept: '人力资源部', title: '数据集负责人' },
  { id: 'u04', name: '陈昊', dept: '商品中心', title: '数据集负责人' },
  { id: 'u05', name: '孙悦', dept: 'BI 报表组', title: '报表开发' },
  { id: 'u06', name: '周婷', dept: '经营分析组', title: '分析师' },
  { id: 'u07', name: '吴磊', dept: '算法平台组', title: '算法工程师' },
  { id: 'u08', name: '郑爽', dept: '风控合规组', title: '风控工程师' },
]

// ---------- 数据集 ----------
const datasets: Dataset[] = [
  { id: 'ds1', name: '客户主数据', tableName: 'dwd_customer_master', domain: '客户域', ownerId: 'u01',
    description: '全量注册客户的主档信息，含联系方式与证件信息，是客户域核心主数据。',
    createdAt: daysAgo(420), updatedAt: daysAgo(2) },
  { id: 'ds2', name: '订单交易事实', tableName: 'dwd_order_fact', domain: '交易域', ownerId: 'u02',
    description: '一笔订单一行的交易明细事实表，T+1 离线加工产出。',
    createdAt: daysAgo(380), updatedAt: daysAgo(6) },
  { id: 'ds3', name: '员工薪酬表', tableName: 'hr_emp_salary', domain: '人力域', ownerId: 'u03',
    description: '在职员工月度薪酬与银行账户信息，仅限人力与财务场景使用。',
    createdAt: daysAgo(300), updatedAt: daysAgo(20) },
  { id: 'ds4', name: '商品维表', tableName: 'dim_product', domain: '商品域', ownerId: 'u04',
    description: 'SKU 层级商品维度信息，含类目、品牌与成本价格。',
    createdAt: daysAgo(360), updatedAt: daysAgo(9) },
]

// ---------- 字段 ----------
const fields: DataField[] = [
  // ds1 客户主数据
  { id: 'f101', datasetId: 'ds1', name: 'customer_id', type: 'STRING', sensitivity: 'L1', status: 'active', description: '客户唯一标识', createdAt: daysAgo(420), updatedAt: daysAgo(420) },
  { id: 'f102', datasetId: 'ds1', name: 'customer_name', type: 'STRING', sensitivity: 'L2', status: 'active', description: '客户姓名', createdAt: daysAgo(420), updatedAt: daysAgo(420) },
  { id: 'f103', datasetId: 'ds1', name: 'phone', type: 'STRING', sensitivity: 'L3', status: 'active', description: '注册手机号', createdAt: daysAgo(420), updatedAt: daysAgo(420) },
  { id: 'f104', datasetId: 'ds1', name: 'id_card_no', type: 'STRING', sensitivity: 'L4', status: 'active', description: '身份证号（加密存储）', createdAt: daysAgo(420), updatedAt: daysAgo(420) },
  { id: 'f105', datasetId: 'ds1', name: 'gender', type: 'STRING', sensitivity: 'L1', status: 'active', description: '性别', createdAt: daysAgo(420), updatedAt: daysAgo(420) },
  { id: 'f106', datasetId: 'ds1', name: 'city', type: 'STRING', sensitivity: 'L1', status: 'active', description: '常驻城市', createdAt: daysAgo(420), updatedAt: daysAgo(420) },
  { id: 'f107', datasetId: 'ds1', name: 'email', type: 'STRING', sensitivity: 'L3', status: 'active', description: '电子邮箱', createdAt: daysAgo(420), updatedAt: daysAgo(420) },
  { id: 'f108', datasetId: 'ds1', name: 'birthday', type: 'DATE', sensitivity: 'L2', status: 'active', description: '出生日期', createdAt: daysAgo(420), updatedAt: daysAgo(420) },
  { id: 'f109', datasetId: 'ds1', name: 'member_level', type: 'STRING', sensitivity: 'L1', status: 'active', description: '会员等级', createdAt: daysAgo(420), updatedAt: daysAgo(420) },
  { id: 'f110', datasetId: 'ds1', name: 'registered_at', type: 'TIMESTAMP', sensitivity: 'L1', status: 'active', description: '注册时间', createdAt: daysAgo(420), updatedAt: daysAgo(420) },
  // ds2 订单交易
  { id: 'f201', datasetId: 'ds2', name: 'order_id', type: 'STRING', sensitivity: 'L1', status: 'active', description: '订单号', createdAt: daysAgo(380), updatedAt: daysAgo(380) },
  { id: 'f202', datasetId: 'ds2', name: 'customer_id', type: 'STRING', sensitivity: 'L2', status: 'active', description: '下单客户标识', createdAt: daysAgo(380), updatedAt: daysAgo(380) },
  { id: 'f203', datasetId: 'ds2', name: 'order_amount', type: 'DECIMAL(18,2)', sensitivity: 'L2', status: 'active', description: '订单金额（元）', createdAt: daysAgo(380), updatedAt: daysAgo(380) },
  { id: 'f204', datasetId: 'ds2', name: 'payment_channel', type: 'STRING', sensitivity: 'L1', status: 'active', description: '支付渠道', createdAt: daysAgo(380), updatedAt: daysAgo(380) },
  { id: 'f205', datasetId: 'ds2', name: 'order_status', type: 'STRING', sensitivity: 'L1', status: 'active', description: '订单状态', createdAt: daysAgo(380), updatedAt: daysAgo(380) },
  { id: 'f206', datasetId: 'ds2', name: 'sku_id', type: 'STRING', sensitivity: 'L1', status: 'active', description: '商品 SKU 标识', createdAt: daysAgo(380), updatedAt: daysAgo(380) },
  { id: 'f207', datasetId: 'ds2', name: 'order_time', type: 'TIMESTAMP', sensitivity: 'L1', status: 'active', description: '下单时间', createdAt: daysAgo(380), updatedAt: daysAgo(380) },
  { id: 'f208', datasetId: 'ds2', name: 'coupon_id', type: 'STRING', sensitivity: 'L2', status: 'active', description: '使用的优惠券标识', createdAt: daysAgo(200), updatedAt: daysAgo(200) },
  // ds3 员工薪酬
  { id: 'f301', datasetId: 'ds3', name: 'emp_id', type: 'STRING', sensitivity: 'L1', status: 'active', description: '工号', createdAt: daysAgo(300), updatedAt: daysAgo(300) },
  { id: 'f302', datasetId: 'ds3', name: 'emp_name', type: 'STRING', sensitivity: 'L2', status: 'active', description: '员工姓名', createdAt: daysAgo(300), updatedAt: daysAgo(300) },
  { id: 'f303', datasetId: 'ds3', name: 'base_salary', type: 'DECIMAL(12,2)', sensitivity: 'L4', status: 'active', description: '月度基本薪酬', createdAt: daysAgo(300), updatedAt: daysAgo(300) },
  { id: 'f304', datasetId: 'ds3', name: 'bonus', type: 'DECIMAL(12,2)', sensitivity: 'L4', status: 'active', description: '月度绩效奖金', createdAt: daysAgo(300), updatedAt: daysAgo(300) },
  { id: 'f305', datasetId: 'ds3', name: 'dept', type: 'STRING', sensitivity: 'L1', status: 'active', description: '所属部门', createdAt: daysAgo(300), updatedAt: daysAgo(300) },
  { id: 'f306', datasetId: 'ds3', name: 'bank_account', type: 'STRING', sensitivity: 'L4', status: 'active', description: '工资银行账号', createdAt: daysAgo(300), updatedAt: daysAgo(300) },
  { id: 'f307', datasetId: 'ds3', name: 'tax_amount', type: 'DECIMAL(12,2)', sensitivity: 'L3', status: 'active', description: '代扣个税金额', createdAt: daysAgo(300), updatedAt: daysAgo(300) },
  // ds4 商品维表（cost_price 已发生口径变更，用于演示待重新确认）
  { id: 'f401', datasetId: 'ds4', name: 'sku_id', type: 'STRING', sensitivity: 'L1', status: 'active', description: 'SKU 标识', createdAt: daysAgo(360), updatedAt: daysAgo(360) },
  { id: 'f402', datasetId: 'ds4', name: 'sku_name', type: 'STRING', sensitivity: 'L1', status: 'active', description: '商品名称', createdAt: daysAgo(360), updatedAt: daysAgo(360) },
  { id: 'f403', datasetId: 'ds4', name: 'category', type: 'STRING', sensitivity: 'L1', status: 'active', description: '后台类目', createdAt: daysAgo(360), updatedAt: daysAgo(360) },
  { id: 'f404', datasetId: 'ds4', name: 'brand', type: 'STRING', sensitivity: 'L1', status: 'active', description: '品牌', createdAt: daysAgo(360), updatedAt: daysAgo(360) },
  { id: 'f405', datasetId: 'ds4', name: 'cost_price', type: 'DECIMAL(12,2)', sensitivity: 'L3', status: 'modified',
    description: '商品成本价（不含税）', changeNote: '口径由“含税成本价”调整为“不含税成本价”，历史值不可比',
    createdAt: daysAgo(360), updatedAt: daysAgo(5) },
  { id: 'f406', datasetId: 'ds4', name: 'sale_price', type: 'DECIMAL(12,2)', sensitivity: 'L2', status: 'active', description: '标准售价', createdAt: daysAgo(360), updatedAt: daysAgo(360) },
  { id: 'f407', datasetId: 'ds4', name: 'supplier_id', type: 'STRING', sensitivity: 'L2', status: 'active', description: '主供应商标识', createdAt: daysAgo(360), updatedAt: daysAgo(360) },
]
// ---------- 已批准下游用途目录 ----------
const purposes: Purpose[] = [
  { id: 'p1', name: '经营分析报表', category: '分析洞察', maxSensitivity: 'L3', active: true, description: '用于经营分析类报表与指标看板的取数与展示。', createdAt: daysAgo(400) },
  { id: 'p2', name: '用户画像标签', category: '分析洞察', maxSensitivity: 'L3', active: true, description: '构建用户画像标签，供分群与洞察使用。', createdAt: daysAgo(400) },
  { id: 'p3', name: '精准营销触达', category: '营销触达', maxSensitivity: 'L3', active: true, description: '营销活动人群圈选与触达（短信/Push/站内信）。', createdAt: daysAgo(400) },
  { id: 'p4', name: '风控反欺诈', category: '风险合规', maxSensitivity: 'L4', active: true, description: '风险识别、反欺诈模型与合规审查。', createdAt: daysAgo(400) },
  { id: 'p5', name: '财务对账', category: '财务人力', maxSensitivity: 'L4', active: true, description: '财务核算、对账与薪酬成本分析。', createdAt: daysAgo(400) },
  { id: 'p6', name: '模型训练', category: '算法研究', maxSensitivity: 'L3', active: true, description: '机器学习/推荐模型训练与特征加工。', createdAt: daysAgo(300) },
  { id: 'p7', name: '看板展示', category: '分析洞察', maxSensitivity: 'L2', active: true, description: '面向业务的只读数据看板展示，不导出明细。', createdAt: daysAgo(300) },
  { id: 'p8', name: '客服查询服务', category: '业务运营', maxSensitivity: 'L3', active: true, description: '客服系统在线查询客户信息以处理工单。', createdAt: daysAgo(300) },
]

// ---------- 消费方：报表与任务（虚构目录） ----------
const consumers: Consumer[] = [
  { id: 'c1', name: '客户增长周报', kind: 'report', ownerId: 'u05', system: 'BI 平台', description: '每周输出客户新增、留存与会员结构。', createdAt: daysAgo(260) },
  { id: 'c2', name: '销售经营驾驶舱', kind: 'report', ownerId: 'u06', system: 'BI 平台', description: '管理层日更销售经营指标驾驶舱。', createdAt: daysAgo(240) },
  { id: 'c3', name: '营销人群圈选任务', kind: 'task', ownerId: 'u07', system: '数据开发平台', description: '按营销活动规则圈选目标人群并推送触达系统。', createdAt: daysAgo(220) },
  { id: 'c4', name: '风控特征加工任务', kind: 'task', ownerId: 'u08', system: '数据开发平台', description: '加工风控模型所需客户身份与交易特征。', createdAt: daysAgo(210) },
  { id: 'c5', name: '薪酬成本分析报表', kind: 'report', ownerId: 'u03', system: '人力分析平台', description: '按部门分析月度薪酬成本与奖金发放。', createdAt: daysAgo(180) },
  { id: 'c6', name: '推荐模型训练任务', kind: 'task', ownerId: 'u07', system: '算法平台', description: '商品推荐召回/排序模型的离线训练。', createdAt: daysAgo(160) },
  { id: 'c7', name: '商品利润分析报表', kind: 'report', ownerId: 'u06', system: 'BI 平台', description: '按类目/品牌分析商品毛利与利润结构。', createdAt: daysAgo(150) },
  { id: 'c8', name: '客服工单查询接口', kind: 'task', ownerId: 'u05', system: '客服系统', description: '客服坐席在线查询客户档案的同步接口。', createdAt: daysAgo(120) },
]

// ---------- 申请与授权 ----------
const dedupe = (d: string, c: string, f: string[], p: string) =>
  [d, c, [...f].sort().join('+'), p].join('|')

const apps: ConsumptionApp[] = [
  {
    id: 'a1', no: 'APP-202609-001', datasetId: 'ds1', consumerId: 'c1', applicantId: 'u05',
    fieldIds: ['f101', 'f106', 'f109', 'f110'], purposeId: 'p1', reason: '周报需要按城市/会员等级统计客户新增与留存。',
    validityDays: 365, status: 'approved', createdAt: daysAgo(45), dedupeKey: dedupe('ds1', 'c1', ['f101', 'f106', 'f109', 'f110'], 'p1'),
    records: [rec('u05', '提交申请', undefined, daysAgo(45)), rec('u01', '批准', '字段与用途匹配，有效期一年。', daysAgo(44))],
    grantId: 'g1',
  },
  {
    id: 'a2', no: 'APP-202609-002', datasetId: 'ds1', consumerId: 'c3', applicantId: 'u07',
    fieldIds: ['f101', 'f103', 'f106', 'f109'], purposeId: 'p3', reason: '双十一大促人群圈选，需要手机号用于触达。',
    validityDays: 120, status: 'approved', createdAt: daysAgo(40), dedupeKey: dedupe('ds1', 'c3', ['f101', 'f103', 'f106', 'f109'], 'p3'),
    records: [rec('u07', '提交申请', undefined, daysAgo(40)), rec('u01', '批准', '仅限本次大促，到期自动失效。', daysAgo(39))],
    grantId: 'g2',
  },
  {
    id: 'a3', no: 'APP-202609-003', datasetId: 'ds1', consumerId: 'c4', applicantId: 'u08',
    fieldIds: ['f101', 'f103', 'f104'], purposeId: 'p4', reason: '反欺诈模型需要证件号与手机号进行实名核验。',
    validityDays: null, status: 'approved', createdAt: daysAgo(38), dedupeKey: dedupe('ds1', 'c4', ['f101', 'f103', 'f104'], 'p4'),
    records: [rec('u08', '提交申请', undefined, daysAgo(38)), rec('u01', '批准', '风控场景允许 L4，长期授权，按季度复核。', daysAgo(37))],
    grantId: 'g3',
  },
  {
    id: 'a4', no: 'APP-202609-004', datasetId: 'ds2', consumerId: 'c2', applicantId: 'u06',
    fieldIds: ['f201', 'f203', 'f206', 'f207'], purposeId: 'p1', reason: '驾驶舱展示每日成交额、热销 SKU 与下单时段分布。',
    validityDays: 180, status: 'approved', createdAt: daysAgo(30), dedupeKey: dedupe('ds2', 'c2', ['f201', 'f203', 'f206', 'f207'], 'p1'),
    records: [rec('u06', '提交申请', undefined, daysAgo(30)), rec('u02', '批准', undefined, daysAgo(29))],
    grantId: 'g4',
  },
  {
    id: 'a5', no: 'APP-202608-011', datasetId: 'ds2', consumerId: 'c6', applicantId: 'u07',
    fieldIds: ['f202', 'f203', 'f206', 'f207'], purposeId: 'p6', reason: '推荐模型 v3 训练样本需要用户购买序列与金额。',
    validityDays: 90, status: 'approved', createdAt: daysAgo(100), dedupeKey: dedupe('ds2', 'c6', ['f202', 'f203', 'f206', 'f207'], 'p6'),
    records: [rec('u07', '提交申请', undefined, daysAgo(100)), rec('u02', '批准', '有效期 90 天，到期需重新申请。', daysAgo(99))],
    grantId: 'g5',
  },
  {
    id: 'a6', no: 'APP-202609-008', datasetId: 'ds3', consumerId: 'c5', applicantId: 'u03',
    fieldIds: ['f301', 'f303', 'f304', 'f305'], purposeId: 'p5', reason: '季度薪酬成本分摊到部门的分析报表。',
    validityDays: null, status: 'approved', createdAt: daysAgo(28), dedupeKey: dedupe('ds3', 'c5', ['f301', 'f303', 'f304', 'f305'], 'p5'),
    records: [rec('u03', '提交申请', undefined, daysAgo(28)), rec('u03', '批准', '负责人自用场景，登记备案。', daysAgo(28))],
    grantId: 'g6',
  },
  {
    id: 'a7', no: 'APP-202609-012', datasetId: 'ds4', consumerId: 'c7', applicantId: 'u06',
    fieldIds: ['f401', 'f403', 'f405', 'f406'], purposeId: 'p1', reason: '核算类目毛利需要成本价与售价。',
    validityDays: 180, status: 'approved', createdAt: daysAgo(25), dedupeKey: dedupe('ds4', 'c7', ['f401', 'f403', 'f405', 'f406'], 'p1'),
    records: [
      rec('u06', '提交申请', undefined, daysAgo(25)),
      rec('u04', '批准', undefined, daysAgo(24)),
      rec('u04', '字段变更触发重新确认', 'cost_price 口径变更，授权暂停待确认。', daysAgo(5)),
    ],
    grantId: 'g7',
  },
  {
    id: 'a8', no: 'APP-202611-001', datasetId: 'ds1', consumerId: 'c8', applicantId: 'u05',
    fieldIds: ['f101', 'f102', 'f103'], purposeId: 'p8', reason: '客服坐席处理工单时需核验客户姓名与手机号。',
    validityDays: 365, status: 'pending', createdAt: daysAgo(3), dedupeKey: dedupe('ds1', 'c8', ['f101', 'f102', 'f103'], 'p8'),
    records: [rec('u05', '提交申请', undefined, daysAgo(3))],
  },
  {
    id: 'a9', no: 'APP-202611-002', datasetId: 'ds1', consumerId: 'c8', applicantId: 'u05',
    fieldIds: ['f101', 'f102', 'f103'], purposeId: 'p8', reason: '工单系统二期上线，再次申请同样权限（重复提交）。',
    validityDays: 365, status: 'duplicate', createdAt: daysAgo(1), mergedIntoId: 'a8',
    dedupeKey: dedupe('ds1', 'c8', ['f101', 'f102', 'f103'], 'p8'),
    records: [
      rec('u05', '提交申请', undefined, daysAgo(1)),
      rec('u01', '合并重复申请', '与 APP-202611-001 字段、用途完全相同，并入主单处理。', daysAgo(1)),
    ],
  },
  {
    id: 'a10', no: 'APP-202611-003', datasetId: 'ds1', consumerId: 'c2', applicantId: 'u06',
    fieldIds: ['f102', 'f107'], purposeId: 'p7', reason: '驾驶舱新增客户联系信息展示卡片。',
    validityDays: 180, status: 'pending', createdAt: daysAgo(2), dedupeKey: dedupe('ds1', 'c2', ['f102', 'f107'], 'p7'),
    records: [rec('u06', '提交申请', undefined, daysAgo(2))],
  },
  {
    id: 'a11', no: 'APP-202610-006', datasetId: 'ds1', consumerId: 'c6', applicantId: 'u07',
    fieldIds: ['f104'], purposeId: 'p6', reason: '希望用身份证号训练身份识别模型。',
    validityDays: 90, status: 'rejected', createdAt: daysAgo(20), dedupeKey: dedupe('ds1', 'c6', ['f104'], 'p6'),
    records: [
      rec('u07', '提交申请', undefined, daysAgo(20)),
      rec('u01', '驳回', '模型训练用途最高支持 L3，身份证号为 L4，超出用途敏感级别上限。', daysAgo(19)),
    ],
  },
  {
    id: 'a12', no: 'APP-202608-003', datasetId: 'ds2', consumerId: 'c3', applicantId: 'u07',
    fieldIds: ['f201', 'f202', 'f203'], purposeId: 'p3', reason: '暑期营销活动订单效果分析。',
    validityDays: 60, status: 'revoked', createdAt: daysAgo(95), dedupeKey: dedupe('ds2', 'c3', ['f201', 'f202', 'f203'], 'p3'),
    records: [
      rec('u07', '提交申请', undefined, daysAgo(95)),
      rec('u02', '批准', undefined, daysAgo(94)),
      rec('u02', '撤销授权', '暑期营销活动结束，消费方不再需要该权限。', daysAgo(20)),
    ],
    grantId: 'g8',
  },
]

const grants: Grant[] = [
  { id: 'g1', no: 'GR-202609-001', datasetId: 'ds1', consumerId: 'c1', fieldIds: ['f101', 'f106', 'f109', 'f110'], purposeId: 'p1', sourceAppId: 'a1', status: 'active', approvedBy: 'u01', approvedAt: daysAgo(44), expiresAt: daysAhead(321) },
  { id: 'g2', no: 'GR-202609-002', datasetId: 'ds1', consumerId: 'c3', fieldIds: ['f101', 'f103', 'f106', 'f109'], purposeId: 'p3', sourceAppId: 'a2', status: 'active', approvedBy: 'u01', approvedAt: daysAgo(39), expiresAt: daysAhead(81) },
  { id: 'g3', no: 'GR-202609-003', datasetId: 'ds1', consumerId: 'c4', fieldIds: ['f101', 'f103', 'f104'], purposeId: 'p4', sourceAppId: 'a3', status: 'active', approvedBy: 'u01', approvedAt: daysAgo(37), expiresAt: null },
  { id: 'g4', no: 'GR-202609-004', datasetId: 'ds2', consumerId: 'c2', fieldIds: ['f201', 'f203', 'f206', 'f207'], purposeId: 'p1', sourceAppId: 'a4', status: 'active', approvedBy: 'u02', approvedAt: daysAgo(29), expiresAt: daysAhead(151) },
  { id: 'g5', no: 'GR-202608-011', datasetId: 'ds2', consumerId: 'c6', fieldIds: ['f202', 'f203', 'f206', 'f207'], purposeId: 'p6', sourceAppId: 'a5', status: 'expired', approvedBy: 'u02', approvedAt: daysAgo(99), expiresAt: daysAgo(13) },
  { id: 'g6', no: 'GR-202609-008', datasetId: 'ds3', consumerId: 'c5', fieldIds: ['f301', 'f303', 'f304', 'f305'], purposeId: 'p5', sourceAppId: 'a6', status: 'active', approvedBy: 'u03', approvedAt: daysAgo(28), expiresAt: null },
  { id: 'g7', no: 'GR-202609-012', datasetId: 'ds4', consumerId: 'c7', fieldIds: ['f401', 'f403', 'f405', 'f406'], purposeId: 'p1', sourceAppId: 'a7', status: 'reconfirming', approvedBy: 'u04', approvedAt: daysAgo(24), expiresAt: daysAhead(156), reconfirmReason: '字段 cost_price 口径变更（含税 → 不含税），需消费方重新确认' },
  { id: 'g8', no: 'GR-202608-003', datasetId: 'ds2', consumerId: 'c3', fieldIds: ['f201', 'f202', 'f203'], purposeId: 'p3', sourceAppId: 'a12', status: 'revoked', approvedBy: 'u02', approvedAt: daysAgo(94), expiresAt: daysAgo(35), revokedAt: daysAgo(20), revokeReason: '暑期营销活动结束，消费方不再需要该权限' },
]

export function buildSeed(): AppState {
  return { users, datasets, fields, purposes, consumers, apps, grants, seq }
}
