import { z } from 'zod'
import { pathToFileURL, fileURLToPath } from 'url'
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core'

type LSPMethod =
  | 'goToDefinition'
  | 'findReferences'
  | 'hover'
  | 'documentSymbol'
  | 'workspaceSymbol'
  | 'goToImplementation'
  | 'callHierarchy_incoming'
  | 'callHierarchy_outgoing'
  | 'diagnostics'

export interface LSPToolResult {
  method: LSPMethod
  file: string
  line?: number
  results: Array<{
    file: string
    line: number
    character?: number
    text: string
    kind?: string
  }>
  durationMs: number
}

interface LSPClient {
  request(method: string, params: unknown): Promise<unknown>
  isReady(): boolean
}

const SUPPORTED_METHODS: ReadonlySet<string> = new Set<LSPMethod>([
  'goToDefinition',
  'findReferences',
  'hover',
  'documentSymbol',
  'workspaceSymbol',
  'goToImplementation',
  'callHierarchy_incoming',
  'callHierarchy_outgoing',
  'diagnostics',
])

const LSP_METHOD_MAP: Readonly<Record<string, string>> = {
  goToDefinition: 'textDocument/definition',
  findReferences: 'textDocument/references',
  hover: 'textDocument/hover',
  documentSymbol: 'textDocument/documentSymbol',
  workspaceSymbol: 'workspace/symbol',
  goToImplementation: 'textDocument/implementation',
  callHierarchy_incoming: 'callHierarchy/incomingCalls',
  callHierarchy_outgoing: 'callHierarchy/outgoingCalls',
  diagnostics: 'textDocument/diagnostic',
}

let lspClientInstance: LSPClient | null = null

export function setLSPClient(client: LSPClient): void {
  lspClientInstance = client
}

export function getLSPClient(): LSPClient | null {
  return lspClientInstance
}

export class LSPTool extends EnhancedBaseTool<
  {
    method: LSPMethod
    file: string
    line?: number
    character?: number
    query?: string
    includeDeclaration?: boolean
  },
  LSPToolResult
> {
  readonly metadata = {
    name: 'lsp',
    description:
      '代码智能工具。支持：定义跳转、引用查找、hover、文档符号、工作区符号搜索、实现跳转、调用层次。',
    category: ToolCategory.CODE,
    isConcurrencySafe: true,
    inputSchema: z.object({
      method: z
        .enum([
          'goToDefinition',
          'findReferences',
          'hover',
          'documentSymbol',
          'workspaceSymbol',
          'goToImplementation',
          'callHierarchy_incoming',
          'callHierarchy_outgoing',
          'diagnostics',
        ])
        .describe('LSP 方法'),
      file: z.string().describe('文件路径'),
      line: z.number().optional().describe('行号（1-based）'),
      character: z.number().optional().describe('列号（1-based）'),
      query: z.string().optional().describe('工作区符号搜索查询'),
      includeDeclaration: z.boolean().optional().default(true).describe('引用搜索是否包含声明'),
    }),
    permissions: ['lsp:query'],
    version: '1.0.0',
    author: 'YunPat Team',
  }

  isReadOnly(): boolean {
    return true
  }

  async validateInput(input: {
    method: string
    file: string
    line?: number
    query?: string
  }): Promise<{ result: true } | { result: false; message: string; errorCode: number }> {
    if (!SUPPORTED_METHODS.has(input.method)) {
      return {
        result: false,
        message: `Unsupported LSP method: ${input.method}. Supported: ${Array.from(SUPPORTED_METHODS).join(', ')}`,
        errorCode: 400,
      }
    }

    if (!input.file && input.method !== 'workspaceSymbol') {
      return {
        result: false,
        message: 'file is required for all methods except workspaceSymbol',
        errorCode: 400,
      }
    }

    if (
      input.method !== 'documentSymbol' &&
      input.method !== 'workspaceSymbol' &&
      input.method !== 'diagnostics'
    ) {
      if (input.line === undefined || input.line < 1) {
        return {
          result: false,
          message: `line is required and must be >= 1 for ${input.method}`,
          errorCode: 400,
        }
      }
    }

    return { result: true }
  }

  async execute(
    input: {
      method: LSPMethod
      file: string
      line?: number
      character?: number
      query?: string
      includeDeclaration?: boolean
    },
    _context: ToolContext
  ): Promise<LSPToolResult> {
    const startTime = Date.now()

    const client = lspClientInstance
    if (!client || !client.isReady()) {
      return {
        method: input.method,
        file: input.file,
        line: input.line,
        results: [],
        durationMs: Date.now() - startTime,
      }
    }

    const lspMethod = LSP_METHOD_MAP[input.method]
    if (!lspMethod) {
      throw new Error(`No LSP mapping for method: ${input.method}`)
    }

    const params = this.buildParams(input)

    try {
      const rawResult = await client.request(lspMethod, params)
      const results = this.parseResult(rawResult)

      return {
        method: input.method,
        file: input.file,
        line: input.line,
        results,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      throw new Error(
        `LSP ${input.method} failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private buildParams(input: {
    method: LSPMethod
    file: string
    line?: number
    character?: number
    query?: string
    includeDeclaration?: boolean
  }): Record<string, unknown> {
    const fileUri = this.pathToUri(input.file)
    const line = (input.line ?? 1) - 1
    const character = (input.character ?? 1) - 1

    switch (input.method) {
      case 'goToDefinition':
      case 'goToImplementation':
      case 'hover':
        return {
          textDocument: { uri: fileUri },
          position: { line, character },
        }

      case 'findReferences':
        return {
          textDocument: { uri: fileUri },
          position: { line, character },
          context: { includeDeclaration: input.includeDeclaration ?? true },
        }

      case 'documentSymbol':
        return { textDocument: { uri: fileUri } }

      case 'workspaceSymbol':
        return { query: input.query ?? '' }

      case 'callHierarchy_incoming':
      case 'callHierarchy_outgoing':
        return {
          textDocument: { uri: fileUri },
          position: { line, character },
        }

      case 'diagnostics':
        return { textDocument: { uri: fileUri } }

      default:
        return {}
    }
  }

  private parseResult(raw: unknown): LSPToolResult['results'] {
    if (!raw) return []

    if (Array.isArray(raw)) {
      return raw.flatMap((item) => this.parseLocation(item))
    }

    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, unknown>

      if ('locations' in obj && Array.isArray(obj.locations)) {
        return obj.locations.flatMap((item: unknown) => this.parseLocation(item))
      }

      if ('items' in obj && Array.isArray(obj.items)) {
        return obj.items.flatMap((item: unknown) => this.parseDocumentSymbol(item))
      }

      if ('contents' in obj) {
        return this.parseHoverContents(obj.contents)
      }

      if ('range' in obj) {
        return this.parseLocation(obj)
      }
    }

    return []
  }

  private parseLocation(item: unknown): LSPToolResult['results'] {
    if (!item || typeof item !== 'object') return []

    const loc = item as Record<string, unknown>

    if ('uri' in loc && 'range' in loc) {
      return [this.extractLocation(loc)]
    }

    if ('targetUri' in loc && 'targetRange' in loc) {
      return [
        {
          file: this.uriToPath(loc.targetUri as string),
          line: this.extractLine(loc.targetRange as Record<string, unknown>),
          character: this.extractCharacter(loc.targetRange as Record<string, unknown>),
          text: '',
        },
      ]
    }

    return []
  }

  private extractLocation(loc: Record<string, unknown>): LSPToolResult['results'][0] {
    const range = loc.range as Record<string, unknown> | undefined
    return {
      file: this.uriToPath(loc.uri as string),
      line: this.extractLine(range),
      character: this.extractCharacter(range),
      text: '',
    }
  }

  private parseHoverContents(contents: unknown): LSPToolResult['results'] {
    if (typeof contents === 'string') {
      return [{ file: '', line: 0, text: contents }]
    }

    if (Array.isArray(contents)) {
      return contents.map((c: unknown) => ({
        file: '',
        line: 0,
        text: typeof c === 'string' ? c : JSON.stringify(c),
      }))
    }

    if (typeof contents === 'object' && contents !== null) {
      const obj = contents as Record<string, unknown>
      if ('value' in obj) {
        return [
          {
            file: '',
            line: 0,
            text: String(obj.value),
            kind: 'kind' in obj ? String(obj.kind) : undefined,
          },
        ]
      }
    }

    return []
  }

  private parseDocumentSymbol(item: unknown): LSPToolResult['results'] {
    if (!item || typeof item !== 'object') return []

    const sym = item as Record<string, unknown>
    const range = sym.range ?? sym.location
    const locRange =
      range && typeof range === 'object' ? (range as Record<string, unknown>) : undefined

    return [
      {
        file: '',
        line: locRange ? this.extractLine(locRange) : 0,
        text: (sym.name as string) || '',
        kind:
          typeof sym.kind === 'number' ? this.symbolKindToString(sym.kind) : String(sym.kind ?? ''),
      },
    ]
  }

  private extractLine(range?: Record<string, unknown>): number {
    if (!range) return 0
    const start = range.start as Record<string, unknown> | undefined
    return ((start?.line as number) ?? 0) + 1
  }

  private extractCharacter(range?: Record<string, unknown>): number {
    if (!range) return 0
    const start = range.start as Record<string, unknown> | undefined
    return ((start?.character as number) ?? 0) + 1
  }

  private pathToUri(filePath: string): string {
    try {
      return pathToFileURL(filePath).href
    } catch {
      return filePath.startsWith('file://') ? filePath : `file://${filePath}`
    }
  }

  private uriToPath(uri: string): string {
    try {
      return fileURLToPath(uri)
    } catch {
      return uri.startsWith('file://') ? uri.replace('file://', '') : uri
    }
  }

  private symbolKindToString(kind: number): string {
    const kinds: Record<number, string> = {
      1: 'File',
      2: 'Module',
      3: 'Namespace',
      4: 'Package',
      5: 'Class',
      6: 'Method',
      7: 'Property',
      8: 'Field',
      9: 'Constructor',
      10: 'Enum',
      11: 'Interface',
      12: 'Function',
      13: 'Variable',
      14: 'Constant',
      15: 'String',
      16: 'Number',
      17: 'Boolean',
      18: 'Array',
      19: 'Object',
      20: 'Key',
      21: 'Null',
      22: 'EnumMember',
      23: 'Struct',
      24: 'Event',
      25: 'Operator',
      26: 'TypeParameter',
    }
    return kinds[kind] ?? `Unknown(${kind})`
  }
}
