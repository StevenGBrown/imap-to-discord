import * as cdk from '@aws-cdk/core'

import { ImapToDiscord } from '../lib'

class ImapToDiscordStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id, {
      description: 'https://github.com/StevenGBrown/imap-to-discord',
    })

    new ImapToDiscord(this, 'ImapToDiscord', {
      configFile: process.env.CONFIG_FILE || '',
    })
  }
}

if (!process.env.npm_lifecycle_script?.includes('cdk "bootstrap"')) {
  const app = new cdk.App()
  new ImapToDiscordStack(app, 'ImapToDiscordStack')
}
