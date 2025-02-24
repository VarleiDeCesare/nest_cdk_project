import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as elnv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

interface LoadBalancerStackProps extends cdk.StackProps {
	vpc: ec2.Vpc;
}
export class LoadBalancerStack extends cdk.Stack {
	readonly nlb: elnv2.NetworkLoadBalancer;
	readonly alb: elnv2.ApplicationLoadBalancer;
	constructor(scope: Construct, id: string, props: LoadBalancerStackProps) {
		super(scope, id, props);

		this.nlb = new elnv2.NetworkLoadBalancer(this, 'Nlb', {
			internetFacing: false, // Set to true if you want to expose the NLB to the internet/ there's no DNS
			loadBalancerName: 'EcommerceNlb',
			vpc: props.vpc,
		});

		this.alb = new elnv2.ApplicationLoadBalancer(this, 'Alb', {
			vpc: props.vpc,
			internetFacing: false, // Set to true if you want to expose the ALB to the internet/ there's no DNS
			loadBalancerName: 'EcommerceAlb',
		});
		
	}
}