import type { Config } from 'drizzle-kit'

export default {
  schema: './packages/core/src/db/schema.ts',
  out: './packages/core/src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://yunpat:yunpat123@localhost:5432/yunpat',
  },
} satisfies Config
