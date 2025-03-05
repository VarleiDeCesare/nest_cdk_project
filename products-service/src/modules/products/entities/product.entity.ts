export interface ProductKey {
	id?: string;
}

export interface Product extends ProductKey {
	productName: string;
	code: string;
	price: number;
	model: string;
	productUrl: string;
}