/**
 * WebSocket 审批服务器
 *
 * 使用 Node.js 原生 http 模块 + WebSocket 协议实现
 * 无需外部依赖
 */

import { createServer, IncomingMessage, ServerResponse, type Server as HttpServer } from 'http'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import type { ExecutionContext } from '../../lifecycle/Lifecycle.js'

export interface WebSocketApprovalConfig {
  port: number
  host?: string
  apiKey?: string
}

export interface WSApprovalRequest {
  type: 'approval_request'
  approvalId: string
  agentName: string
  content: unknown
  context: { goal: string; reasoning: string; alternatives?: string[] }
  level: 'info' | 'warning' | 'critical'
  timeout: number
}

export interface WSApprovalResponse {
  type: 'approval_response'
  approvalId: string
  approved: boolean
  feedback?: {
    type: 'approve' | 'correct' | 'reject' | 'supplement'
    content: string
    corrections?: Record<string, unknown>
    supplements?: Record<string, unknown>
    rejectionReason?: string
  }
}

type WSClient = {
  id: string
  socket: any
  isAlive: boolean
}

type PendingApproval = {
  request: WSApprovalRequest
  resolve: (response: WSApprovalResponse) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
  context: ExecutionContext
}

export class WebSocketApprovalServer {
  private config: WebSocketApprovalConfig
  private server: HttpServer | null = null
  private clients = new Map<string, WSClient>()
  private pendingApprovals = new Map<string, PendingApproval>()

  constructor(config: WebSocketApprovalConfig) {
    this.config = {
      host: '0.0.0.0',
      ...config,
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: 'ok', connections: this.clients.size }))
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('WebSocket Approval Server')
        }
      })

      this.server.on('upgrade', (req: IncomingMessage, socket: any, head: Buffer) => {
        if (!this.handleAuth(req)) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
          socket.destroy()
          return
        }

        this.handleUpgrade(req, socket, head)
      })

      const host = this.config.host || '0.0.0.0'
      this.server.listen(this.config.port, host, () => {
        console.log(`[WS Approval] Server started on ws://${host}:${this.config.port}`)
        resolve()
      })

      this.server.on('error', reject)
    })
  }

  async stop(): Promise<void> {
    for (const [_id, client] of this.clients) {
      client.socket.end()
    }
    this.clients.clear()

    for (const [_id, pending] of this.pendingApprovals) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Server shutting down'))
    }
    this.pendingApprovals.clear()

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[WS Approval] Server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  async requestApproval(
    request: Omit<WSApprovalRequest, 'type'>,
    context: ExecutionContext,
    timeout: number = 30000
  ): Promise<WSApprovalResponse> {
    const approvalId = request.approvalId || uuidv4()

    const wsRequest: WSApprovalRequest = {
      type: 'approval_request',
      approvalId,
      agentName: request.agentName,
      content: request.content,
      context: request.context,
      level: request.level,
      timeout,
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(approvalId)
        reject(new Error(`WebSocket approval timeout: ${approvalId}`))
      }, timeout)

      this.pendingApprovals.set(approvalId, {
        request: wsRequest,
        resolve,
        reject,
        timer,
        context,
      })

      this.broadcast(wsRequest)
    })
  }

  private handleAuth(req: IncomingMessage): boolean {
    if (!this.config.apiKey) return true

    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const token =
      url.searchParams.get('token') || req.headers['authorization']?.replace('Bearer ', '')

    return token === this.config.apiKey
  }

  private handleUpgrade(req: IncomingMessage, socket: any, head: Buffer): void {
    const wsKey = req.headers['sec-websocket-key'] as string
    if (!wsKey) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
      socket.destroy()
      return
    }

    const acceptKey = createHash('sha1')
      .update(wsKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64')

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
        '\r\n'
    )

    const clientId = uuidv4()
    const client: WSClient = { id: clientId, socket, isAlive: true }
    this.clients.set(clientId, client)

    console.log(`[WS Approval] Client connected: ${clientId} (total: ${this.clients.size})`)

    socket.on('data', (data: Buffer) => {
      try {
        const message = this.decodeWebSocketFrame(data)
        if (message) {
          this.handleMessage(clientId, message)
        }
      } catch (err) {
        console.error(`[WS Approval] Error handling message from ${clientId}:`, err)
      }
    })

    socket.on('close', () => {
      this.clients.delete(clientId)
      console.log(`[WS Approval] Client disconnected: ${clientId} (total: ${this.clients.size})`)
    })

    socket.on('error', (err: Error) => {
      console.error(`[WS Approval] Client error ${clientId}:`, err.message)
      this.clients.delete(clientId)
    })

    if (head.length > 0) {
      try {
        const message = this.decodeWebSocketFrame(head)
        if (message) {
          this.handleMessage(clientId, message)
        }
      } catch {
        // ignore invalid messages from head buffer
      }
    }
  }

  private handleMessage(clientId: string, message: string): void {
    try {
      const parsed = JSON.parse(message)

      if (parsed.type === 'approval_response') {
        const pending = this.pendingApprovals.get(parsed.approvalId)
        if (pending) {
          clearTimeout(pending.timer)
          this.pendingApprovals.delete(parsed.approvalId)
          pending.resolve(parsed as WSApprovalResponse)
        }
      } else if (parsed.type === 'ping') {
        const client = this.clients.get(clientId)
        if (client) {
          this.sendToClient(client, { type: 'pong', timestamp: Date.now() })
        }
      }
    } catch (err) {
      console.error(`[WS Approval] Invalid message from ${clientId}:`, err)
    }
  }

  private broadcast(data: unknown): void {
    const message = JSON.stringify(data)
    for (const [, client] of this.clients) {
      this.sendToClient(client, message)
    }
  }

  private sendToClient(client: WSClient, data: unknown): void {
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data)
      const frame = this.encodeWebSocketFrame(message)
      client.socket.write(frame)
    } catch (err) {
      console.error(`[WS Approval] Error sending to client ${client.id}:`, err)
    }
  }

  private decodeWebSocketFrame(buffer: Buffer): string | null {
    if (buffer.length < 2) return null

    const firstByte = buffer[0]
    const secondByte = buffer[1]

    const opcode = firstByte & 0x0f
    const isMasked = (secondByte & 0x80) !== 0
    let payloadLength = secondByte & 0x7f
    let offset = 2

    if (opcode === 0x8) return null

    if (payloadLength === 126) {
      if (buffer.length < 4) return null
      payloadLength = buffer.readUInt16BE(2)
      offset = 4
    } else if (payloadLength === 127) {
      if (buffer.length < 10) return null
      payloadLength = Number(buffer.readBigUInt64BE(2))
      offset = 10
    }

    if (isMasked) {
      if (buffer.length < offset + 4 + payloadLength) return null
      const maskKey = buffer.subarray(offset, offset + 4)
      offset += 4

      const payload = Buffer.alloc(payloadLength)
      for (let i = 0; i < payloadLength; i++) {
        payload[i] = buffer[offset + i] ^ maskKey[i % 4]
      }

      return payload.toString('utf8')
    }

    if (buffer.length < offset + payloadLength) return null
    return buffer.subarray(offset, offset + payloadLength).toString('utf8')
  }

  private encodeWebSocketFrame(message: string): Buffer {
    const payload = Buffer.from(message, 'utf8')
    const length = payload.length

    let header: Buffer
    if (length < 126) {
      header = Buffer.alloc(2)
      header[0] = 0x81
      header[1] = length
    } else if (length < 65536) {
      header = Buffer.alloc(4)
      header[0] = 0x81
      header[1] = 126
      header.writeUInt16BE(length, 2)
    } else {
      header = Buffer.alloc(10)
      header[0] = 0x81
      header[1] = 127
      header.writeBigUInt64BE(BigInt(length), 2)
    }

    return Buffer.concat([header, payload])
  }
}
