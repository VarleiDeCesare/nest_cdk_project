import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as logs from "aws-cdk-lib/aws-logs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

interface ProductsServiceStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  cluster: ecs.Cluster;
  nlb: elbv2.NetworkLoadBalancer;
  alb: elbv2.ApplicationLoadBalancer;
  repository: ecr.Repository;
}

export class ProductsServiceStack extends cdk.Stack {
  readonly productsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: ProductsServiceStackProps) {
    super(scope, id, props);

    const productsDdb = new dynamodb.Table(this, "ProductsDdb", {
      tableName: "products",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // auto scalling just enable when the billing mode is PROVISIONED

    // const readScale = productsDdb.autoScaleReadCapacity({
    //   maxCapacity: 4,
    //   minCapacity: 1,
    // });
    // readScale.scaleOnUtilization({
    //   targetUtilizationPercent: 10,
    //   scaleInCooldown: cdk.Duration.seconds(60),
    //   scaleOutCooldown: cdk.Duration.seconds(60),
    // });

    // const writeScale = productsDdb.autoScaleWriteCapacity({
    //   maxCapacity: 4,
    //   minCapacity: 1,
    // });
    // writeScale.scaleOnUtilization({
    //   targetUtilizationPercent: 10,
    //   scaleInCooldown: cdk.Duration.seconds(60),
    //   scaleOutCooldown: cdk.Duration.seconds(60),
    // });

    productsDdb.addGlobalSecondaryIndex({
      indexName: "codeIdx",
      partitionKey: {
        name: "code",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    //auto scalling just enable when the billing mode is PROVISIONED

    // const readScaleGsi = productsDdb.autoScaleGlobalSecondaryIndexReadCapacity(
    //   "codeIdx",
    //   {
    //     maxCapacity: 4,
    //     minCapacity: 1,
    //   }
    // );
    // readScaleGsi.scaleOnUtilization({
    //   targetUtilizationPercent: 10,
    //   scaleInCooldown: cdk.Duration.seconds(60),
    //   scaleOutCooldown: cdk.Duration.seconds(60),
    // });

    // const writeScaleGsi =
    //   productsDdb.autoScaleGlobalSecondaryIndexWriteCapacity("codeIdx", {
    //     maxCapacity: 4,
    //     minCapacity: 1,
    //   });
    // writeScaleGsi.scaleOnUtilization({
    //   targetUtilizationPercent: 10,
    //   scaleInCooldown: cdk.Duration.seconds(60),
    //   scaleOutCooldown: cdk.Duration.seconds(60),
    // });

    this.productsTopic = new sns.Topic(this, "ProductsEventsTopic", {
      displayName: "Product events topic",
      topicName: "product-event",
    });

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDefinition",
      {
        cpu: 512,
        memoryLimitMiB: 1024,
        family: "products-service",
      }
    );
    productsDdb.grantReadWriteData(taskDefinition.taskRole);
    this.productsTopic.grantPublish(taskDefinition.taskRole);

    taskDefinition.taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXrayWriteOnlyAccess")
    );

    const logDriver = ecs.LogDriver.awsLogs({
      logGroup: new logs.LogGroup(this, "LogGroup", {
        logGroupName: "ProductsService",
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      streamPrefix: "ProductsService",
    });

    taskDefinition.addContainer("ProductsServiceContainer", {
      image: ecs.ContainerImage.fromEcrRepository(props.repository, "1.0.10"),
      containerName: "productsService",
      logging: logDriver,
      portMappings: [
        {
          containerPort: 8080,
          protocol: ecs.Protocol.TCP,
        },
      ],
      cpu: 384,
      memoryLimitMiB: 896,
      environment: {
        PRODUCTS_DDB: productsDdb.tableName,
        AWS_XRAY_TRACING_NAME: "products-service",
        AWS_XRAY_DAEMON_ADDRESS: "0.0.0.0:2000",
        AWS_XRAY_CONTEXT_MISSING: "IGNORE_ERROR",
        LOGGER_LEVEL: "INFO",
        AWS_SNS_TOPIC_PRODUCT_EVENTS_ARN: this.productsTopic.topicArn,
      },
    });

    taskDefinition.addContainer("xray", {
      image: ecs.ContainerImage.fromRegistry(
        "public.ecr.aws/xray/aws-xray-daemon:latest"
      ),
      containerName: "XRayProductsService",
      logging: ecs.LogDriver.awsLogs({
        logGroup: new logs.LogGroup(this, "XRayLogGroup", {
          logGroupName: "XRayProductsService",
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          retention: logs.RetentionDays.ONE_MONTH,
        }),
        streamPrefix: "XRayProductsService",
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

    const albListener = props.alb.addListener("ProductsServiceAlbListener", {
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: true,
    });

    const service = new ecs.FargateService(this, "ProductService", {
      serviceName: "ProductsService",
      cluster: props.cluster,
      taskDefinition: taskDefinition,
      desiredCount: 2,
      //NUNCA FAÇA ISSO EM AMBIENTE DE PRODUÇÃO!!!
      //assignPublicIp: true
    });
    props.repository.grantPull(taskDefinition.taskRole);

    service.connections.securityGroups[0].addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(8080)
    );

    albListener.addTargets("ProductsServiceAlbTarget", {
      targetGroupName: "productsServiceAlb",
      port: 8080,
      targets: [service],
      protocol: elbv2.ApplicationProtocol.HTTP,
      deregistrationDelay: cdk.Duration.seconds(30),
      healthCheck: {
        interval: cdk.Duration.seconds(30),
        enabled: true,
        port: "8080",
        timeout: cdk.Duration.seconds(10),
        path: "/health",
      },
    });

    const nlbListener = props.nlb.addListener("ProductsServiceNlbListener", {
      port: 8080,
      protocol: elbv2.Protocol.TCP,
    });

    nlbListener.addTargets("ProductsServiceNlbTarget", {
      port: 8080,
      targetGroupName: "productsServiceNlb",
      protocol: elbv2.Protocol.TCP,
      targets: [
        service.loadBalancerTarget({
          containerName: "productsService",
          containerPort: 8080,
          protocol: ecs.Protocol.TCP,
        }),
      ],
    });

    const scalableTaskCount = service.autoScaleTaskCount({
      maxCapacity: 4,
      minCapacity: 2,
    });

    scalableTaskCount.scaleOnCpuUtilization("ProductsServiceAutoScaling", {
      targetUtilizationPercent: 10,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
  }
}
