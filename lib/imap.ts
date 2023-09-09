import Connection from 'node-imap'
import * as stream from 'node:stream'

export class Imap {
  static async connect(config: Connection.Config): Promise<Imap> {
    const connection = new Connection({ authTimeout: 60000, ...config })
    await new Promise<void>((resolve) => {
      connection.once('ready', resolve)
      connection.connect()
    })
    return new Imap(connection)
  }

  private constructor(private readonly connection: Connection) {}

  public async openMailbox({
    folder,
  }: {
    folder: string
  }): Promise<ImapMailbox> {
    const openReadOnly = false // allow marking as read
    return await new Promise((resolve, reject) =>
      this.connection.openBox(folder, openReadOnly, (err, box) => {
        if (!box.persistentUIDs) {
          // This means that the UIDs change every time the mailbox is opened,
          // so we can't tell which emails have already been sent to Discord.
          err =
            err ??
            new Error(
              'This mailbox is not supported because it does not use persistent UIDs.'
            )
        }

        if (err) {
          reject(err)
        } else {
          resolve(new ImapMailbox(this.connection, box))
        }
      })
    )
  }

  public async disconnect(): Promise<void> {
    await new Promise((resolve) => {
      this.connection.once('close', resolve)
      this.connection.end()
    })
  }
}

export class ImapMailbox {
  public readonly uidnext: number
  public readonly uidvalidity: number

  constructor(private readonly connection: Connection, box: Connection.Box) {
    this.uidnext = box.uidnext
    this.uidvalidity = box.uidvalidity
  }

  public async searchFromUid(uid: number): Promise<{ uids: number[] }> {
    const searchCriteria = [['UID', `${uid}:*`]]
    return await new Promise((resolve, reject) =>
      this.connection.search(searchCriteria, (error, uids) =>
        error
          ? reject(error)
          : resolve({
              // Always includes the UID of the latest email even if it is outside of the requested range
              // https://stackoverflow.com/questions/9147424/imap-search-for-messages-with-uid-greater-than-x-or-generally-after-my-last-s#comment29989969_9148609
              uids: uids.filter((value) => value >= uid).sort((a, b) => a - b),
            })
      )
    )
  }

  public async getEmailContent(uid: number): Promise<stream.Readable | null> {
    const imapFetch = fixType(this.connection.fetch(uid, { bodies: '' }))
    return await new Promise((resolve, reject) => {
      imapFetch.once('message', (message) => {
        fixType(message).once('body', (content) => {
          resolve(new stream.Readable().wrap(content))
        })
      })
      imapFetch.once('error', (error) => reject(error))
      imapFetch.once('end', () => {
        resolve(null)
      })
    })
  }

  public async markAsRead(uid: number): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.connection.addFlags(uid, 'Seen', (error) =>
        error ? reject(error) : resolve()
      )
    )
  }
}

/**
 * Use the `on` function types for the `once` function too.
 */
function fixType<EventEmitter extends NodeJS.EventEmitter>(
  eventEmitter: EventEmitter
): EventEmitter & { once: EventEmitter['on'] } {
  return eventEmitter
}
