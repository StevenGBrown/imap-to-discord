import * as mailparser from 'mailparser'

import { Configuration } from './configuration'

export function satisfiesFilter({
  parsedEmail,
  config,
  uid,
}: {
  parsedEmail: mailparser.ParsedMail
  config: Configuration
  uid: number
}): boolean {
  const from = (parsedEmail.from?.value ?? [])[0].address ?? ''
  const allowListMatch = getMostSpecificMatch({ from, list: config.allowList })
  if (config.allowList.length && !allowListMatch) {
    console.log(
      `Skipping email from ${from}. Not found in the allow list. (UID: ${uid})`
    )
    return false
  }
  const denyListMatch = getMostSpecificMatch({ from, list: config.denyList })
  if (denyListMatch.length > allowListMatch.length) {
    console.log(
      [
        `Skipping email from ${from}.`,
        from === denyListMatch
          ? 'Found in the deny list.'
          : `Matches ${denyListMatch} in the deny list.`,
        `(UID: ${uid})`,
      ].join(' ')
    )
    return false
  }
  return true
}

function getMostSpecificMatch({
  from,
  list,
}: {
  from: string
  list: string[]
}): string {
  const match = list
    .sort((a, b) => b.length - a.length) // longest (most specific) first
    .find((listEntry) => doesMatchListEntry({ from, listEntry }))
  return match ?? ''
}

function doesMatchListEntry({
  from,
  listEntry,
}: {
  from: string
  listEntry: string
}): boolean {
  if (listEntry.includes('@')) {
    // The list entry is an email address
    return from.toLowerCase() === listEntry.toLowerCase()
  }
  // Otherwise the list entry is a domain
  const fromDomain = getDomain(from).toLowerCase()
  const listEntryDomain = listEntry.toLowerCase()
  return (
    fromDomain === listEntryDomain || fromDomain.endsWith(`.${listEntryDomain}`)
  )
}

function getDomain(emailAddress: string): string {
  return emailAddress.split('@').pop() ?? ''
}
