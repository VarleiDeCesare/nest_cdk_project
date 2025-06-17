import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as logs from "aws-cdk-lib/aws-logs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snssubs from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

interface AuditServiceStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  cluster: ecs.Cluster;
  nlb: elbv2.NetworkLoadBalancer;
  alb: elbv2.ApplicationLoadBalancer;
  repository: ecr.Repository;
  productsTopic: sns.Topic;
}

export class AuditServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AuditServiceStackProps) {
    super(scope, id, props);

    const eventsDdb = new dynamodb.Table(this, "EventsDdb", {
      tableName: "events",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: "pk",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: dynamodb.AttributeType.STRING,
      },
      timeToLiveAttribute: "ttl",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const productEventsDlq = new sqs.Queue(this, "ProductEventsDlq", {
      queueName: "product-events-dlq",
      retentionPeriod: cdk.Duration.days(10),
      enforceSSL: false,
      encryption: sqs.QueueEncryption.UNENCRYPTED,
    });

    const productEventsQueue = new sqs.Queue(this, "ProductEventsQueue", {
      queueName: "product-events",
      enforceSSL: false,
      encryption: sqs.QueueEncryption.UNENCRYPTED,
      deadLetterQueue: {
        queue: productEventsDlq,
        maxReceiveCount: 3,
      },
    });

    props.productsTopic.addSubscription(
      new snssubs.SqsSubscription(productEventsQueue, {
        filterPolicy: {
          eventType: sns.SubscriptionFilter.stringFilter({
            allowlist: [
              "PRODUCT_CREATED",
              "PRODUCT_UPDATED",
              "PRODUCT_DELETED",
            ],
          }),
        },
      })
    );

    const productFailureEventsQueue = new sqs.Queue(
      this,
      "ProductFailureEventsQueue",
      {
        queueName: "product-failure-events",
        deadLetterQueue: {
          queue: productEventsDlq,
          maxReceiveCount: 3,
        },
        enforceSSL: false,
        encryption: sqs.QueueEncryption.UNENCRYPTED,
      }
    );
    props.productsTopic.addSubscription(
      new snssubs.SqsSubscription(productFailureEventsQueue, {
        filterPolicy: {
          eventType: sns.SubscriptionFilter.stringFilter({
            allowlist: ["PRODUCT_FAILURE"],
          }),
        },
      })
    );

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDefinition",
      {
        cpu: 512,
        memoryLimitMiB: 1024,
        family: "audit-service",
      }
    );
    taskDefinition.taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXrayWriteOnlyAccess")
    );
    productEventsQueue.grantConsumeMessages(taskDefinition.taskRole);
    productFailureEventsQueue.grantConsumeMessages(taskDefinition.taskRole);
    eventsDdb.grantReadWriteData(taskDefinition.taskRole);

    const logDriver = ecs.LogDriver.awsLogs({
      logGroup: new logs.LogGroup(this, "LogGroup", {
        logGroupName: "AuditService",
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      streamPrefix: "AuditService",
    });

    taskDefinition.addContainer("AuditServiceContainer", {
      image: ecs.ContainerImage.fromEcrRepository(props.repository, "1.0.4"),
      containerName: "auditService",
      logging: logDriver,
      portMappings: [
        {
          containerPort: 8090,
          protocol: ecs.Protocol.TCP,
        },
      ],
      cpu: 384,
      memoryLimitMiB: 896,
      environment: {
        AWS_XRAY_TRACING_NAME: "audit-service",
        AWS_XRAY_DAEMON_ADDRESS: "0.0.0.0:2000",
        AWS_XRAY_CONTEXT_MISSING: "IGNORE_ERROR",
        LOGGER_LEVEL: "INFO",
        AWS_SQS_QUEUE_PRODUCT_EVENTS_URL: productEventsQueue.queueUrl,
        AWS_SQS_QUEUE_PRODUCT_FAILURE_EVENTS_URL:
          productFailureEventsQueue.queueUrl,
        EVENTS_DDB: eventsDdb.tableName,
      },
    });

    taskDefinition.addContainer("xray", {
      image: ecs.ContainerImage.fromRegistry(
        "public.ecr.aws/xray/aws-xray-daemon:latest"
      ),
      containerName: "XRayAuditService",
      logging: ecs.LogDriver.awsLogs({
        logGroup: new logs.LogGroup(this, "XRayLogGroup", {
          logGroupName: "XRayAuditService",
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          retention: logs.RetentionDays.ONE_MONTH,
        }),
        streamPrefix: "XRayAuditService",
      }),
      cpu: 128,
      memoryLimitMiB: 128,
      portMappings: [
        {
          containerPort: 2000,
          protocol: ecs.Protocol.UDP,
        },
      ],
    });

    const albListener = props.alb.addListener("AuditServiceAlbListener", {
      port: 8090,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: true,
    });

    const service = new ecs.FargateService(this, "AuditService", {
      serviceName: "AuditService",
      cluster: props.cluster,
      taskDefinition: taskDefinition,
      desiredCount: 2,
      //NUNCA FAÇA ISSO EM AMBIENTE DE PRODUÇÃO!!!
      //assignPublicIp: true
    });
    props.repository.grantPull(taskDefinition.taskRole);

    service.connections.securityGroups[0].addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(8090)
    );

    albListener.addTargets("AuditServiceAlbTarget", {
      targetGroupName: "auditServiceAlb",
      port: 8090,
      targets: [service],
      protocol: elbv2.ApplicationProtocol.HTTP,
      deregistrationDelay: cdk.Duration.seconds(30),
      healthCheck: {
        interval: cdk.Duration.seconds(30),
        enabled: true,
        port: "8090",
        timeout: cdk.Duration.seconds(10),
        path: "/health",
      },
    });

    const nlbListener = props.nlb.addListener("AuditServiceNlbListener", {
      port: 8090,
      protocol: elbv2.Protocol.TCP,
    });

    nlbListener.addTargets("AuditServiceNlbTarget", {
      port: 8090,
      targetGroupName: "auditServiceNlb",
      protocol: elbv2.Protocol.TCP,
      targets: [
        service.loadBalancerTarget({
          containerName: "auditService",
          containerPort: 8090,
          protocol: ecs.Protocol.TCP,
        }),
      ],
    });

    const scalableTaskCount = service.autoScaleTaskCount({
      maxCapacity: 4,
      minCapacity: 2,
    });

    scalableTaskCount.scaleOnCpuUtilization("AuditServiceAutoScaling", {
      targetUtilizationPercent: 10,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
  }
}
