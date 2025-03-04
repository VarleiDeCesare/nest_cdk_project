import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
export class VPCStack extends cdk.Stack {
	readonly vpc: ec2.Vpc;
	constructor(scope: Construct, id: string, props: cdk.StackProps) {
		super(scope, id, props);

		this.vpc = new ec2.Vpc(this, 'EcommerceVPC', {
			vpcName: 'EcommerceVPC',
			maxAzs: 2,
		});
		
	}

}