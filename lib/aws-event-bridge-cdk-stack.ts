import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaEventSource from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as targets from 'aws-cdk-lib/aws-events-targets'

export class AwsEventBridgeCdkStack extends cdk.Stack {
  dlq: sqs.Queue;
  api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    this.dlq = new sqs.Queue(this, 'AwsEventBridgeDLQueue');

    this.api = this.setupApiGatway();
    
    const webhookManager = this.setupWebhookManager();

    this.addApiGatewayResource(this.api, 'webhook', 'POST', webhookManager);

    this.setupSallaInvocation();
  }

  setupApiGatway() {
    const api  = new apigateway.RestApi(this, 'AwsEventBridgeRestApi');
    const plan = api.addUsagePlan('UsagePlan', {
      name: 'AwsEventBridgeUsagePlan',
      throttle: {
        rateLimit: 10,
        burstLimit: 2
      }
    });
    const key = api.addApiKey('ApiKey');
    plan.addApiKey(key);
    plan.addApiStage({
      stage: api.deploymentStage
    })
    return api;
  }

  addApiGatewayResource(api: cdk.aws_apigateway.RestApi, root: string, method: string, lambda: cdk.aws_lambda.Function) {
    const rootRoute = api.root.addResource(root);
    rootRoute.addMethod(method, new apigateway.LambdaIntegration(lambda), {
      apiKeyRequired: true
    });
  }

  setupWebhookManager() {
    const webhookManager = new lambda.Function(this, 'WebhookManagerHandler', {
      runtime: lambda.Runtime.NODEJS_16_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'webhook-manager.handler',
      events: [
        new lambdaEventSource.ApiEventSource('POST', '/webhook', {
          authorizationType: apigateway.AuthorizationType.NONE
        })
      ]      
    });

    const lambdaEventBridgePolicy = new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: ['*'],
      effect: iam.Effect.ALLOW
    });

    webhookManager.role?.attachInlinePolicy(new iam.Policy(this, 'AwsEventBridgePutEvents', {
      statements: [lambdaEventBridgePolicy]
    }));

    return webhookManager;
  }

  setupSallaInvocation() {
    const appInvocation = new lambda.Function(this, 'WebhookSallaHandler', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'webhook-salla.handler',
      code: lambda.Code.fromAsset('lambda')
    });

    const sallaRule = new events.Rule(this, 'sallaRule', {
      eventPattern: {
        source: ['salla']
      },
    });

    sallaRule.addTarget(new targets.LambdaFunction(appInvocation, {
      deadLetterQueue: this.dlq, // Optional: add a dead letter queue
      maxEventAge: cdk.Duration.hours(2), // Optional: set the maxEventAge retry policy
      retryAttempts: 2, // Optional: set the max number of retry attempts
    }));

    return appInvocation;
  }

  setupDLQueue() {
    return new sqs.Queue(this, 'Queue');
  }
}
