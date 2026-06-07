import {z} from "zod"

// type CreateOrderPayload = {
//   market: string;
//   side: "buy" | "sell";
//   type: "market" | "limit";
//   qty: number;
//   price?: number; // required only for limit
//   leverage: number;
//   marginMode?: "isolated" | "cross";
//   reduceOnly?: boolean;
//   clientOrderId?: string;
// }
export const createOrderSchema = z.object({
    market: z.string(),
    side:z.enum(["buy","sell"]),
    type: z.enum(["market","limit"]),
    qty:z.number().positive(),
    price:z.number().optional(), // we will price for market order , based on the currect last traded price
    leverage:z.number(),
    slippage:z.number().optional()
})

export type createOrder = z.infer<typeof createOrderSchema>