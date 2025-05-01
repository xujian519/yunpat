import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  GooglePatentsFetchTool,
  GooglePatentDetailTool,
} from '../../src/tools/GooglePatentsTool.js'

describe('GooglePatentsFetchTool', () => {
  let tool: GooglePatentsFetchTool

  beforeEach(() => {
    tool = new GooglePatentsFetchTool()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has correct metadata', () => {
    expect(tool.metadata.name).toBe('google_patents_fetch')
    expect(tool.metadata.category).toBe('patent')
    expect(tool.metadata.permissions).toContain('http:request')
    expect(tool.metadata.isConcurrencySafe).toBe(true)
  })

  it('constructs correct search URL and headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ results: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const context = {} as any
    await tool.execute({ query: 'neural network', page: 2, language: 'en' }, context)

    const callArgs = mockFetch.mock.calls[0]
    const url = callArgs[0]
    const options = callArgs[1]

    expect(url).toContain('patents.google.com/xhr/query')
    expect(url).toContain(encodeURIComponent('neural network'))
    expect(options.method).toBe('GET')
    expect(options.headers['Accept']).toBe('application/json')
    expect(options.headers['Accept-Language']).toBe('en')
    expect(options.headers['User-Agent']).toContain('Mozilla')
  })

  it('parses Google Patents response correctly', async () => {
    const mockData = {
      results: [
        {
          patent_id: 'US1234567A',
          title: 'Neural Network Processor',
          summary: 'A processor for neural networks',
          publication_number: ['US1234567A'],
          assignee_harmonized: 'Example Corp',
          publication_date: '2023-01-01',
          ipc_codes: ['G06N3/00'],
        },
      ],
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockData,
    })
    vi.stubGlobal('fetch', mockFetch)

    const context = {} as any
    const result = await tool.execute({ query: 'neural' }, context)

    expect(result.results).toHaveLength(1)
    expect(result.results[0].patentId).toBe('US1234567A')
    expect(result.results[0].title).toBe('Neural Network Processor')
    expect(result.results[0].snippet).toBe('A processor for neural networks')
    expect(result.results[0].url).toBe('https://patents.google.com/patent/US1234567A/')
    expect(result.results[0].assignee).toBe('Example Corp')
    expect(result.results[0].publicationDate).toBe('2023-01-01')
    expect(result.results[0].ipcCodes).toEqual(['G06N3/00'])
    expect(result.page).toBe(1)
    expect(result.total).toBe(1)
  })

  it('returns empty results for empty response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    const context = {} as any
    const result = await tool.execute({ query: 'xyz' }, context)

    expect(result.results).toEqual([])
    expect(result.total).toBe(0)
  })

  it('throws on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    })
    vi.stubGlobal('fetch', mockFetch)

    const context = {} as any
    await expect(tool.execute({ query: 'test' }, context)).rejects.toThrow('HTTP 403: Forbidden')
  })

  it('uses default page and language', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ results: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const context = {} as any
    const result = await tool.execute({ query: 'test' }, context)

    expect(result.page).toBe(1)
    const url = mockFetch.mock.calls[0][0]
    expect(url).toContain(encodeURIComponent('test'))
  })
})

describe('GooglePatentDetailTool', () => {
  let tool: GooglePatentDetailTool

  beforeEach(() => {
    tool = new GooglePatentDetailTool()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has correct metadata', () => {
    expect(tool.metadata.name).toBe('google_patent_detail')
    expect(tool.metadata.permissions).toContain('http:request')
  })

  it('constructs correct detail URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '<html><head><title>Test Patent - Google Patents</title></head></html>',
    })
    vi.stubGlobal('fetch', mockFetch)

    const context = {} as any
    await tool.execute({ patentNumber: 'CN123456789A', language: 'zh-CN' }, context)

    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toBe('https://patents.google.com/patent/CN123456789A/')
    expect(callArgs[1].headers['Accept-Language']).toBe('zh-CN')
  })

  it('parses HTML correctly', async () => {
    const html = `<html>
      <head><title>Test Patent Title - Google Patents</title></head>
      <body>
        <meta name="description" content="Test abstract content">
        <section id="claims">
          <div class="claim-text">Claim 1 text</div>
          <div class="claim-text">Claim 2 text</div>
        </section>
        <span itemprop="ipcCode">G06N3/00</span>
        <span itemprop="ipcCode">G06F17/00</span>
        <span itemprop="assignee">Example Corp</span>
        <span itemprop="inventor">John Doe</span>
        <span itemprop="inventor">Jane Smith</span>
        <time itemprop="publicationDate">2023-05-01</time>
        <time itemprop="filingDate">2022-01-01</time>
      </body>
    </html>`

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => html,
    })
    vi.stubGlobal('fetch', mockFetch)

    const context = {} as any
    const result = await tool.execute({ patentNumber: 'US1234567A' }, context)

    expect(result.patentNumber).toBe('US1234567A')
    expect(result.title).toBe('Test Patent Title')
    expect(result.abstract).toBe('Test abstract content')
    expect(result.claims).toEqual(['Claim 1 text', 'Claim 2 text'])
    expect(result.ipcCodes).toEqual(['G06N3/00', 'G06F17/00'])
    expect(result.applicant).toBe('Example Corp')
    expect(result.inventor).toEqual(['John Doe', 'Jane Smith'])
    expect(result.publicationDate).toBe('2023-05-01')
    expect(result.filingDate).toBe('2022-01-01')
    expect(result.description).toBe('Test abstract content')
  })

  it('returns empty values for missing HTML elements', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '<html><head><title></title></head><body></body></html>',
    })
    vi.stubGlobal('fetch', mockFetch)

    const context = {} as any
    const result = await tool.execute({ patentNumber: 'WO9999999A1' }, context)

    expect(result.patentNumber).toBe('WO9999999A1')
    expect(result.title).toBe('')
    expect(result.abstract).toBe('')
    expect(result.claims).toEqual([])
    expect(result.ipcCodes).toEqual([])
    expect(result.applicant).toBe('')
    expect(result.inventor).toEqual([])
    expect(result.publicationDate).toBe('')
    expect(result.filingDate).toBe('')
  })

  it('throws on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })
    vi.stubGlobal('fetch', mockFetch)

    const context = {} as any
    await expect(tool.execute({ patentNumber: 'INVALID' }, context)).rejects.toThrow(
      'HTTP 404: Not Found'
    )
  })
})
