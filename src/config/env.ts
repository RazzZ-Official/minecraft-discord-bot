import 'dotenv/config'
import { z } from 'zod'

// Secrets and machine-specific settings, read from the .env file. See .env.example.
const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  PTERO_PANEL_URL: z.url().optional(),
  PTERO_SERVER_ID: z.string().min(1).optional(),
  PTERO_API_KEY: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>

/** Validates the environment and exits with a readable message if something is missing. */
export const loadEnv = (): Env => {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n')
    console.error(`Invalid .env file:\n${problems}`)
    process.exit(1)
  }
  return result.data
}
