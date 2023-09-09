import { App, Stack } from 'aws-cdk-lib'
import { Construct } from 'constructs'

import { ImapToDiscord } from '../lib'

class ImapToDiscordStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: 'https://github.com/StevenGBrown/imap-to-discord',
    })

    new ImapToDiscord(this, 'ImapToDiscord', {
      configFile: process.env.CONFIG_FILE || '',
    })
  }
}

if (!process.env.npm_lifecycle_script?.includes('cdk "bootstrap"')) {
  const app = new App()
  new ImapToDiscordStack(app, 'ImapToDiscordStack')
}
