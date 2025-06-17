#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { EcrStack } from "../lib/ecr-stack";
import { VpcStack } from "../lib/vpc-stack";
import { ClusterStack } from "../lib/cluster-stack";
import { LoadBalancerStack } from "../lib/lb-stack";
import { ProductsServiceStack } from "../lib/productsService-stack";
import { ApiStack } from "../lib/api-stack";
import { AuditServiceStack } from "../lib/auditService-stack";

const app = new cdk.App();

const env: cdk.Environment = {
  account: "499604939475",
  region: "us-east-1",
};

const tagsInfra = {
  cost: "ECommerceInfra",
  team: "varlei-team",
};

const ecrStack = new EcrStack(app, "Ecr", {
  env: env,
  tags: tagsInfra,
});

const vpcStack = new VpcStack(app, "Vpc", {
  env: env,
  tags: tagsInfra,
});

const lbStack = new LoadBalancerStack(app, "LoadBalancer", {
  vpc: vpcStack.vpc,
  env: env,
  tags: tagsInfra,
});
lbStack.addDependency(vpcStack);

const clusterStack = new ClusterStack(app, "Cluster", {
  vpc: vpcStack.vpc,
  env: env,
  tags: tagsInfra,
});
clusterStack.addDependency(vpcStack);

const tagsProductsService = {
  cost: "ProductsService",
  team: "varlei-team",
};

const productsServiceStack = new ProductsServiceStack(app, "ProductsService", {
  tags: tagsProductsService,
  env: env,
  alb: lbStack.alb,
  nlb: lbStack.nlb,
  cluster: clusterStack.cluster,
  vpc: vpcStack.vpc,
  repository: ecrStack.productsServiceRepository,
});
productsServiceStack.addDependency(lbStack);
productsServiceStack.addDependency(clusterStack);
productsServiceStack.addDependency(vpcStack);
productsServiceStack.addDependency(ecrStack);

const tagsAuditService = {
  cost: "AuditService",
  team: "varlei-team",
};

const auditServiceStack = new AuditServiceStack(app, "AuditService", {
  tags: tagsAuditService,
  env: env,
  alb: lbStack.alb,
  nlb: lbStack.nlb,
  cluster: clusterStack.cluster,
  vpc: vpcStack.vpc,
  repository: ecrStack.auditServiceRepository,
  productsTopic: productsServiceStack.productsTopic,
});
auditServiceStack.addDependency(lbStack);
auditServiceStack.addDependency(clusterStack);
auditServiceStack.addDependency(vpcStack);
auditServiceStack.addDependency(ecrStack);
auditServiceStack.addDependency(productsServiceStack);

const apiStack = new ApiStack(app, "Api", {
  tags: tagsInfra,
  env: env,
  nlb: lbStack.nlb,
});
apiStack.addDependency(lbStack);
apiStack.addDependency(productsServiceStack);
