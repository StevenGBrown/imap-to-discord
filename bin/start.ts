import { handler } from '../lib/index.lambda'

async function main() {
  process.env.DRY_RUN = process.env.DRY_RUN || 'true'

  await handler(
    {},
    {
      getRemainingTimeInMillis: () => Number.POSITIVE_INFINITY,
    }
  )
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
}
