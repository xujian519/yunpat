/**
 * 通用类型定义
 * 用于替代 any 类型，提供更好的类型安全
 */

/**
 * 任意 JSON 可序列化值
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue }

/**
 * 任意对象（非原始类型）
 */
export type AnyObject = Record<string, unknown>

/**
 * 函数类型
 */
export type AnyFunction = (...args: unknown[]) => unknown

/**
 * 异步函数类型
 */
export type AsyncFunction = (...args: unknown[]) => Promise<unknown>

/**
 * 类构造器类型
 */
export type ClassConstructor = new (...args: unknown[]) => unknown

/**
 * 字典类型（键值对）
 */
export type Dictionary<T> = Record<string, T>

/**
 * 可能包含额外属性的对象
 */
export type WithExtraProperties<T, Extra = Record<string, unknown>> = T & Extra

/**
 * 可选的深度部分类型
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
