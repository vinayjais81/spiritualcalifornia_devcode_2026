export declare class OrderItemDto {
    productId: string;
    variantId?: string;
    quantity: number;
}
export declare class ShippingAddressDto {
    street: string;
    apartment?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
}
export declare class CreateOrderDto {
    items: OrderItemDto[];
    contactEmail: string;
    contactFirstName: string;
    contactLastName: string;
    contactPhone?: string;
    shippingAddress?: ShippingAddressDto;
    shippingMethodId?: string;
    promoCode?: string;
    notes?: string;
}
