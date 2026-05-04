/**
 * 全局类型声明
 * 用于解决第三方依赖类型缺失问题
 */

declare module 'mysql2/promise' {
  export interface MySqlConnection {
    query(sql: string, params?: any[]): Promise<any>
    end(): Promise<void>
  }

  export interface MySqlPool {
    getConnection(): Promise<MySqlConnection>
    end(): Promise<void>
  }

  export function createConnection(config: any): Promise<MySqlConnection>
  export function createPool(config: any): MySqlPool
}

declare module 'gel' {
  export interface GelConnection {
    query(sql: string, params?: any[]): Promise<any>
    release(): void
  }

  export interface GelPool {
    getConnection(): Promise<GelConnection>
    close(): Promise<void>
  }

  export function createClient(config: any): Promise<GelConnection>
  export function createPool(config: any): GelPool
}

// 声明不常见模块为any类型
declare module 'mysql2' {
  export * from 'mysql2/promise'
}

declare module 'react-native' {
  export * from 'react'
}

declare module 'electron' {
  export interface BrowserWindow {
    loadURL(url: string): Promise<void>
    on(event: string, callback: Function): void
  }

  export interface App {
    on(event: string, callback: Function): void
    quit(): void
  }

  export const app: App
  export const BrowserWindow: new () => BrowserWindow
}
