import { z } from "zod";

const baseOrderSchema = z.object({
  market: z.string(),
  side: z.enum(["buy", "sell"]),
  qty: z.number().positive(),
  leverage: z.number(),
});

const marketOrderSchema = baseOrderSchema.extend({
  type: z.literal("market"),
  slippage: z.number(),
});

const limitOrderSchema = baseOrderSchema.extend({
  type: z.literal("limit"),
  price: z.number(),
});

export const createOrderSchema = z.discriminatedUnion("type", [
  marketOrderSchema,
  limitOrderSchema,
]);

export type CreateOrder = z.infer<typeof createOrderSchema>;

export enum EventType {
  GET_POSITIONS = "get_positions",
  GET_BALANCE  = "get_balance",
  CREATE_ORDER  = "create_order",
  ADD_FILLS = "add_fills"
}

export const createOrderEngineSchema = z.object({
    event: z.literal(EventType.CREATE_ORDER),
    data: createOrderSchema.and(
         z.object({
      userId: z.string(),
      req_id: z.string(),
    })
    )
})

export type createOrderEngine = z.infer<typeof createOrderEngineSchema>;

export type engineResponse = {
    event:EventType,
    status: boolean,
    msg: string,
    req_id:string,
    data?: unknown    // use union it can be different types which will be defined later down , for now optional
}

export type requestType = createOrderEngine | positionRequestType | balanceRequestType ;

export type balanceRequestType = {
  event:EventType.GET_BALANCE,
  data:{
    userId: string,
    req_id: string;
  }
}

export type positionRequestType = {
  event: EventType.GET_POSITIONS,
  data:{
    userId: string,
    market: string,
    req_id: string;
  }
}

