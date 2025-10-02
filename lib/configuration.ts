import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import getStream from 'get-stream'
import * as stream from 'node:stream'
import { z } from 'zod'

const configFileSchema = z.object({
  user: z.string().min(1),
  password: z.string().min(1),
  host: z.string().min(1),
  tls: z.boolean().default(true),
  port: z.number().optional(),
  folder: z.string().min(1).default('INBOX'),
  discordWebhookUrl: z.string().min(1),
  glossary: z.record(z.string().min(1)).default({}),
  allowList: z.string().min(1).array().default([]),
  denyList: z.string().min(1).array().default([]),
})
type ConfigFileSchemaType = z.infer<typeof configFileSchema>

export type Configuration = ConfigFileSchemaType &
  Required<Pick<ConfigFileSchemaType, 'port'>>

export async function getConfiguration(): Promise<Configuration> {
  const s3 = new S3Client({})
  try {
    const configFile = await s3.send(s3GetObjectCommand())

    const body = await getStream(configFile.Body as stream.Readable)

    try {
      return parseConfiguration(body)
    } catch (e) {
      const error = e as Error
      throw new Error(
        `Invalid configuration found in S3.\n${error.message || ''}`
      )
    }
  } finally {
    s3.destroy()
  }
}

export function parseConfiguration(configAsString: string): Configuration {
  const config = configFileSchema.parse(JSON.parse(configAsString))
  return { port: config.tls ? 993 : 143, ...config }
}

function s3GetObjectCommand(): GetObjectCommand {
  const configFileArn = process.env.CONFIG_FILE || ''
  const match = /^arn:aws:s3:::([^/]+)\/(.+)$/.exec(configFileArn)
  if (!match) {
    throw new Error(
      `The CONFIG_FILE environment variable must be an S3 ARN, but was "${configFileArn}"`
    )
  }
  return new GetObjectCommand({ Bucket: match[1], Key: match[2] })
}
