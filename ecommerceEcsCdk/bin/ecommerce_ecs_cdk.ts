#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EcrStack } from '../lib/ecr-stack';

const app = new cdk.App();
const env: cdk.Environment = {
  account: '499604939475',
  region: 'us-east-1'
};
const tags = {
  cost: 'ecommerceInfra',
  team: "Varlei team"
}

const ecrStack = new EcrStack(app, 'Ecr', {
  env,
  tags,
})

