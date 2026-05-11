/**
 * Docker 容器生命周期管理
 *
 * 为集成测试管理 PostgreSQL 和 Redis 容器
 * 使用 packages/docker-compose.yml 中定义的服务
 */

import { execSync, spawn } from 'child_process'

const COMPOSE_FILE = 'packages/docker-compose.yml'
const DEFAULT_TIMEOUT = 30_000

export interface ContainerConfig {
  postgres?: { port?: number; user?: string; password?: string; database?: string }
  redis?: { port?: number }
}

let composeProcess: ReturnType<typeof spawn> | null = null

export async function startTestContainers(
  services: Array<'postgres' | 'redis'> = ['postgres', 'redis'],
  config?: ContainerConfig
): Promise<void> {
  const serviceNames = services.join(' ')

  try {
    execSync(`docker compose -f ${COMPOSE_FILE} up -d ${serviceNames}`, {
      stdio: 'pipe',
      timeout: 60_000,
    })
  } catch {
    // docker compose 不可用或容器已运行
  }

  // 等待所有服务就绪
  for (const service of services) {
    await waitForHealthy(service, DEFAULT_TIMEOUT)
  }
}

export async function stopTestContainers(): Promise<void> {
  try {
    execSync(`docker compose -f ${COMPOSE_FILE} down -v`, {
      stdio: 'pipe',
      timeout: 30_000,
    })
  } catch {
    // 忽略关闭错误
  }
}

export async function waitForHealthy(
  service: 'postgres' | 'redis',
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  const healthCmd =
    service === 'postgres'
      ? 'docker compose -f packages/docker-compose.yml exec -T postgres pg_isready -U yunpat'
      : 'docker compose -f packages/docker-compose.yml exec -T redis redis-cli ping'

  while (Date.now() < deadline) {
    try {
      execSync(healthCmd, { stdio: 'pipe', timeout: 5_000 })
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  return false
}

export function getConnectionString(service: 'postgres' | 'redis'): string {
  if (service === 'postgres') {
    return (
      process.env.TEST_DATABASE_URL ||
      'postgresql://yunpat:yunpat123@localhost:5432/yunpat_test'
    )
  }
  return process.env.REDIS_URL || 'redis://localhost:6379'
}

export function hasDocker(): boolean {
  try {
    execSync('docker info', { stdio: 'pipe', timeout: 5_000 })
    return true
  } catch {
    return false
  }
}
