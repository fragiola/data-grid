// The orders and their items: the example's data, shared by its components.

import { hash, person } from "../_kit/data";

export interface Item {
    product: string;
    quantity: number;
    price: number;
}

export interface Order {
    id: number;
    customer: string;
    email: string;
    city: string;
    placed: string;
    status: string;
    carrier: string;
    payment: string;
    items: Item[];
}

const PRODUCTS = [
    "Keyboard",
    "Monitor",
    "Dock",
    "Webcam",
    "Headset",
    "Chair",
    "Lamp",
    "Cable",
];
const STATUSES = ["Placed", "Packed", "Shipped", "Delivered"];
const CARRIERS = ["Post", "Courier", "Freight", "Pickup"];
const PAYMENTS = ["Card", "Invoice", "Transfer"];

export const orders: Order[] = Array.from({ length: 200 }, (_, index) => {
    const customer = person(index);
    return {
        id: 1001 + index,
        customer: customer.name,
        email: customer.email,
        city: customer.city,
        placed: `2026-${String(1 + hash(index + 5, 9)).padStart(2, "0")}-${String(1 + hash(index + 9, 28)).padStart(2, "0")}`,
        status: STATUSES[hash(index + 1, STATUSES.length)] ?? "Placed",
        carrier: CARRIERS[hash(index + 2, CARRIERS.length)] ?? "Post",
        payment: PAYMENTS[hash(index + 4, PAYMENTS.length)] ?? "Card",
        items: Array.from({ length: 2 + hash(index + 3, 5) }, (_, item) => ({
            product:
                PRODUCTS[hash(index * 11 + item, PRODUCTS.length)] ?? "Cable",
            quantity: 1 + hash(index * 13 + item, 4),
            price: 20 + hash(index * 17 + item, 30) * 10,
        })),
    };
});

export const total = (order: Order) =>
    order.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

export const ITEM_ROW = 24;
export const ITEM_HEADER = 26;
/** the items grid as tall as its rows (and its border) */
export const itemsHeight = (order: Order) =>
    ITEM_HEADER + order.items.length * ITEM_ROW + 2;
/** a detail's height, from its order: the taller of the summary and the items, and padding */
export const detailHeight = (order: Order) =>
    24 + Math.max(112, itemsHeight(order));
