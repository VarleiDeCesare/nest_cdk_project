import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
export class EcrStack extends cdk.Stack {
	readonly productServiceRepository: ecr.Repository;
	constructor(scope: Construct, id: string, props: cdk.StackProps) {
		super(scope, id, props);

		this.productServiceRepository = new ecr.Repository(this, 'ProductsService', {
			repositoryName: 'products-service',
			imageTagMutability: ecr.TagMutability.IMMUTABLE, // we need to deploy always a different image tag, can't override the uploaded image on ECR
			emptyOnDelete: true,
			removalPolicy: cdk.RemovalPolicy.DESTROY, //if the stack is deleted, the repository will be deleted
		});
	}
}