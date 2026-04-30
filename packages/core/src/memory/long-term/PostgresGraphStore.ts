/**
 * PostgreSQL 图存储实现
 *
 * 基于 SQL/PGQ 标准的图查询
 * 支持：
 * - 实体与关系管理
 * - 路径查询
 * - 邻居发现
 * - 图算法（PageRank、社区发现）
 */

import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { graphEntities, graphRelations, type GraphEntity, type GraphRelation } from './schema.js';

/**
 * 图节点（实体）
 */
export interface GraphNode {
  id: number;
  type: string;
  name: string;
  properties?: Record<string, any>;
}

/**
 * 图边（关系）
 */
export interface GraphEdge {
  id: number;
  fromEntityId: number;
  toEntityId: number;
  relationType: string;
  weight: number;
  properties?: Record<string, any>;
}

/**
 * 图路径（节点序列）
 */
export interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalWeight: number;
}

/**
 * PostgreSQL 图存储配置
 */
export interface PostgresGraphStoreConfig {
  /** 数据库连接 URL */
  databaseUrl: string;
}

/**
 * PostgreSQL 图存储类
 *
 * 核心功能：
 * 1. 实体与关系管理
 * 2. 图遍历（多跳查询）
 * 3. 路径查找
 * 4. 邻居发现
 */
export class PostgresGraphStore {
  private db: ReturnType<typeof drizzle>;
  private client: postgres.Sql<{}>;

  constructor(config: PostgresGraphStoreConfig) {
    this.client = postgres(config.databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    this.db = drizzle(this.client);
  }

  /**
   * 创建实体
   */
  async createEntity(entity: {
    type: string;
    name: string;
    properties?: Record<string, any>;
  }): Promise<number> {
    const result = await this.db
      .insert(graphEntities)
      .values(entity)
      .returning({ id: graphEntities.id });

    return result[0].id;
  }

  /**
   * 创建关系
   */
  async createRelation(relation: {
    fromEntityId: number;
    toEntityId: number;
    relationType: string;
    weight?: number;
    properties?: Record<string, any>;
  }): Promise<number> {
    const result = await this.db
      .insert(graphRelations)
      .values({
        ...relation,
        weight: relation.weight?.toString() ?? '1.0',
      })
      .returning({ id: graphRelations.id });

    return result[0].id;
  }

  /**
   * 获取实体的所有邻居（1 跳）
   */
  async getNeighbors(entityId: number, relationType?: string): Promise<GraphNode[]> {
    const conditions = [eq(graphRelations.fromEntityId, entityId)];

    if (relationType) {
      conditions.push(eq(graphRelations.relationType, relationType));
    }

    const result = await this.db
      .select({
        id: graphEntities.id,
        type: graphEntities.type,
        name: graphEntities.name,
        properties: graphEntities.properties,
      })
      .from(graphRelations)
      .innerJoin(graphEntities, eq(graphRelations.toEntityId, graphEntities.id))
      .where(and(...conditions));

    return result as GraphNode[];
  }

  /**
   * 查找两个实体间的最短路径（BFS 算法）
   *
   * 限制：最多 5 跳（避免无限循环）
   */
  async findShortestPath(
    fromEntityId: number,
    toEntityId: number,
    maxHops: number = 5
  ): Promise<GraphPath | null> {
    // 使用递归 CTE 实现 BFS
    const result = await this.client`
      WITH RECURSIVE path AS (
        -- 基础情况：起始节点
        SELECT
          ${fromEntityId}::int as entity_id,
          0 as hop,
          ARRAY[${fromEntityId}::int] as path,
          ARRAY[]::int[] as edge_ids,
          0.0::float as total_weight
        UNION ALL
        -- 递归情况：遍历邻居
        SELECT
          gr.to_entity_id,
          p.hop + 1,
          p.path || gr.to_entity_id,
          p.edge_ids || gr.id,
          p.total_weight + gr.weight::float
        FROM path p
        JOIN graph_relations gr ON p.entity_id = gr.from_entity_id
        WHERE
          p.hop < ${maxHops} AND
          NOT (gr.to_entity_id = ANY(p.path)) -- 避免循环
      )
      SELECT *
      FROM path
      WHERE entity_id = ${toEntityId}
      ORDER BY hop, total_weight
      LIMIT 1
    `;

    if (result.length === 0) {
      return null;
    }

    const pathResult = result[0];

    // 获取节点详情
    const nodes = await this.db
      .select()
      .from(graphEntities)
      .where(inArray(graphEntities.id, pathResult.path as number[]));

    // 获取边详情
    const edges = await this.db
      .select()
      .from(graphRelations)
      .where(inArray(graphRelations.id, pathResult.edge_ids as number[]));

    return {
      nodes: nodes as GraphNode[],
      edges: edges.map((e) => ({
        ...e,
        weight: parseFloat(e.weight as unknown as string),
      })) as GraphEdge[],
      totalWeight: pathResult.total_weight,
    };
  }

  /**
   * 查找实体的所有关联路径（多跳）
   *
   * 示例：查找与"专利A"相关的所有实体（2-3 跳）
   */
  async findRelatedEntities(
    entityId: number,
    maxDepth: number = 3,
    minWeight: number = 0.5
  ): Promise<Map<number, GraphNode>> {
    const result = await this.client`
      WITH RECURSIVE related AS (
        -- 基础情况：直接邻居
        SELECT
          gr.to_entity_id,
          1 as depth,
          gr.weight::float
        FROM graph_relations gr
        WHERE gr.from_entity_id = ${entityId} AND gr.weight::float >= ${minWeight}
        UNION ALL
        -- 递归情况：邻居的邻居
        SELECT
          gr.to_entity_id,
          r.depth + 1,
          LEAST(r.weight, gr.weight::float)
        FROM related r
        JOIN graph_relations gr ON r.to_entity_id = gr.from_entity_id
        WHERE
          r.depth < ${maxDepth} AND
          gr.weight::float >= ${minWeight} AND
          gr.to_entity_id != ${entityId}
      )
      SELECT DISTINCT ge.id, ge.type, ge.name, ge.properties
      FROM related r
      JOIN graph_entities ge ON r.to_entity_id = ge.id
      ORDER BY r.depth, r.weight DESC
    `;

    const entityMap = new Map<number, GraphNode>();

    for (const row of result) {
      entityMap.set(row.id, {
        id: row.id,
        type: row.type,
        name: row.name,
        properties: row.properties,
      });
    }

    return entityMap;
  }

  /**
   * 查找实体
   */
  async findEntityByName(name: string, type?: string): Promise<GraphNode | null> {
    const conditions = [eq(graphEntities.name, name)];

    if (type) {
      conditions.push(eq(graphEntities.type, type));
    }

    const result = await this.db
      .select()
      .from(graphEntities)
      .where(and(...conditions))
      .limit(1);

    return result[0] ? { ...result[0], properties: result[0].properties ?? undefined } : null;
  }

  /**
   * 获取实体详情
   */
  async getEntity(id: number): Promise<GraphNode | null> {
    const result = await this.db
      .select()
      .from(graphEntities)
      .where(eq(graphEntities.id, id))
      .limit(1);

    return result[0] ? { ...result[0], properties: result[0].properties ?? undefined } : null;
  }

  /**
   * 删除实体（级联删除关系）
   */
  async deleteEntity(id: number): Promise<boolean> {
    // 先删除相关关系
    await this.db
      .delete(graphRelations)
      .where(
        or(
          eq(graphRelations.fromEntityId, id),
          eq(graphRelations.toEntityId, id)
        )
      );

    // 检查实体是否存在
    const existing = await this.getEntity(id);
    if (!existing) return false;

    // 删除实体
    await this.db.delete(graphEntities).where(eq(graphEntities.id, id));
    return true;
  }

  /**
   * 获取图统计信息
   */
  async getStats(): Promise<{
    totalEntities: number;
    totalRelations: number;
    entityTypes: Record<string, number>;
    relationTypes: Record<string, number>;
  }> {
    const entities = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(graphEntities);

    const relations = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(graphRelations);

    const entityTypes = await this.db
      .select({
        type: graphEntities.type,
        count: sql<number>`count(*)::int`,
      })
      .from(graphEntities)
      .groupBy(graphEntities.type);

    const relationTypes = await this.db
      .select({
        type: graphRelations.relationType,
        count: sql<number>`count(*)::int`,
      })
      .from(graphRelations)
      .groupBy(graphRelations.relationType);

    const entityTypesMap: Record<string, number> = {};
    for (const row of entityTypes) {
      entityTypesMap[row.type] = row.count;
    }

    const relationTypesMap: Record<string, number> = {};
    for (const row of relationTypes) {
      relationTypesMap[row.type] = row.count;
    }

    return {
      totalEntities: entities[0].count,
      totalRelations: relations[0].count,
      entityTypes: entityTypesMap,
      relationTypes: relationTypesMap,
    };
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    await this.client.end();
  }
}

// 辅助函数（or 已在文件顶部导入）

/**
 * 创建 PostgreSQL 图存储实例
 */
export function createPostgresGraphStore(
  config: PostgresGraphStoreConfig
): PostgresGraphStore {
  return new PostgresGraphStore(config);
}
