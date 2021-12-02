import * as dynamodb from '@aws-cdk/aws-dynamodb'
import * as events from '@aws-cdk/aws-events'
import * as targets from '@aws-cdk/aws-events-targets'
import * as lambda from '@aws-cdk/aws-lambda'
import * as lambdaNodejs from '@aws-cdk/aws-lambda-nodejs'
import * as logs from '@aws-cdk/aws-logs'
import * as iam from '@aws-cdk/aws-iam'
import * as cdk from '@aws-cdk/core'

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
  readonly lambdaFunctionProps?: lambdaNodejs.NodejsFunctionProps

  /**
   * User provided properties to override the default properties for the DynamoDB table.
   *
   * @default - Default properties are used.
   */
  readonly tableProps?: dynamodb.TableProps

  /**
   * Specify how often to run the lambda.
   *
   * @default - Every 10 minutes.
   */
  readonly lambdaSchedule?: events.Schedule
}

/**
 * @summary The ImapToDiscord class.
 */
export class ImapToDiscord extends cdk.Construct {
  public readonly lambdaFunction: lambdaNodejs.NodejsFunction
  public readonly table: dynamodb.Table

  constructor(scope: cdk.Construct, id: string, props: ImapToDiscordProps) {
    super(scope, id)

    // Validation
    if (!props.configFile) {
      throw new Error(`The configFile prop is required`)
    }
    if (
      !cdk.Token.isUnresolved(props.configFile) &&
      !props.configFile.startsWith('arn:aws:s3:::')
    ) {
      throw new Error(
        `The configFile prop must be an S3 ARN, but was "${props.configFile}"`
      )
    }

    // DynamoDB table for use by the lambda function
    this.table = new dynamodb.Table(this, 'table', {
      partitionKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      ...props.tableProps,
    })

    // Lambda function bundled using esbuild
    this.lambdaFunction = new lambdaNodejs.NodejsFunction(this, 'lambda', {
      runtime: lambda.Runtime.NODEJS_14_X,
      environment: {
        CONFIG_FILE: props.configFile,
        DYNAMODB_TABLE_NAME: this.table.tableName,
        NODE_OPTIONS: '--enable-source-maps',
        ...props.lambdaFunctionProps?.environment,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      memorySize: 512,
      timeout: cdk.Duration.minutes(5),
      reservedConcurrentExecutions: 1,
      bundling: {
        sourceMap: true,
        target: 'es2020',
        // Dependencies to exclude from the build
        externalModules: [
          'aws-sdk', // already available in the lambda runtime
          'ffmpeg-static', // dependency of discord.js that isn't used at runtime
        ],
        ...props.lambdaFunctionProps?.bundling,
      },
      ...props.lambdaFunctionProps,
    })

    // Read/write access to the DynamoDB table
    this.lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
        resources: [this.table.tableArn],
      })
    )

    // Read-only access to the config file in S3
    this.lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [
          // S3 object keys can contain any UTF-8 character, including IAM special characters
          this.convertArnToIamResource(props.configFile),
        ],
      })
    )

    // Cloudwatch rule to trigger the lambda periodically
    new events.Rule(this, 'rule', {
      schedule:
        props.lambdaSchedule ?? events.Schedule.rate(cdk.Duration.minutes(10)),
      targets: [new targets.LambdaFunction(this.lambdaFunction)],
      description: `Trigger lambda ${this.lambdaFunction.functionName}`,
    })
  }

  // Convert an ARN to an IAM resource value by escaping special characters such as wildcards
  // https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_variables.html#policy-vars-specialchars
  private convertArnToIamResource(arn: string): string {
    if (
      !cdk.Token.isUnresolved(arn) &&
      IAM_SPECIAL_CHARACTERS.every((c) => !arn.includes(c))
    ) {
      return arn // No special characters
    }
    let resource = cdk.Token.asString(cdk.Token.asAny(arn)) // cdk.Fn.split requires a token
    for (const specialCharacter of IAM_SPECIAL_CHARACTERS) {
      // Escape all occurrences of the special character (find and replace)
      resource = cdk.Fn.join(
        '${' + specialCharacter + '}',
        cdk.Fn.split(specialCharacter, resource)
      )
    }
    return resource
  }
}

const IAM_SPECIAL_CHARACTERS = ['$', '*', '?'] as const
