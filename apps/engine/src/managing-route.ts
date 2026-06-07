import { createOrderEngineSchema, type engineResponse, type requestType } from "@repo/common";
import { getBalance, getPositions } from "./util/util";
import { createOrder } from "./matching-engine";
import { FILLS, ORDERS } from "./types/exchange.types";

export function manageRoute(payload: requestType) {
  // if (payload.event === "get_positions") {
  //   return getPositions(payload.data?.market, payload.data?.userId)
  // }

  switch (payload.event) {

    case "create_order":
      const engineRequestValidation = createOrderEngineSchema.safeParse(payload)
      if (!engineRequestValidation.success) {
        console.log("####faild");
        return { status: false,msg: ""}; // todo : check this and send correctly
      }
      const engineRes = createOrder(engineRequestValidation.data);
      // get order id and get order detials and add it queue
      // get fill ids and get fills and add it into queue separately
      // return status , msg , data
      return engineRes;

    case "get_balance":
      return getBalance(payload.data.userId)

    case "get_positions":
      return getPositions(payload.data.market, payload.data.userId)

    default:
      break;
  }

  return {
  status: false,
  msg: ""
}
}