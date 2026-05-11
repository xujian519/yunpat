import { EventBus } from './dist/eventbus/EventBus.js'
import { Agent } from './dist/agent/Agent.js'

// Mock implementations for required dependencies
const mockMemory = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(),
  getAll: () => Promise.resolve({}),
  setAll: () => Promise.resolve(),
  delete: () => Promise.resolve(),
  has: () => Promise.resolve(false),
  clear: () => Promise.resolve(),
  search: () => Promise.resolve([])
}

const mockTools = {
  register: () => {},
  unregister: () => {},
  get: () => undefined,
  call: () => Promise.resolve({}),
  list: () => []
}

const mockLLM = {
  chat: () => Promise.resolve({ 
    message: { role: 'assistant', content: 'test response' },
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
  }),
  chatStream: async function* () { yield { delta: 'test', done: true } },
  embed: () => Promise.resolve([])
}

const eventBus = new EventBus()

// Create a simple test Agent
class TestAgent extends Agent {
  async plan(input, context) {
    return { plan: 'test plan from agent' }
  }
  
  async act(plan, context) {
    return { result: 'test result from agent' }
  }
}

const agent = new TestAgent({
  name: 'test-agent',
  description: 'Test Agent',
  eventBus,
  memory: mockMemory,
  tools: mockTools,
  llm: mockLLM
})

// Collect events
const events = []
const subscription = eventBus.subscribe('agent:*', (event) => {
  console.log('Event received:', event.type, event.data)
  events.push({ type: event.type, data: event.data })
})

console.log('Starting agent execution...')

// Wait a bit to ensure subscription is ready
setTimeout(async () => {
  try {
    const result = await agent.execute({ test: 'input' })
    console.log('Agent execution completed successfully')
    console.log('Result:', result)
    console.log('\n=== Events Collected ===')
    console.log('Total events:', events.length)
    events.forEach((event, index) => {
      console.log(`${index + 1}. ${event.type}:`, JSON.stringify(event.data, null, 2))
    })
    
    // Check for specific events
    const startedEvents = events.filter(e => e.type === 'agent:started')
    const completedEvents = events.filter(e => e.type === 'agent:completed')
    
    console.log(`\n=== Event Analysis ===`)
    console.log('agent:started events:', startedEvents.length)
    console.log('agent:completed events:', completedEvents.length)
    
    subscription.unsubscribe()
    process.exit(0)
  } catch (error) {
    console.error('Error during agent execution:', error)
    subscription.unsubscribe()
    process.exit(1)
  }
}, 100)
