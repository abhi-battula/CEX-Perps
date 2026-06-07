import type { createOrderEngine } from "@repo/common";
import { BALANCES, FILLS, ORDERBOOKS, POSITIONS, type OrderBook, type OrderSide, type PositionSide, type Position } from "../types/exchange.types";


export function onRampBalance(userId: string, amount?: number) {
  const existingBalance = BALANCES.get(userId);

  if (existingBalance) {
    return existingBalance;
  }

  const balance = {
    USD: {
      available: amount ?? 100,
      locked: 0,
    },
  };

  BALANCES.set(userId, balance);

  return balance;
}

export function checkBalance(order: createOrderEngine["data"]) {

    const balance = BALANCES.get(order.userId)!
    const availableUsd = balance.USD.available;
    const lastTradedPrice = getLastTradedPrice(order.market)!;
    const price = getOrderPrice(order, lastTradedPrice)// for market , this function will just add slippage to the last traded price.
    // console.log("price from check balance ---->", price);

    const actualOrderPrice = price * order.qty;
    const margin = actualOrderPrice / order.leverage;
    if (availableUsd < margin) return { valid: false, price, margin };
    return { valid: true, price, margin };
}

export function getLastTradedPrice(market: string) {
    return ORDERBOOKS.get(market)?.lastTradedPrice
}
// userId: string, qty: number, entryPrice: number, slippage: number, PositionSide: "long" | "short", orderType: "limit" | "market", leverage: number
export function caluculateLiquidation(order: createOrderEngine["data"], MARK_PRICE: number) {
    // we will check the balence for both limit and market. for market ( we will check based on slippage he has choosed)
    const balance = BALANCES.get(order.userId)!
    const availableUsd = balance.USD.available;
    const price = getOrderPrice(order, MARK_PRICE)
    const actualOrderPrice = price * order.qty;
    // const leverage = actualOrderPrice / margin;
    const margin = actualOrderPrice / order.leverage;
    let bankruptcyPrice: number;
    let liquidationPrice: number;
    const maintenanceMargin = margin * 0.1;
    // if (margin < availableUsd) return; // think about it
    if (order.side === "buy") { // dont lock balance here, we need to lock in after trade happens.
        bankruptcyPrice = price - (margin / order.qty);
        liquidationPrice = price - ((margin - maintenanceMargin) / order.qty)
    } else {
        bankruptcyPrice = price + (margin / order.qty)
        liquidationPrice = price + ((margin - maintenanceMargin) / order.qty)
    }
    return { liquidationPrice, bankruptcyPrice, margin, price }
}

// type/side, 
export function calculateLiquidationPrice( side:"long"|"short", entryPrice:number, leverage:number ){
    let liquidationPrice; 
    if(side==="long"){
        liquidationPrice = entryPrice * (1 - 1/leverage)
    }else{
        liquidationPrice = entryPrice * (1 + 1/leverage);
    }
    return liquidationPrice
}

// this function will get the price , in the case of limit then direct price BUT in the case of market , then it will caluculate using slippage and return tha price
export function getOrderPrice(order: createOrderEngine["data"], lastTradedPrice: number) {
    if (order.type === "limit") {
        return order.price;
    }

    return order.side === "buy"
        ? lastTradedPrice * (1 + order.slippage / 100)
        : lastTradedPrice * (1 - order.slippage / 100);
}

export function createFill(market: string, price: number, qty: number, makerUserId: string, takerUserId: string, buyOrderId: string, sellOrderId: string,) {
    const newFill = {
        fillId: crypto.randomUUID(),
        market,
        price,
        qty,
        makerUserId,
        takerUserId,
        buyOrderId,
        sellOrderId,
        timestamp: Date.now()
    }
    FILLS.push(newFill);

    return newFill;
}

// this will return the orderbook if it is  present other wise it will create
export function getOrCreateOrderBook(market: string) {
    const orderBook = ORDERBOOKS.get(market);
    if (!orderBook) {
        // create orderBook for this market
        const newOrderBook: OrderBook = {
            bids: new Map(),
            asks: new Map(),
            lastTradedPrice: 0,
            markPrice: 0
        }
        ORDERBOOKS.set(market, newOrderBook);
        return newOrderBook;
    }
    return orderBook;
}

export function removeEmptyPriceLevel(currentAsk: number, side: OrderSide, market: string) {
    const orderBook = getOrCreateOrderBook(market)!;
    if (side === "buy") {
        orderBook.asks.delete(currentAsk)
    } else {
        orderBook.bids.delete(currentAsk);
    }
}

export function removeRestingOrders(filledRestingOrders: string[], currentAsk: number, side: OrderSide, market: string) {
    const orderBook = getOrCreateOrderBook(market)!;
    
    if (side === "buy") {
        //remove from asks
        const allRestingOrders = orderBook.asks.get(currentAsk)?.orders!;
        const restingOrders = allRestingOrders.filter(restingOrder => !filledRestingOrders.includes(restingOrder.orderId))
        orderBook.asks.get(currentAsk)!.orders = restingOrders
        // ORDERBOOKS.set(market,)
    } else {
        const allRestingOrders = orderBook.bids.get(currentAsk)?.orders!;
        const restingOrders = allRestingOrders.filter(restingOrder => !filledRestingOrders.includes(restingOrder.orderId))
        orderBook.bids.get(currentAsk)!.orders = restingOrders
    }
}

// this should handle 4 cases -> create long , create short , increase , reduce , flip
export function createOrUpdatePosition(userId: string, market: string, side: PositionSide, qty: number, fillPrice: number, leverage:number) {
    const fillValue = qty * fillPrice
    const fillMargin = fillValue / leverage

    const userAllPositions = POSITIONS.get(userId) ?? []; //user
    const existingPosition = userAllPositions.find(position => position.market === market);// 

    if (existingPosition) {
        //update
        //while updating the position , take the previous entry price and current entry price and do avg and then upate in the avg price
        // and remove from positions if "" is 0
        // check his existing side and compare what he is doint( getting ) and then decide whther to add or delete
        if (existingPosition.side === side) {// increase
            // existingPosition.averagePrice = (existingPosition.averagePrice + entryPrice * qty) / 2;
            existingPosition.entryPrice = ((existingPosition.entryPrice * existingPosition.qty) + (fillPrice * qty)) / (existingPosition.qty + qty)
            // (oldQty * oldAvg + newQty * newPrice) / (oldQty + newQty)
            // doing same activity again , so increase
            existingPosition.qty += qty;
            //update other if changes like margin and liquidateion
            existingPosition.margin += fillMargin;
            existingPosition.leverage = leverage; // for now updating with latest leverage
            const latestLiquidationPrice = calculateLiquidationPrice(side,existingPosition.entryPrice,leverage);// we need to pass the updated avg price which we already calucualted above
            existingPosition.liquidationPrice = latestLiquidationPrice;

            return;
        }

        // the below code means , opposite trade has happned ( that means either the buyer liquidated or he himself trying to loquidate some amount)
        // so wehave to check the quantity now , if sells full then remove him from positions , if he sells less then remove the less and if he sells more then add the extra more in the opposite side
        existingPosition.qty -= qty;
        if (existingPosition.qty === 0) {
            // remove from the postions
            const validUserPositions = userAllPositions.filter(position => position.qty !== 0)
            POSITIONS.set(userId, validUserPositions);
            // todo-> we have removed his positions , so we have to caluculate the the actual P&L and add it to the balance

        } else if (existingPosition.qty < 0) { // flip case
            // create opposite position
            existingPosition.side = existingPosition.side === "long" ? "short" : "long";
            // existingPosition.qty = existingPosition.qty - (2*existingPosition.qty)
            existingPosition.qty -= (2 * existingPosition.qty) // to make sure the qty will be positive again
            // todo caluculate and change other thigns like avg price , liquidation , and unrealizedP&L
            existingPosition.entryPrice = fillPrice;
            // margin for that new position
            existingPosition.margin = existingPosition.qty * fillPrice / leverage
            existingPosition.leverage = leverage;
            existingPosition.liquidationPrice = calculateLiquidationPrice(existingPosition.side,fillPrice,leverage)

        } else {//reduce
            // reduce case but still he has position in the actual position side.
            // no need to changte qty i guess becasue it is already done
            // todo caluculate and change other thigns like avg price , liquidation , and unrealizedP&L
            existingPosition.margin -= fillMargin;
        }
        return;
    }

    // create case
    const newPosition: Position = {
        positionId: crypto.randomUUID(),
        userId,
        market,
        side,// most important thing 
        qty,
        entryPrice:fillPrice,
        leverage,
        margin: fillMargin,
        liquidationPrice: calculateLiquidationPrice(side,fillPrice,leverage),
    }
    userAllPositions.push(newPosition)
    POSITIONS.set(userId, userAllPositions);
}

export function shouldLiquidate(position: Position,markPrice: number) {
    console.log("inside should liquidate--",position,markPrice);
    
    if (position.side === "long") {
        return markPrice <= position.liquidationPrice;
    }

    return markPrice >= position.liquidationPrice;
}

export function getPositions(market:string,userId:string){
    const allPositions = POSITIONS.get(userId);
    if(!allPositions){
        // no positions , so return 
        return {status:false,msg:"no positions for this market"};
    }
    // for (const position of allPositions ) {
    //     if(position.market === market){
    //         return position;
    //     }
    // }

    const positions = allPositions.find(position=>position.market===market)
    return {status:true,msg:"",data:positions}
}

export function getBalance(userId:string){
   const balance = BALANCES.get(userId) ?? onRampBalance(userId);
   return {status:true,msg:"",data:balance}
}