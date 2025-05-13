import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubs from 'aws-cdk-lib/aws-sns-subscriptions';

interface ProductsServiceStackProps extends cdk.StackProps {
	vpc: ec2.Vpc;
	cluster: ecs.Cluster;
	nlb: elbv2.NetworkLoadBalancer;
	alb: elbv2.ApplicationLoadBalancer;
	repository: ecr.Repository;
}

export class ProductsServiceStack extends cdk.Stack {
	readonly productsTopic : sns.Topic;

	constructor(scope: Construct, id: string, props: ProductsServiceStackProps) {
		super(scope, id, props);

		const productsDdb = new dynamodb.Table(this, 'ProductsDdb', {
			tableName: 'products',
			partitionKey: { 
				name: 'id',
				type: dynamodb.AttributeType.STRING
			},
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			billingMode: dynamodb.BillingMode.PROVISIONED,
			readCapacity: 1,
			writeCapacity: 1,
		});

		productsDdb.addGlobalSecondaryIndex({
			indexName: 'codeIdx',
			partitionKey: {
				name: 'code',
				type: dynamodb.AttributeType.STRING
			},
			projectionType: dynamodb.ProjectionType.KEYS_ONLY, //id and code
		});

		this.productsTopic = new sns.Topic(this, 'ProductsEventsTopic', {
			topicName: 'product-topic',
			displayName: 'Products events topic',
		});

		this.productsTopic.addSubscription(
			new snsSubs.EmailSubscription('varleidecesare2222@gmail.com', {
				json: true,
			})
		);

		const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
			memoryLimitMiB: 1024,
			cpu: 512,
			family: 'products-service'
		});
		productsDdb.grantReadWriteData(taskDefinition.taskRole);
		this.productsTopic.grantPublish(taskDefinition.taskRole);

		taskDefinition.taskRole.addManagedPolicy(
			iam.ManagedPolicy.fromAwsManagedPolicyName('AwsXrayWriteOnlyAccess'));

		const logDriver = ecs.LogDriver.awsLogs({
			logGroup: new logs.LogGroup(this, 'LogGroup', {
				logGroupName: 'ProductsService',
				removalPolicy: cdk.RemovalPolicy.DESTROY,
				retention: logs.RetentionDays.ONE_DAY
			}),
			streamPrefix: 'ProductsService'
		});

		taskDefinition.addContainer('ProductsServiceContainer', {
			image: ecs.ContainerImage.fromEcrRepository(props.repository, "1.1.12"),
			containerName: 'ProductsService',
			logging: logDriver,
			portMappings: [
				{ containerPort: 8080, protocol: ecs.Protocol.TCP }
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
			}
		});

		taskDefinition.addContainer("Xray", {
			image: ecs.ContainerImage.fromRegistry("public.ecr.aws/xray/aws-xray-daemon:latest"),
			containerName: "XrayProductsService",
			logging: ecs.LogDrivers.awsLogs({
				logGroup: new logs.LogGroup(this, 'XrayLogGroup', {
					logGroupName: 'XrayProductsService',
					removalPolicy: cdk.RemovalPolicy.DESTROY,
					retention: logs.RetentionDays.ONE_DAY
				}),
				streamPrefix: 'XrayProductsService'
			}),
			essential: true,
			cpu: 128,
			memoryLimitMiB: 256,
			portMappings: [
				{ containerPort: 2000, protocol: ecs.Protocol.UDP }
			],
		})

		const albListener = props.alb.addListener('ProductsServiceAlbListener', {
			port: 8080,
			protocol: elbv2.ApplicationProtocol.HTTP,
			open: true,
		});

		const service = new ecs.FargateService(this,"ProductsService", {
			serviceName: "ProductsService",
			cluster: props.cluster,
			taskDefinition,
			desiredCount: 2,
			minHealthyPercent: 50,
		});

		props.repository.grantPull(taskDefinition.taskRole);
		service.connections.securityGroups[0].addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(8080));


		//send the requests to the service
		albListener.addTargets('ProductsServiceAlbTarget', {
			targetGroupName: 'ProductsServiceAlb',
			port: 8080,
			targets: [service],
			protocol: elbv2.ApplicationProtocol.HTTP,
			deregistrationDelay: cdk.Duration.seconds(30),
			healthCheck: {
				interval: cdk.Duration.seconds(30),
				enabled: true,
				port: '8080',
				timeout: cdk.Duration.seconds(10),
				path: '/health',
			},
			
		});

		const nlbListener = props.nlb.addListener('ProductsServiceNlbListener', {
			port: 8080,
			protocol: elbv2.Protocol.TCP,
		});

		//send the requests to the alb
		nlbListener.addTargets('ProductsServiceNlbTarget', {
			port: 8080,
			targetGroupName: 'ProductsServiceNlb',
			protocol: elbv2.Protocol.TCP,
			targets: [
				service.loadBalancerTarget({
					containerName: 'ProductsService',
					containerPort: 8080,
					protocol: ecs.Protocol.TCP
				})
			],
		});
	}

}