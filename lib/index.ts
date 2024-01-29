import {
  Duration,
  Fn,
  Token,
  aws_dynamodb,
  aws_events,
  aws_events_targets,
  aws_lambda,
  aws_lambda_nodejs,
  aws_logs,
  aws_iam,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

/**
 * @summary The properties for the ImapToDiscord class.
 */
export interface ImapToDiscordProps {
  /**
   * Location of the config file in S3.
   *
   * Must be an S3 ARN, e.g. arn:aws:s3:::my-bucket/configuration.json
   */
  readonly configFile: string

  /**
   * User provided properties to override the default properties for the Lambda function.
   *
   * @default - Default properties are used.
   */
  readonly lambdaFunctionProps?: aws_lambda_nodejs.NodejsFunctionProps

  /**
   * User provided properties to override the default properties for the DynamoDB table.
   *
   * @default - Default properties are used.
   */
  readonly tableProps?: aws_dynamodb.TableProps

  /**
   * Specify how often to run the lambda.
   *
   * @default - Every 10 minutes.
   */
  readonly lambdaSchedule?: aws_events.Schedule
}

/**
 * @summary The ImapToDiscord class.
 */
export class ImapToDiscord extends Construct {
  public readonly lambdaFunction: aws_lambda_nodejs.NodejsFunction
  public readonly table: aws_dynamodb.Table

  constructor(scope: Construct, id: string, props: ImapToDiscordProps) {
    super(scope, id)

    // Validation
    if (!props.configFile) {
      throw new Error(`The configFile prop is required`)
    }
    if (
      !Token.isUnresolved(props.configFile) &&
      !props.configFile.startsWith('arn:aws:s3:::')
    ) {
      throw new Error(
        `The configFile prop must be an S3 ARN, but was "${props.configFile}"`
      )
    }

    // DynamoDB table for use by the lambda function
    this.table = new aws_dynamodb.Table(this, 'table', {
      partitionKey: { name: 'Id', type: aws_dynamodb.AttributeType.STRING },
      billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      ...props.tableProps,
    })

    // Lambda function bundled using esbuild
    const { functionName } = {
      functionName: 'imap-to-discord',
      ...props.lambdaFunctionProps,
    }
    this.lambdaFunction = new aws_lambda_nodejs.NodejsFunction(this, 'lambda', {
      functionName,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      environment: {
        CONFIG_FILE: props.configFile,
        DYNAMODB_TABLE_NAME: this.table.tableName,
        NODE_OPTIONS: '--enable-source-maps',
        ...props.lambdaFunctionProps?.environment,
      },
      logGroup: new aws_logs.LogGroup(this, 'lambda-logGroup', {
        logGroupName: functionName ? `/aws/lambda/${functionName}` : undefined,
        retention: aws_logs.RetentionDays.ONE_MONTH,
      }),
      memorySize: 512,
      timeout: Duration.minutes(5),
      reservedConcurrentExecutions: 1,
      bundling: {
        sourceMap: true,
        target: 'es2021',
        // Dependencies to exclude from the build
        externalModules: [
          '@aws-sdk/', // already available in the lambda runtime
          'ffmpeg-static', // dependency of discord.js that isn't used at runtime
        ],
        ...props.lambdaFunctionProps?.bundling,
      },
      ...props.lambdaFunctionProps,
    })

    // Read/write access to the DynamoDB table
    this.lambdaFunction.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
        resources: [this.table.tableArn],
      })
    )

    // Read-only access to the config file in S3
    this.lambdaFunction.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [
          // S3 object keys can contain any UTF-8 character, including IAM special characters
          this.convertArnToIamResource(props.configFile),
        ],
      })
    )

    // Cloudwatch rule to trigger the lambda periodically
    new aws_events.Rule(this, 'rule', {
      schedule:
        props.lambdaSchedule ?? aws_events.Schedule.rate(Duration.hours(1)),
      targets: [new aws_events_targets.LambdaFunction(this.lambdaFunction)],
      description: `Trigger lambda ${this.lambdaFunction.functionName}`,
    })
  }

  // Convert an ARN to an IAM resource value by escaping special characters such as wildcards
  // https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_variables.html#policy-vars-specialchars
  private convertArnToIamResource(arn: string): string {
    if (
      !Token.isUnresolved(arn) &&
      IAM_SPECIAL_CHARACTERS.every((c) => !arn.includes(c))
    ) {
      return arn // No special characters
    }
    let resource = Token.asString(Token.asAny(arn)) // Fn.split requires a token
    for (const specialCharacter of IAM_SPECIAL_CHARACTERS) {
      // Escape all occurrences of the special character (find and replace)
      resource = Fn.join(
        '${' + specialCharacter + '}',
        Fn.split(specialCharacter, resource)
      )
    }
    return resource
  }
}

const IAM_SPECIAL_CHARACTERS = ['$', '*', '?'] as const
