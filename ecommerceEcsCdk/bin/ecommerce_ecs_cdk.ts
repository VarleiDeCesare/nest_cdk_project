#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EcrStack } from '../lib/ecr-stack';
import { VPCStack } from '../lib/vpc-stack';
import { ClusterStack } from '../lib/cluster-stack';
import { LoadBalancerStack } from '../lib/lb-stack';
import { ProductsServiceStack } from '../lib/products-service-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: '499604939475',
  region: 'us-east-1'
};

const tags = {
  cost: 'ecommerceInfra',
  team: "varlei-team"
};

const ecrStack = new EcrStack(app, 'Ecr', {
  env,
  tags,
});

const vpcStack = new VPCStack(app, 'Vpc', {
  env,
  tags,
});

const lbStack = new LoadBalancerStack(app, 'LoadBalancer', {
  env,
  tags,
  vpc: vpcStack.vpc,
});
lbStack.addDependency(vpcStack);

const clusterStack = new ClusterStack(app, 'Cluster', {
  env,
  tags,
  vpc: vpcStack.vpc,
});

clusterStack.addDependency(vpcStack);


const tagsProductsService = {
  cost: 'ProductsService',
  team: "varlei-team",
}

const productsServiceStack = new ProductsServiceStack(app, 'ProductsService', {
  tags: tagsProductsService,
  env,
  alb: lbStack.alb,
  nlb: lbStack.nlb,
  cluster: clusterStack.cluster,
  vpc: vpcStack.vpc,
  repository: ecrStack.productServiceRepository,
});
productsServiceStack.addDependency(lbStack);
productsServiceStack.addDependency(clusterStack);
productsServiceStack.addDependency(vpcStack);
productsServiceStack.addDependency(ecrStack);


const apiStack = new ApiStack(app, 'Api', {
  tags,
  env,
  nlb: lbStack.nlb,
});
apiStack.addDependency(lbStack);
apiStack.addDependency(productsServiceStack);