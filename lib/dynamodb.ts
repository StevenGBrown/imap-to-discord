import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'

const nextToReadSchema = z.object({
  uidnext: z.number(),
  uidvalidity: z.number(),
  mailboxHash: z.string(),
  timestamp: z.number(),
})
export type NextToRead = z.infer<typeof nextToReadSchema>

export async function getNextToRead(): Promise<NextToRead | null> {
  const output = await dynamodb.send(
    new GetCommand({ ...tableName(), Key: id })
  )
  return output.Item ? nextToReadSchema.parse(output.Item) : null
}

export async function setNextToRead(nextToRead: NextToRead): Promise<void> {
  await dynamodb.send(
    new PutCommand({
      ...tableName(),
      Item: { ...nextToReadSchema.parse(nextToRead), ...id },
    })
  )
}

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const id = { Id: 'settings' } as const

function tableName() {
  const tableName = process.env.DYNAMODB_TABLE_NAME
  if (!tableName) {
    throw new Error(
      'The DYNAMODB_TABLE_NAME environment variable has not been configured'
    )
  }
  return { TableName: tableName }
}
