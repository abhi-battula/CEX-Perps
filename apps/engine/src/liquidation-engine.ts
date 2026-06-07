import { EventType, type createOrderEngine } from "@repo/common";
import { createOrder } from "./matching-engine";
import { POSITIONS } from "./types/exchange.types";
import { shouldLiquidate } from "./util/util";

console.log("liquidation-engine.ts");

export async function liquidationLoop(MARK_PRICE: number) {

  while (true) {

    for (const [, positions] of POSITIONS) {
      console.log("1st for loop---->", positions);
      for (const position of positions) { // this positions is of single user, might be different markets. 

        if (position.isLiquidating) {
          continue;
        }

        const liquidate = shouldLiquidate(position, MARK_PRICE);
        console.log("should liquidate------>", liquidate);


        if (!liquidate) { continue; }

        console.log("LIQUIDATING --->", position.positionId);

        position.isLiquidating = true;

        // TODO:
        // create liquidation order here
        const liquidationOrder:createOrderEngine = {
          event: EventType.CREATE_ORDER,
          data: {
            market: position.market,
            side: position.side === "long"
              ? "sell"
              : "buy",
            qty: position.qty,
            leverage: position.leverage,
            type: "market",

            // large enough to cross book
            slippage: 100,

            userId: position.userId,
            req_id: crypto.randomUUID()
          }
        }
        console.log("creating liquidation order---->",liquidationOrder);
        
        const res = createOrder(liquidationOrder)
        console.log("AFTER BALANCE CHECK 22");
        // position.isLiquidating = false;
      }
    }

    await Bun.sleep(1000);
  }
}


// liquidationLoop();