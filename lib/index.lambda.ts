import * as lambda from 'aws-lambda'
import escapeStringRegexp from 'escape-string-regexp'
import * as mailparser from 'mailparser'
import * as crypto from 'node:crypto'

import { Configuration, getConfiguration } from './configuration'
import * as discord from './discord'
import * as dynamodb from './dynamodb'
import { satisfiesFilter } from './filter'
import { Imap, ImapMailbox } from './imap'

type Context = Pick<lambda.Context, 'getRemainingTimeInMillis'>

export async function handler(event: unknown, context: Context) {
  const [config, nextToRead] = await Promise.all([
    getConfiguration(),
    dynamodb.getNextToRead(),
  ])
  const mailboxHash = getMailboxHash(config)

  console.time('Connected')
  const imap = await Imap.connect(config)
  console.timeEnd('Connected')
  try {
    console.time('Mailbox opened')
    const mailbox = await imap.openMailbox(config)
    console.timeEnd('Mailbox opened')
    let { uidnext } = mailbox

    if (!nextToRead || mailboxHash !== nextToRead.mailboxHash) {
      // First time running the lambda or the connection details have changed.
      console.log('First time connecting to this mailbox.')
    } else if (mailbox.uidvalidity !== nextToRead.uidvalidity) {
      // The UIDs have changed, so we can't tell which emails have already been
      // sent to Discord. Most likely this means that the mailbox has been
      // deleted and recreated or that another mailbox was renamed to this one,
      // and in that case it makes sense to not send the emails found in this
      // new mailbox. But the IMAP server could reset the UIDs for any reason.
      console.log('UIDVALIDITY has changed.')
    } else if (mailbox.uidnext !== nextToRead.uidnext) {
      // The uidnext value has changed meaning there are new emails.
      console.log(
        `Checking for new emails starting from UID ${nextToRead.uidnext}.`
      )
      uidnext = await processEmails({ mailbox, nextToRead, config, context })
    } else {
      console.log('Up to date.')
      return
    }

    await dynamodb.setNextToRead({
      uidnext,
      uidvalidity: mailbox.uidvalidity,
      mailboxHash,
      timestamp: Date.now(),
    })
  } finally {
    console.time('Disconnected')
    await imap.disconnect()
    console.timeEnd('Disconnected')
  }
}

function getMailboxHash(values: {
  host: string
  user: string
  folder: string
}): string {
  const hash = crypto.createHash('sha256')
  for (const value of [values.host, values.user, values.folder]) {
    hash.update(value)
  }
  return hash.digest('base64')
}

async function processEmails({
  mailbox,
  nextToRead,
  config,
  context,
}: {
  mailbox: ImapMailbox
  nextToRead: dynamodb.NextToRead
  config: Configuration
  context: Context
}): Promise<number> {
  const { uids } = await mailbox.searchFromUid(nextToRead.uidnext)
  console.log(
    `${uids.length} new ${uids.length === 1 ? 'email' : 'emails'} found.`
  )

  let remaining = uids.length
  for (const uid of uids) {
    const emailContentStream = await mailbox.getEmailContent(uid)
    console.log(`Downloading and parsing the email content. (UID: ${uid})`)
    const parsedEmail = await mailparser.simpleParser(emailContentStream, {
      skipTextToHtml: true,
    })
    console.log(`Download complete. (UID: ${uid})`)
    if (satisfiesFilter({ parsedEmail, config, uid })) {
      console.log(`Sending the email to Discord. (UID: ${uid})`)
      await sendEmailToDiscord(parsedEmail, config)
      console.log(`Marking email as read. (UID: ${uid})`)
      await mailbox.markAsRead(uid)
    }
    remaining--
    if (remaining && context.getRemainingTimeInMillis() < 1000 * 60) {
      console.log(
        `Stopping before the lambda is terminated (${remaining} ${
          remaining === 1 ? 'email' : 'emails'
        }} remaining).`
      )
      return uid + 1
    }
  }

  return mailbox.uidnext
}

async function sendEmailToDiscord(
  parsedEmail: mailparser.ParsedMail,
  config: Configuration
): Promise<void> {
  const { from, subject, text, html, attachments } = parsedEmail

  const title = [
    { label: 'From', value: discord.trim(from?.text) },
    { label: 'Subject', value: discord.trim(subject) },
  ]
    .filter(({ value }) => !!value)
    .map(
      ({ label, value }) =>
        `**${label}**: ${discord.escapeMarkdown(discord.truncate(value, 200))}`
    )
    .join('\n')

  const rawBody = discord.trim(text || html || '')
  const escapedBody = discord.escapeMarkdown(rawBody) || '*(end of message)*'

  const files = attachments.map((attachment, index) => ({
    attachment: attachment.content,
    name: attachment.filename || `attachment ${index + 1}`,
  }))

  let content = `${title}\n\n${escapedBody}\n`
  if (content.length > discord.MAX_MESSAGE_CONTENT_LENGTH) {
    content = title
    files.unshift({ attachment: Buffer.from(rawBody), name: 'message.txt' })
  }

  const embedFields = Object.entries(config.glossary)
    .filter(([key]) =>
      // eslint-disable-next-line security/detect-non-literal-regexp
      new RegExp(`\\b${escapeStringRegexp(key)}\\b`).test(
        `${title}\n${rawBody}`
      )
    )
    .map(([key, value]) => ({ name: key, value }))

  await discord.sendMessage({
    ...config,
    message: { content, files, embedFields },
  })
}
