# imap-to-discord

AWS Lambda that retrieves emails from an IMAP mailbox and sends them to Discord.

## Requirements

- AWS account and credentials
- Permission to create the Discord webhook
- Node 14
- npm 7

## Setup

1. To make a Discord webhook, see https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks

2. Create a configuration file in S3.

   This file should contain a JSON object with the following keys:

   | Key                 | Type    | Description                                                                   |
   | ------------------- | ------- | ----------------------------------------------------------------------------- |
   | `user`              | string  | The IMAP username, usually the email address.                                 |
   | `password`          | string  | The IMAP password.                                                            |
   | `host`              | string  | The IMAP host.                                                                |
   | `tls`               | boolean | Whether to use TLS. (Optional, defaults to `true`).                           |
   | `port`              | number  | The IMAP port. (Optional, defaults to port `993` with TLS and `143` without.) |
   | `folder`            | string  | The folder from which to retrieve emails. (Optional, defaults to `"Inbox"`.)  |
   | `discordWebhookUrl` | string  | The Discord webhook URL for the channel.                                      |
   | `glossary`          | object  | `string`->`string` mapping of words to descriptions. When a word from the     |
   |                     |         | glossary is found in an email, that word and its description will be added to |
   |                     |         | the Discord message as an embed. (Optional, defaults to no glossary.)         |

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
