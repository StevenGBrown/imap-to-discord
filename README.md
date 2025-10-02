# imap-to-discord

AWS Lambda that retrieves emails from an IMAP mailbox and sends them to Discord.

## Requirements

- AWS account and credentials
- Permission to create the Discord webhook
- Node 22
- npm 7

## Setup

1. Create a Discord webhook for the channel that will receive the emails.  
   https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks

2. Create a configuration file in S3.

   This file should contain a JSON object with the following keys:

   - `user` (string)  
     The IMAP username, usually the email address.

   - `password` (string)  
     The IMAP password.

   - `host` (string)  
     The IMAP host.

   - `tls` (boolean, optional)  
     Whether to use TLS. Defaults to `true`.

   - `port` (number, optional)  
     The IMAP port. Defaults to port `993` with TLS and `143` without.

   - `folder` (string, optional)  
     The folder from which to retrieve emails. Defaults to `"Inbox"`.

   - `discordWebhookUrl` (string)  
     The Discord webhook URL for the channel.

   - `allowList` (string array, optional)  
     If provided, emails will only be sent to Discord when the from address matches an entry in this array, and it is NOT blocked by a more specific entry in the `denyList`. This check is case insensitive. The array can contain email addresses (e.g. `"name@example.com"`) or domains (e.g. `"example.com"`). Domains will also match anything sent from a subdomain. Defaults to allowing all emails.

   - `denyList` (string array, optional)  
     Block emails from being sent to Discord when the from address matches an entry in this array, and it is NOT allowed by a more specific entry in the `allowList`. This check is case insensitive. The array can contain email addresses (e.g. `"name@example.com"`) or domains (e.g. `"example.com"`). Domains will also match anything sent from a subdomain. Defaults to allowing all emails.

   - `glossary` (object with string keys and values, optional)  
     A mapping of words to descriptions. When a word from the glossary is found in an email, that word and its description will be added to the Discord message as an embed. Defaults to no glossary.

3. Set the `CONFIG_FILE` environment variable to the ARN of this configuration file in S3.

4. Configure your AWS credentials and region.  
   https://docs.aws.amazon.com/cdk/latest/guide/cli.html#cli-environment

## How to run locally

```
npm install
npm start
```

## How to deploy to AWS

```
npm install
npm run bootstrap
npm run deploy
```

## Commands

- `npm run bootstrap`  
  Bootstrap the AWS CDK in your default AWS account/region.  
  https://docs.aws.amazon.com/cdk/latest/guide/cli.html#cli-bootstrap

- `npm run deploy`  
  Deploy the app to your default AWS account/region.

- `npm run cdk -- COMMAND ARGUMENTS...`  
  Run an AWS CDK Toolkit command.  
  See: https://docs.aws.amazon.com/cdk/latest/guide/cli.html

- `npm run lint`  
  Run type-checking and the linter over the code.

- `npm run start`  
  Run the code locally for testing purposes.
