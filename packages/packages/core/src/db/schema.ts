import {
  pgTable,
  text,
  integer,
  timestamp,
  serial,
  boolean,
  decimal,
  pgEnum,
} from 'drizzle-orm/pg-core'

// ==================== 记忆和图谱表 ====================

// 记忆表（向量存储）
export const memories = pgTable('memories', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  embedding: text('embedding').notNull(), // pgvector string format
  metadata: text('metadata'), // JSON metadata
  createdAt: timestamp('created_at').defaultNow(),
})

// 图实体表
export const graphEntities = pgTable('graph_entities', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  data: text('data'), // JSON data
  createdAt: timestamp('created_at').defaultNow(),
})

// 图关系表
export const graphRelations = pgTable('graph_relations', {
  id: serial('id').primaryKey(),
  fromId: integer('from_id').references(() => graphEntities.id),
  toId: integer('to_id').references(() => graphEntities.id),
  relationType: text('relation_type').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

// ==================== 专利管理表 ====================

// 专利类型枚举
export const patentTypeEnum = pgEnum('patent_type', ['invention', 'utility', 'design'])

// 专利状态枚举
export const patentStatusEnum = pgEnum('patent_status', [
  'draft',
  'filed',
  'under_exam',
  'oa_issued',
  'amended',
  'allowed',
  'granted',
  'rejected',
  'abandoned',
  'expired',
  'withdrawn',
])

// 专利主表
export const patents = pgTable('patents', {
  id: serial('id').primaryKey(),
  applicationNumber: text('application_number').notNull().unique(),
  title: text('title').notNull(),
  applicant: text('applicant').notNull(),
  inventors: text('inventors').notNull(), // JSON array
  patentType: patentTypeEnum('patent_type').notNull(),
  filingDate: timestamp('filing_date').notNull(),
  status: patentStatusEnum('status').notNull().default('draft'),
  priorityClaims: text('priority_claims'), // JSON array of priority claims
  attorney: text('attorney'),
  classification: text('classification'),
  abstract: text('abstract'),
  description: text('description'),
  claims: text('claims'), // JSON array
  metadata: text('metadata'), // JSON for additional metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// 专利截止日期类型枚举
export const deadlineTypeEnum = pgEnum('deadline_type', [
  'oa_response',
  'renewal_fee',
  'publication_fee',
  'examination_fee',
  'appeal_deadline',
  'priority_claim',
  'other',
])

// 专利截止日期表
export const patentDeadlines = pgTable('patent_deadlines', {
  id: serial('id').primaryKey(),
  applicationNumber: text('application_number')
    .notNull()
    .references(() => patents.applicationNumber),
  type: deadlineTypeEnum('type').notNull(),
  deadlineDate: timestamp('deadline_date').notNull(),
  description: text('description').notNull(),
  priority: text('priority').notNull().default('medium'), // 'high' | 'medium' | 'low'
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at'),
  reminderDate: timestamp('reminder_date'),
  reminderSent: boolean('reminder_sent').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// 专利费用状态枚举
export const feeStatusEnum = pgEnum('fee_status', ['pending', 'paid', 'overdue', 'cancelled'])

// 专利费用表
export const patentFees = pgTable('patent_fees', {
  id: serial('id').primaryKey(),
  applicationNumber: text('application_number')
    .notNull()
    .references(() => patents.applicationNumber),
  feeType: text('fee_type').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('CNY'),
  dueDate: timestamp('due_date').notNull(),
  status: feeStatusEnum('status').notNull().default('pending'),
  paymentDate: timestamp('payment_date'),
  paymentReference: text('payment_reference'),
  notes: text('notes'),
  metadata: text('metadata'), // JSON for additional metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// 专利历史记录表（状态变更历史）
export const patentHistory = pgTable('patent_history', {
  id: serial('id').primaryKey(),
  applicationNumber: text('application_number')
    .notNull()
    .references(() => patents.applicationNumber),
  eventType: text('event_type').notNull(), // 'status_change' | 'deadline_added' | 'fee_added' | etc.
  previousValue: text('previous_value'), // JSON
  newValue: text('new_value'), // JSON
  description: text('description').notNull(),
  userId: text('user_id'), // 操作人ID
  metadata: text('metadata'), // JSON for additional context
  createdAt: timestamp('created_at').defaultNow(),
})

// 通知配置类型枚举
export const notificationTypeEnum = pgEnum('notification_type', [
  'email',
  'webhook',
  'sms',
  'system',
])

// 通知状态枚举
export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'sent',
  'failed',
  'cancelled',
])

// 通知配置表
export const notificationConfigs = pgTable('notification_configs', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: notificationTypeEnum('type').notNull(),
  config: text('config').notNull(), // JSON 配置（如 email 地址、webhook URL）
  enabled: boolean('enabled').notNull().default(true),
  events: text('events').notNull(), // JSON array of events to notify
  metadata: text('metadata'), // JSON for additional metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// 通知记录表
export const notificationLogs = pgTable('notification_logs', {
  id: serial('id').primaryKey(),
  configId: integer('config_id').references(() => notificationConfigs.id),
  type: notificationTypeEnum('type').notNull(),
  event: text('event').notNull(),
  recipient: text('recipient').notNull(),
  subject: text('subject'),
  content: text('content').notNull(),
  status: notificationStatusEnum('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  sentAt: timestamp('sent_at'),
  metadata: text('metadata'), // JSON for additional context
  createdAt: timestamp('created_at').defaultNow(),
})
