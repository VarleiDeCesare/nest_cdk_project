import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Product, ProductKey } from "./entities/product.entity";
import { v4 as uuid } from 'uuid';
import { captureAWSv3Client } from 'aws-xray-sdk';
@Injectable()
export class ProductsService {
	private tableName: string;
	private ddbDocClient: DynamoDBDocumentClient;

	constructor() {
		this.tableName = process.env.PRODUCTS_DDB;
		const ddbClient = captureAWSv3Client(new DynamoDBClient());
		this.ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
	}

	async findAll(): Promise<Product[]> {
		const command = new ScanCommand({
			TableName: this.tableName,
		});
		const { Items } = await this.ddbDocClient.send(command);
		return Items as Product[];
	}

	async findOne(key: ProductKey): Promise<Product> {
		const command = new GetCommand({
			TableName: this.tableName,
			Key: key,
		});
		const { Item } = await this.ddbDocClient.send(command);

		if (Item) {
			return Item as Product;
		}

		throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
	}

	async create(product: Product): Promise<Product> {
		product.id = uuid();

		const command = new PutCommand({
			TableName: this.tableName,
			Item: product,
		});

		await this.ddbDocClient.send(command);
		return product;
	}

	async delete(key: ProductKey): Promise<void> {

		const command = new DeleteCommand({
			TableName: this.tableName,
			Key: key,
			ReturnValues: 'ALL_OLD',
		});

		const { Attributes } = await this.ddbDocClient.send(command);

		if (Attributes) {
			return;
		}
			throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
	}

	async update(key: ProductKey, product: Product): Promise<Product> {
		try {
			const command = new UpdateCommand({
				TableName: this.tableName,
				Key: key,
				UpdateExpression: 'set productName = :n, code = :c, price = :p, model = :m, productUrl: = :u',
				ExpressionAttributeValues: {
					":n": product.productName,
					":c": product.code,
					":p": product.price,
					":m": product.model,
					":u": product.productUrl,
				},
				ReturnValues: "UPDATED_NEW",
				ConditionExpression: 'attribute_exists(id)',
			});
	
			const { Attributes } = await this.ddbDocClient.send(command);
			return {
				...Attributes,
				id: key.id,
			} as Product;
		} catch(error) {
			throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
		}
	}

}