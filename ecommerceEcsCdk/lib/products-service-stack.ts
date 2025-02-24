import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface ProductsServiceStackProps extends cdk.StackProps {
	vpc: ec2.Vpc;
	cluster: ecs.Cluster;
	nlb: elbv2.NetworkLoadBalancer;
	alb: elbv2.ApplicationLoadBalancer;
	repository: ecr.Repository;
}

export class ProductsServiceStack extends cdk.Stack {

	constructor(scope: Construct, id: string, props: ProductsServiceStackProps) {
		super(scope, id, props);

		const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
			memoryLimitMiB: 1024,
			cpu: 512,
			family: 'products-service'
		});

		const logDriver = ecs.LogDriver.awsLogs({
			logGroup: new logs.LogGroup(this, 'LogGroup', {
				logGroupName: 'ProductsService',
				removalPolicy: cdk.RemovalPolicy.DESTROY,
				retention: logs.RetentionDays.ONE_DAY
			}),
			streamPrefix: 'ProductsService'
		});

		taskDefinition.addContainer('ProductsServiceContainer', {
			image: ecs.ContainerImage.fromEcrRepository(props.repository, "1.0.0"),
			containerName: 'ProductsService',
			logging: logDriver,
			portMappings: [
				{ containerPort: 8080, protocol: ecs.Protocol.TCP }
			],
		});

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
			}
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