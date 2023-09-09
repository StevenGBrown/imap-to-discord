import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import getStream from 'get-stream'
import * as stream from 'node:stream'
import { z } from 'zod'

const configFileSchema = z.object({
  user: z.string(),
  password: z.string(),
  host: z.string(),
  tls: z.boolean().default(true),
  port: z.number().optional(),
  folder: z.string().default('INBOX'),
  discordWebhookUrl: z.string(),
  glossary: z.record(z.string()).default({}),
})
type ConfigFileSchemaType = z.infer<typeof configFileSchema>

export type Configuration = ConfigFileSchemaType &
  Required<Pick<ConfigFileSchemaType, 'port'>>

export async function getConfiguration(): Promise<Configuration> {
  const s3 = new S3Client({})
  try {
    const configFile = await s3.send(s3GetObjectCommand())

    const body = await getStream(configFile.Body as stream.Readable)

    const config = parseConfig(body)
    return { port: config.tls ? 993 : 143, ...config }
  } finally {
    s3.destroy()
  }
}

function s3GetObjectCommand(): GetObjectCommand {
  const configFileArn = process.env.CONFIG_FILE || ''
  const match = configFileArn.match(/^arn:aws:s3:::([^/]+)\/(.+)$/)
  if (!match) {
    throw new Error(
      `The CONFIG_FILE environment variable must be an S3 ARN, but was "${configFileArn}"`
    )
  }
  return new GetObjectCommand({ Bucket: match[1], Key: match[2] })
}

function parseConfig(body: string): ConfigFileSchemaType {
  try {
    return configFileSchema.parse(JSON.parse(body))
  } catch (e) {
    const error = e as Error
    throw new Error(
      `Invalid configuration found in S3.\n${error.message || ''}`
    )
  }
}
