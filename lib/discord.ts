import * as discordjs from 'discord.js'
import * as util from 'node:util'

export interface DiscordMessage {
  content: string
  files: readonly {
    attachment: Buffer
    name: string
  }[]
  embedFields: readonly { name: string; value: string }[]
}

export const MAX_MESSAGE_CONTENT_LENGTH = 2000

export const MAX_EMBED_FIELD_NAME_LENGTH = 256

export const MAX_EMBED_FIELD_VALUE_LENGTH = 1024

export const MAX_ALL_EMBED_STRUCTURES_SIZE = 6000

const ELLIPSIS = ' ...'

export function trim(content: string | undefined): string {
  return (content || '').trim().replace(/\n{2,}/g, '\n\n')
}

export function truncate(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content
  }
  const newLength = maxLength - ELLIPSIS.length
  return content.substring(0, newLength) + ELLIPSIS
}

export function escapeMarkdown(content: string): string {
  return content.replace(/_|\*|~|`|>|\\/g, '\\$&')
}

export async function sendMessage({
  discordWebhookUrl,
  message,
}: {
  discordWebhookUrl: string
  message: DiscordMessage
}): Promise<void> {
  const webhookClient = createWebhookClient({ discordWebhookUrl })
  try {
    const [content, options] = [getContent(message), getOptions(message)]
    if ((process.env.DRY_RUN || '').toLowerCase() === 'true') {
      console.log('DRY_RUN=true (not sending the message to Discord).')
      console.log(util.inspect({ content, options }, { depth: null }))
      return
    }
    await webhookClient.send(content, options)
  } finally {
    webhookClient.destroy()
  }
}

function createWebhookClient({
  discordWebhookUrl,
}: {
  discordWebhookUrl: string
}): discordjs.WebhookClient {
  const match = discordWebhookUrl.match(/\/([^/]+)\/([^/]+)$/i)
  if (!match) {
    throw new Error(`Invalid Discord webhook URL: "${discordWebhookUrl}"`)
  }
  const [id, token] = match.slice(1)
  return new discordjs.WebhookClient(id, token)
}

function getContent(message: DiscordMessage): string {
  const { content } = message
  return truncate(content, MAX_MESSAGE_CONTENT_LENGTH)
}

function getOptions(message: DiscordMessage): discordjs.WebhookMessageOptions {
  return {
    files: [...message.files],
    embeds: getEmbeds(message),
  }
}

function getEmbeds(message: DiscordMessage) {
  const { embedFields } = message
  if (!embedFields.length) {
    return undefined
  }
  const fields: { name: string; value: string }[] = []
  let size = 0
  for (const field of embedFields) {
    const name = truncate(field.name, MAX_EMBED_FIELD_NAME_LENGTH)
    const value = truncate(field.value, MAX_EMBED_FIELD_VALUE_LENGTH)
    size += name.length + value.length
    if (size > MAX_ALL_EMBED_STRUCTURES_SIZE) {
      break
    }
    fields.push({ name, value })
  }
  return [{ fields }]
}
