import { ImapFlow, MailboxObject } from 'imapflow'
import * as stream from 'node:stream'

import { Configuration } from './configuration'

export class Imap {
  static async connect(
    config: Pick<Configuration, 'host' | 'port' | 'tls' | 'user' | 'password'>
  ): Promise<Imap> {
    const { host, port, tls: secure, user, password: pass } = config
    const client = new ImapFlow({ host, port, secure, auth: { user, pass } })
    await client.connect()
    return new Imap(client)
  }

  private constructor(private readonly client: ImapFlow) {}

  public async openMailbox({
    folder,
  }: {
    folder: string
  }): Promise<ImapMailbox> {
    const mailbox = await this.client.mailboxOpen(folder, {
      // allow marking as read
      readOnly: false,
    })
    return new ImapMailbox(this.client, mailbox)
  }

  public async disconnect(): Promise<void> {
    await this.client.logout()
  }
}

export class ImapMailbox {
  public readonly uidnext: number
  public readonly uidvalidity: number

  constructor(private readonly client: ImapFlow, mailbox: MailboxObject) {
    this.uidnext = mailbox.uidNext
    this.uidvalidity = Number(mailbox.uidValidity) // 32 bits, fits within MAX_SAFE_INTEGER
  }

  public async searchFromUid(uid: number): Promise<{ uids: number[] }> {
    const uids = await this.client.search({ uid: `${uid}:*` }, { uid: true })
    return {
      uids: uids
        // Includes the UID of the latest email even if it is outside of the requested range
        // https://stackoverflow.com/questions/9147424/imap-search-for-messages-with-uid-greater-than-x-or-generally-after-my-last-s#comment29989969_9148609
        .filter((value) => value >= uid)
        .sort((a, b) => a - b),
    }
  }

  public async getEmailContent(uid: number): Promise<stream.Readable> {
    const message = await this.client.download(`${uid}`, undefined, {
      uid: true,
    })
    return message.content
  }

  public async markAsRead(uid: number): Promise<void> {
    await this.client.messageFlagsAdd(`${uid}`, ['\\Seen'], { uid: true })
  }
}
