/**
 * PostgreSQL 记忆层数据模型
 *
 * 使用 Drizzle ORM 定义表结构
 * 支持：向量存储、元数据过滤、图关系
 */

import { boolean, jsonb, pgTable, serial, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * 记忆表（核心向量存储）
 *
 * 存储所有类型的记忆（对话、文档、代码片段等）
 */
export const memories = pgTable(
  'memories',
  {
    /** 主键 ID */
    id: serial('id').primaryKey(),

    /** 记忆类型（conversation/document/code/snippet） */
    type: text('type').notNull(),

    /** 记忆内容（原文） */
    content: text('content').notNull(),

    /** 向量嵌入（BGE-M3: 1024 维，使用 pgvector 的 vector 类型） */
    // 注意：drizzle-orm pg-core 不原生支持 vector 类型，
    // 这里使用 text 列 + 自定义 SQL 处理类型转换。
    // 实际存储为 vector(1024) 类型，由 PostgresVectorStore.initialize() 管理。
    // 运行时接受 number[] 或 string，由 PostgresVectorStore 负责序列化。
    embedding: text('embedding').$type<string | number[]>().notNull(),

    /** 元数据（JSONB，支持灵活查询） */
    metadata: jsonb('metadata').$type<{
      agent?: string;
      userId?: string;
      tags?: string[];
      createdAt?: string;
      source?: string;
      [key: string]: any;
    }>(),

    /** 是否归档（冷数据） */
    isArchived: boolean('is_archived').notNull().default(false),

    /** 创建时间 */
    createdAt: timestamp('created_at').notNull().defaultNow(),

    /** 更新时间 */
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // 元数据 GIN 索引（支持 JSONB 查询）
    metadataIdx: index('memories_metadata_idx').using('gin', table.metadata),

    // 类型索引（常见过滤条件）
    typeIdx: index('memories_type_idx').on(table.type),

    // 归档状态索引
    archivedIdx: index('memories_archived_idx').on(table.isArchived),

    // 复合索引（类型 + 创建时间）
    typeCreatedAtIdx: index('memories_type_created_at_idx').on(table.type, table.createdAt),
  })
);

/**
 * 图关系表（实体与关系）
 *
 * 存储知识图谱的节点和边
 * 支持：实体抽取、关系推理、路径查询
 */
export const graphEntities = pgTable('graph_entities', {
  /** 主键 ID */
  id: serial('id').primaryKey(),

  /** 实体类型（Person/Organization/Location/Concept） */
  type: text('type').notNull(),

  /** 实体名称 */
  name: text('name').notNull(),

  /** 实体属性（JSONB） */
  properties: jsonb('properties').$type<{
    description?: string;
    aliases?: string[];
    confidence?: number;
    [key: string]: any;
  }>(),

  /** 创建时间 */
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const graphRelations = pgTable('graph_relations', {
  /** 主键 ID */
  id: serial('id').primaryKey(),

  /** 源实体 ID */
  fromEntityId: serial('from_entity_id')
    .notNull()
    .references(() => graphEntities.id),

  /** 目标实体 ID */
  toEntityId: serial('to_entity_id')
    .notNull()
    .references(() => graphEntities.id),

  /** 关系类型（RELATED_TO/OWNS/CITED_IN/LOCATED_AT） */
  relationType: text('relation_type').notNull(),

  /** 关系权重（0-1，用于排序） */
  weight: text('weight').notNull().default('1.0'),

  /** 关系属性（JSONB） */
  properties: jsonb('properties').$type<{
    evidence?: string;
    confidence?: number;
    [key: string]: any;
  }>(),

  /** 创建时间 */
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * 用户画像表
 *
 * 存储用户行为特征和偏好
 */
export const userProfiles = pgTable('user_profiles', {
  /** 主键 ID */
  id: serial('id').primaryKey(),

  /** 用户 ID */
  userId: text('user_id').notNull().unique(),

  /** 用户偏好（JSONB） */
  preferences: jsonb('preferences').$type<{
    topics?: string[];
    agents?: string[];
    language?: string;
    [key: string]: any;
  }>(),

  /** 行为特征（JSONB） */
  behaviors: jsonb('behaviors').$type<{
    lastActiveAt?: string;
    averageSessionDuration?: number;
    mostUsedAgents?: string[];
    [key: string]: any;
  }>(),

  /** 更新时间 */
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 导出类型
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type GraphEntity = typeof graphEntities.$inferSelect;
export type NewGraphEntity = typeof graphEntities.$inferInsert;
export type GraphRelation = typeof graphRelations.$inferSelect;
export type NewGraphRelation = typeof graphRelations.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
