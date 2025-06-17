import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2' 
import { Construct } from 'constructs'

export class VpcStack extends cdk.Stack {
    readonly vpc: ec2.Vpc

    constructor(scope: Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props)

        this.vpc = new ec2.Vpc(this, "ECommerceVPC", {
            vpcName: "ECommerceVPC", 
            maxAzs: 2,            
            //NUNCA FAÇA ISSO EM AMBIENTE DE PRODUÇÃO!!!
            //natGateways: 0
        })
    }
}