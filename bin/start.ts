import { Context } from 'aws-lambda'

import { handler } from '../lib/index.lambda'

async function main() {
  process.env.DRY_RUN = process.env.DRY_RUN || 'true'

  const context: Partial<Context> = {
    getRemainingTimeInMillis: () => Number.POSITIVE_INFINITY,
  }
  await handler({}, context as Context)
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
}
