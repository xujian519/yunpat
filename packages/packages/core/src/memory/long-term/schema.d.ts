/**
 * PostgreSQL 记忆层数据模型
 *
 * 使用 Drizzle ORM 定义表结构
 * 支持：向量存储、元数据过滤、图关系
 */
/**
 * 记忆表（核心向量存储）
 *
 * 存储所有类型的记忆（对话、文档、代码片段等）
 */
export declare const memories: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'memories'
  schema: undefined
  columns: {
    id: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'id'
        tableName: 'memories'
        dataType: 'number'
        columnType: 'PgSerial'
        data: number
        driverParam: number
        notNull: true
        hasDefault: true
        isPrimaryKey: true
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    type: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'type'
        tableName: 'memories'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    content: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'content'
        tableName: 'memories'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    embedding: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'embedding'
        tableName: 'memories'
        dataType: 'string'
        columnType: 'PgText'
        data: string | number[]
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {
        $type: string | number[]
      }
    >
    metadata: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'metadata'
        tableName: 'memories'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: {
          [key: string]: any
          agent?: string
          userId?: string
          tags?: string[]
          createdAt?: string
          source?: string
        }
        driverParam: unknown
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {
        $type: {
          [key: string]: any
          agent?: string
          userId?: string
          tags?: string[]
          createdAt?: string
          source?: string
        }
      }
    >
    isArchived: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'is_archived'
        tableName: 'memories'
        dataType: 'boolean'
        columnType: 'PgBoolean'
        data: boolean
        driverParam: boolean
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    createdAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'created_at'
        tableName: 'memories'
        dataType: 'date'
        columnType: 'PgTimestamp'
        data: Date
        driverParam: string
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    updatedAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'updated_at'
        tableName: 'memories'
        dataType: 'date'
        columnType: 'PgTimestamp'
        data: Date
        driverParam: string
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
  }
  dialect: 'pg'
}>
/**
 * 图关系表（实体与关系）
 *
 * 存储知识图谱的节点和边
 * 支持：实体抽取、关系推理、路径查询
 */
export declare const graphEntities: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'graph_entities'
  schema: undefined
  columns: {
    id: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'id'
        tableName: 'graph_entities'
        dataType: 'number'
        columnType: 'PgSerial'
        data: number
        driverParam: number
        notNull: true
        hasDefault: true
        isPrimaryKey: true
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    type: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'type'
        tableName: 'graph_entities'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    name: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'name'
        tableName: 'graph_entities'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    properties: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'properties'
        tableName: 'graph_entities'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: {
          [key: string]: any
          description?: string
          aliases?: string[]
          confidence?: number
        }
        driverParam: unknown
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {
        $type: {
          [key: string]: any
          description?: string
          aliases?: string[]
          confidence?: number
        }
      }
    >
    createdAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'created_at'
        tableName: 'graph_entities'
        dataType: 'date'
        columnType: 'PgTimestamp'
        data: Date
        driverParam: string
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
  }
  dialect: 'pg'
}>
export declare const graphRelations: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'graph_relations'
  schema: undefined
  columns: {
    id: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'id'
        tableName: 'graph_relations'
        dataType: 'number'
        columnType: 'PgSerial'
        data: number
        driverParam: number
        notNull: true
        hasDefault: true
        isPrimaryKey: true
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    fromEntityId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'from_entity_id'
        tableName: 'graph_relations'
        dataType: 'number'
        columnType: 'PgSerial'
        data: number
        driverParam: number
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    toEntityId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'to_entity_id'
        tableName: 'graph_relations'
        dataType: 'number'
        columnType: 'PgSerial'
        data: number
        driverParam: number
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    relationType: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'relation_type'
        tableName: 'graph_relations'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    weight: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'weight'
        tableName: 'graph_relations'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    properties: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'properties'
        tableName: 'graph_relations'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: {
          [key: string]: any
          evidence?: string
          confidence?: number
        }
        driverParam: unknown
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {
        $type: {
          [key: string]: any
          evidence?: string
          confidence?: number
        }
      }
    >
    createdAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'created_at'
        tableName: 'graph_relations'
        dataType: 'date'
        columnType: 'PgTimestamp'
        data: Date
        driverParam: string
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
  }
  dialect: 'pg'
}>
/**
 * 用户画像表
 *
 * 存储用户行为特征和偏好
 */
export declare const userProfiles: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'user_profiles'
  schema: undefined
  columns: {
    id: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'id'
        tableName: 'user_profiles'
        dataType: 'number'
        columnType: 'PgSerial'
        data: number
        driverParam: number
        notNull: true
        hasDefault: true
        isPrimaryKey: true
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    userId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'user_id'
        tableName: 'user_profiles'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    preferences: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'preferences'
        tableName: 'user_profiles'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: {
          [key: string]: any
          topics?: string[]
          agents?: string[]
          language?: string
        }
        driverParam: unknown
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {
        $type: {
          [key: string]: any
          topics?: string[]
          agents?: string[]
          language?: string
        }
      }
    >
    behaviors: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'behaviors'
        tableName: 'user_profiles'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: {
          [key: string]: any
          lastActiveAt?: string
          averageSessionDuration?: number
          mostUsedAgents?: string[]
        }
        driverParam: unknown
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {
        $type: {
          [key: string]: any
          lastActiveAt?: string
          averageSessionDuration?: number
          mostUsedAgents?: string[]
        }
      }
    >
    updatedAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'updated_at'
        tableName: 'user_profiles'
        dataType: 'date'
        columnType: 'PgTimestamp'
        data: Date
        driverParam: string
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
  }
  dialect: 'pg'
}>
export type Memory = typeof memories.$inferSelect
export type NewMemory = typeof memories.$inferInsert
export type GraphEntity = typeof graphEntities.$inferSelect
export type NewGraphEntity = typeof graphEntities.$inferInsert
export type GraphRelation = typeof graphRelations.$inferSelect
export type NewGraphRelation = typeof graphRelations.$inferInsert
export type UserProfile = typeof userProfiles.$inferSelect
export type NewUserProfile = typeof userProfiles.$inferInsert
//# sourceMappingURL=schema.d.ts.map
