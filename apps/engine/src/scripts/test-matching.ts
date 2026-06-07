import { EventType, type createOrderEngine } from "@repo/common";
import { createOrder } from "../matching-engine";
import { BALANCES, FILLS, ORDERBOOKS, ORDERS, POSITIONS } from "../types/exchange.types";
import { onRampBalance } from "../util/util";
import { liquidationLoop } from "../liquidation-engine";

console.log("test starteed");

const payload1:createOrderEngine = {
    event: EventType.CREATE_ORDER,
    data: {
        market: "BTC",
        side: "buy",
        qty: 10,
        leverage: 10,
        type: "limit",
        price: 100,
        userId: "sathwik-buyer",
        req_id: "2345678"
    }
}

const payload2:createOrderEngine = {
    event: EventType.CREATE_ORDER,
    data: {
        market: "BTC",
        side: "sell",
        qty: 10,
        leverage: 10,
        type: "limit",
        price: 100,
        userId: "idiot-seller",
        req_id: "23456789"
    }
}

const payload3:createOrderEngine = {
    event: EventType.CREATE_ORDER,
    data: {
        market: "BTC",
        side: "buy",
        qty: 20,
        leverage: 1,
        type: "limit",
        price: 80,
        userId: "user-c",
        req_id: "2345678"
    }
}

// const payload4:createOrderEngine = {
//     event: "create-order",
//     data: {
//         market: "BTC",
//         side: "buy",
//         qty: 15,
//         leverage: 1,
//         type: "limit",
//         price: 100,
//         userId: "new-buyer",
//         req_id: "2345678"
//     }
// }

onRampBalance(payload1.data.userId,1500)
onRampBalance(payload2.data.userId,1500)
onRampBalance(payload3.data.userId,2000)


createOrder(payload1);
printMemory(payload1);
createOrder(payload2);
printMemory(payload2);
createOrder(payload3);
printMemory(payload3);
liquidationLoop(89);
console.log("from testing file after liquidation loop");
printMemory(payload3)
printMemory(payload2);
printMemory(payload1);



// createOrder(payload3);
// printMemory(payload3);
// createOrder(payload4);
// printMemory(payload4);

function printMemory(payload:createOrderEngine){
    console.log("################################################################");
    
    console.log("orderBook----->", ORDERBOOKS.get(payload.data.market));
    console.log("Balancessss--->",BALANCES.get(payload.data.userId));
    console.log("filssss------>",FILLS);
    console.log("Posiions------->",POSITIONS.get(payload.data.userId));
    console.log("order------>",ORDERS.get(""));// you need to get the order id so look later
    console.log("***********************************************************************");
    
}



//  {
//     event: "create-order";
//     data: ({
//         market: string;
//         side: "buy" | "sell";
//         qty: number;
//         leverage: number;
//         type: "market";
//         slippage: number;
//     } | {
//         market: string;
//         side: "buy" | "sell";
//         qty: number;
//         leverage: number;
//         type: "limit";
//         price: number;
//     }) & {
//         userId: string;
//         req_id: string;
//     };
// }