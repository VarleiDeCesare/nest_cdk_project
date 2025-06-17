import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as logs from 'aws-cdk-lib/aws-logs'

interface ApiStackProps extends cdk.StackProps {
    nlb: elbv2.NetworkLoadBalancer
}

export class ApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props)

        const vpcLink = new apigateway.VpcLink(this, "VpcLink", {
            targets: [props.nlb]
        })

        const logGroup = new logs.LogGroup(this, "ECommerceApiLogs", {
            logGroupName: "ECommerceAPI",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: logs.RetentionDays.ONE_MONTH            
        })
        
        const restApi = new apigateway.RestApi(this, "RestApi", {
            restApiName: "ECommerceAPI",      
            deployOptions: {                
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                    caller: true,
                    httpMethod: true,
                    ip: true,
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    user: true
                })
            }      
        })

        this.createProductsResource(restApi, props, vpcLink)
    }

    private createProductsResource(
        restApi: apigateway.RestApi,
        props: ApiStackProps,
        vpcLink: apigateway.VpcLink
    ) {
        // /products
        const productsResource = restApi.root.addResource("products")

        // GET /products
        // GET /products?code=CODE1
        productsResource.addMethod("GET", new apigateway.Integration({
            type: apigateway.IntegrationType.HTTP_PROXY,
            integrationHttpMethod: "GET",
            uri: "http://" + props.nlb.loadBalancerDnsName + ":8080/api/products",
            options: {
                vpcLink: vpcLink,
                connectionType: apigateway.ConnectionType.VPC_LINK,
                requestParameters: {
                    "integration.request.header.requestId": "context.requestId"
                }
            }
        }), {
            requestParameters: {
                "method.request.header.requestId": false,
                "method.request.querystring.code": false
            }
        })

        const productRequestValidator = new apigateway.RequestValidator(this, "ProductRequestValidator", {
            restApi: restApi,
            requestValidatorName: 'Product request validator',
            validateRequestBody: true
        })
        const productModel = new apigateway.Model(this, "ProductModel", {
            modelName: "ProductModel",
            restApi: restApi,
            contentType: "application/json",
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    name: {
                        type: apigateway.JsonSchemaType.STRING,
                        minLength: 5,
                        maxLength: 50
                    },
                    code: {
                        type: apigateway.JsonSchemaType.STRING,
                        minLength: 5,
                        maxLength: 15
                    },
                    model: {
                        type: apigateway.JsonSchemaType.STRING,
                        minLength: 5,
                        maxLength: 50
                    },
                    price: {
                        type: apigateway.JsonSchemaType.NUMBER,
                        minimum: 10,
                        maximum: 1000
                    }
                },
                required: [
                    'name',
                    'code'
                ] 
            }            
        })

        // POST /products
        productsResource.addMethod("POST", new apigateway.Integration({
            type: apigateway.IntegrationType.HTTP_PROXY,
            integrationHttpMethod: "POST",
            uri: "http://" + props.nlb.loadBalancerDnsName + ":8080/api/products",
            options: {
                vpcLink: vpcLink,
                connectionType: apigateway.ConnectionType.VPC_LINK,
                requestParameters: {
                    "integration.request.header.requestId": "context.requestId"
                }
            }
        }), {
            requestParameters: {
                "method.request.header.requestId": false
            },
            requestValidator: productRequestValidator,
            requestModels: { "application/json": productModel }
        })


        // /products/{id}
        const productIdResource = productsResource.addResource("{id}")
        const productIdIntegrationParameters = {
            "integration.request.path.id": "method.request.path.id",
            "integration.request.header.requestId": "context.requestId"
        }
        const productIdMethodParameters = {
            "method.request.path.id": true,
            "method.request.header.requestId": false
        }

        // GET /products/{id}
        productIdResource.addMethod("GET", new apigateway.Integration({
            type: apigateway.IntegrationType.HTTP_PROXY,
            integrationHttpMethod: "GET",
            uri: "http://" + props.nlb.loadBalancerDnsName + ":8080/api/products/{id}",
            options: {
                vpcLink: vpcLink,
                connectionType: apigateway.ConnectionType.VPC_LINK,
                requestParameters: productIdIntegrationParameters
            }
        }), {
            requestParameters: productIdMethodParameters
        })

        // PUT /products/{id}
        productIdResource.addMethod("PUT", new apigateway.Integration({
            type: apigateway.IntegrationType.HTTP_PROXY,
            integrationHttpMethod: "PUT",
            uri: "http://" + props.nlb.loadBalancerDnsName + ":8080/api/products/{id}",
            options: {
                vpcLink: vpcLink,
                connectionType: apigateway.ConnectionType.VPC_LINK,
                requestParameters: productIdIntegrationParameters
            }
        }), {
            requestParameters: productIdMethodParameters,
            requestValidator: productRequestValidator,
            requestModels: { "application/json": productModel }
        })

        // DELETE /products/{id}
        productIdResource.addMethod("DELETE", new apigateway.Integration({
            type: apigateway.IntegrationType.HTTP_PROXY,
            integrationHttpMethod: "DELETE",
            uri: "http://" + props.nlb.loadBalancerDnsName + ":8080/api/products/{id}",
            options: {
                vpcLink: vpcLink,
                connectionType: apigateway.ConnectionType.VPC_LINK,
                requestParameters: productIdIntegrationParameters
            }
        }), {
            requestParameters: productIdMethodParameters
        })

    }
}
