import { check } from "zod";
import { BALANCES, FILLS, ORDERBOOKS, ORDERS, POSITIONS, type Order, type OrderBook, type OrderSide, type RestingOrder, type Position, type PositionSide } from "../types/exchange.types";

// export type CreateOrderInput = {
//   userId: string;
//   market: string;
//   side: "buy" | "sell";
//   type: "limit" | "market";
//   qty: number;
//   price?: number; //price is goint to be mandatory even for market order according to our recent discussion bcz of slippage
//   leverage: number;
//   margin: number;
// }


function matchLimitBuy(orderInput: Order) { //buy , limit
  // 1) get the orderBook
  const orderBook = getOrCreateOrderBook(orderInput.market);
  // 2) get the all the asks in sorted way
  // const sortedAsks = Object.keys(orderBook.asks).sort((a,b)=>Number(a)-Number(b)) ;
  const sortedAsks = Array.from(orderBook.asks).sort((a, b) => a[0] - b[0]);

  let buyerRemaining = orderInput.qty;
  const filledRestingOrders: string[] = [];
  for (const ask of sortedAsks) {
    const currentAsk = ask[0];

    if (currentAsk <= orderInput.price!) {// the buy order might get fully or parially filled in this case

      for (const restingOrder of ask[1].orders) {
        // it will give one by one resting order at that price.
        const singleSellerRemaining = restingOrder.qty - restingOrder.filledQty; // that particular seller
        const matchedQty = Math.min(buyerRemaining, singleSellerRemaining); // this matchedQty make sure this quantity is always avialable at seller , always.

        buyerRemaining -= matchedQty;
        restingOrder.filledQty += matchedQty;
        ask[1].totalQty -= matchedQty; //in future or coming steps , we need to check if ask.totalQty = 0 then we need to remove that price from orderbook

        // create fill,
        createFill(orderInput.market, currentAsk, matchedQty, restingOrder.userId, orderInput.userId, orderInput.orderId, restingOrder.orderId);
        const sellerPosition = createOrUpdatePosition(restingOrder.userId, orderInput.market, "short", matchedQty, currentAsk)
        //update the order status and filled qty
        const buyerOrder = ORDERS.get(orderInput.orderId)!
        buyerOrder.status = "partially_filled";
        buyerOrder.filledQty += matchedQty;

        const sellerOrder = ORDERS.get(restingOrder.orderId)!;
        sellerOrder.filledQty += matchedQty;
        sellerOrder.status = "partially_filled";

        if (restingOrder.filledQty === restingOrder.qty) {
          sellerOrder.status = "filled";
          // remove this seller from orderbook and it will continue the loop
          filledRestingOrders.push(restingOrder.orderId);
        }

        if (buyerRemaining === 0) {
          //buyer quantity is fulled then break
          buyerOrder.status = "filled";
          break;
        }
      }
      // 2 things can happen in 2nd for loop: 
      // 1) buyer filled qty is full and he breaks out of the 2nd for loop and filledRestingOrder contains orderIds if any resting order is completed
      // 2) buyer is unfilled and seller resting orders are done. so we move to the next price.

      //create position
      const buyerPosition = createOrUpdatePosition(orderInput.userId, orderInput.market, "long", orderInput.qty - buyerRemaining, currentAsk);

      // todo : if he gets the buy for less price then we have to some how return him the extra money or do some setting in leverage or margin or liquidation position

      //removerestingorder method call
      removeRestingOrders(filledRestingOrders, currentAsk, orderInput.side, orderInput.market)
      //remove entire ask record if total qyantity is 0 for that particular price
      if (ask[1].totalQty === 0) {
        removeEmptyPriceLevel(currentAsk, orderInput.side, orderInput.market)
      }

      if (buyerRemaining === 0) {
        //buyer got full , no need of iteration for the next best price
        // buyerOrder.status = "filled";
        break;
      }

    } else {// ask price is more than input price , so just add/make him sit in orderbook
      // the difference of qty - filledQty will be enterd into orderbook.
      //create resting order and add him to buy side witht he selected price
      const newRestingOrder: RestingOrder = {
        orderId: orderInput.orderId,
        userId: orderInput.userId,
        qty: orderInput.qty, //todo : think whether to change this leftout quantity and keep filled qunatity to 0
        filledQty: orderInput.qty - buyerRemaining,
        createdAt: Date.now()
      }

      const isPriceAvialable = orderBook.bids.has(orderInput.price!);
      if (!isPriceAvialable) {
        // no price avialable , so create price and resting records
        orderBook.bids.set(orderInput.price!, { totalQty: buyerRemaining, orders: [newRestingOrder] })
        //return or break
        break;
      }
      orderBook.bids.get(orderInput.price!)!.totalQty += buyerRemaining;
      orderBook.bids.get(orderInput.price!)!.orders.push(newRestingOrder);
    }
  }
}

function matchLimitSell(orderInput: Order) {
  // if this function is called then order is already created.

  // 1) get the orderbook
  const orderBook = getOrCreateOrderBook(orderInput.market);
  // 2) get the all the asks in sorted way
  const sortedBids = Array.from(orderBook.bids).sort((a, b) => a[0] - b[0]); // todo , test a-b or b-a

  let sellerRemaining = orderInput.qty;
  const filledRestingOrders: string[] = [];
  for (const bid of sortedBids) {
    const currentBid = bid[0];

    if (currentBid <= orderInput.price!) {// the seller order might get fully or parially filled in this case

      for (const restingOrder of bid[1].orders) {
        // it will give one by one resting order at that price.
        const singleSBuyerRemaining = restingOrder.qty - restingOrder.filledQty; // that particular seller
        const matchedQty = Math.min(sellerRemaining, singleSBuyerRemaining); // this matchedQty make sure this quantity is always avialable at seller , always.

        sellerRemaining -= matchedQty;
        restingOrder.filledQty += matchedQty;
        bid[1].totalQty -= matchedQty; //in future or coming steps , we need to check if ask.totalQty = 0 then we need to remove that price from orderbook

        // create fill,
        createFill(orderInput.market, currentBid, matchedQty, restingOrder.userId, orderInput.userId, orderInput.orderId, restingOrder.orderId);
        //in the below line basically , we are updating the position of maker.
        const buyerPosition = createOrUpdatePosition(restingOrder.userId, orderInput.market, "long", matchedQty, currentBid)
        //update the order status and filled qty
        const takerOrder = ORDERS.get(orderInput.orderId)!
        takerOrder.status = "partially_filled";
        takerOrder.filledQty += matchedQty;

        const makerOrder = ORDERS.get(restingOrder.orderId)!;
        makerOrder.filledQty += matchedQty;
        makerOrder.status = "partially_filled";

        if (restingOrder.filledQty === restingOrder.qty) {
          makerOrder.status = "filled";
          // remove this seller from orderbook and it will continue the loop
          filledRestingOrders.push(restingOrder.orderId);
        }

        if (sellerRemaining === 0) {
          //buyer quantity is fulled then break
          takerOrder.status = "filled";
          break;
        }
      }
      // 2 things can happen in 2nd for loop: 
      // 1) buyer filled qty is full and he breaks out of the 2nd for loop and filledRestingOrder contains orderIds if any resting order is completed
      // 2) buyer is unfilled and seller resting orders are done. so we move to the next price.

      //create position , the below is basically for taker
      const sellerPosition = createOrUpdatePosition(orderInput.userId, orderInput.market, "short", orderInput.qty - sellerRemaining, currentBid);

      // todo : if he gets the buy for less price then we have to some how return him the extra money or do some setting in leverage or margin or liquidation position

      //removerestingorder method call
      removeRestingOrders(filledRestingOrders, currentBid, orderInput.side, orderInput.market)
      //remove entire ask record if total qyantity is 0 for that particular price
      if (bid[1].totalQty === 0) {
        removeEmptyPriceLevel(currentBid, orderInput.side, orderInput.market)
      }

      if (sellerRemaining === 0) {
        //buyer got full , no need of iteration for the next best price
        // buyerOrder.status = "filled";
        break;
      }

    } else {// ask price is more than input price , so just add/make him sit in orderbook
      // the difference of qty - filledQty will be enterd into orderbook.
      //create resting order and add him to buy side witht he selected price
      const newRestingOrder: RestingOrder = {
        orderId: orderInput.orderId,
        userId: orderInput.userId,
        qty: orderInput.qty, //todo : think whether to change this leftout quantity and keep filled qunatity to 0
        filledQty: orderInput.qty - sellerRemaining,
        createdAt: Date.now()
      }

      const isPriceAvialable = orderBook.asks.has(orderInput.price!);
      if (!isPriceAvialable) {
        // no price avialable , so create price and resting records
        orderBook.asks.set(orderInput.price!, { totalQty: sellerRemaining, orders: [newRestingOrder] })
        //return or break
        break;
      }
      orderBook.asks.get(orderInput.price!)!.totalQty += sellerRemaining;
      orderBook.asks.get(orderInput.price!)!.orders.push(newRestingOrder);
    }
  }

}

function matchMarketBuy(orderInput: Order) {
  // get the avialable price and kick him out ,
  // in the worst case , if quantity is not avialable , then fill the filled quantity and cancel the remaining.

  // 1) get the orderBook
  const orderBook = getOrCreateOrderBook(orderInput.market);

  // 2) get all the asks in sorted way
  const sortedAsks = Array.from(orderBook.asks).sort((a, b) => a[0] - b[0]);

  let buyerRemaining = orderInput.qty;
  const filledRestingOrders: string[] = [];
  for (const ask of sortedAsks) {
    const currentAsk = ask[0];
    const avialableQty = ask[1].totalQty// this is that much qty avialable at that price , not needed

    for (const restingOrder of ask[1].orders) {
      const sellerRemaining = restingOrder.qty - restingOrder.filledQty;
      const matchedQty = Math.min(sellerRemaining, buyerRemaining);

      buyerRemaining -= matchedQty;
      restingOrder.filledQty += matchedQty;
      ask[1].totalQty -= matchedQty;

      // create fill,
      createFill(orderInput.market, currentAsk, matchedQty, restingOrder.userId, orderInput.userId, orderInput.orderId, restingOrder.orderId);
      // create or update position
      const sellerPosition = createOrUpdatePosition(restingOrder.userId, orderInput.market, "short", matchedQty, currentAsk)
      //update the order status and filled qty
      const buyerOrder = ORDERS.get(orderInput.orderId)!
      buyerOrder.status = "partially_filled";
      buyerOrder.filledQty += matchedQty;

      const sellerOrder = ORDERS.get(restingOrder.orderId)!;
      sellerOrder.filledQty += matchedQty;
      sellerOrder.status = "partially_filled";

      if (restingOrder.filledQty === restingOrder.qty) {
        sellerOrder.status = "filled";
        // remove this seller from orderbook and it will continue the loop
        filledRestingOrders.push(restingOrder.orderId);
      }

      if (buyerRemaining === 0) {
        //buyer quantity is fulled then break
        buyerOrder.status = "filled";
        break;
      }
    }

    //create or update position
    const buyerPosition = createOrUpdatePosition(orderInput.userId, orderInput.market, "long", orderInput.qty - buyerRemaining, currentAsk);

    // todo : if he gets the buy for less price then we have to some how return him the extra money or do some setting in leverage or margin or liquidation position

    //removerestingorder method call
    removeRestingOrders(filledRestingOrders, currentAsk, orderInput.side, orderInput.market)
    //remove entire ask record if total qyantity is 0 for that particular price
    if (ask[1].totalQty === 0) {
      removeEmptyPriceLevel(currentAsk, orderInput.side, orderInput.market)
    }
  }

}

function matchMarketSell(orderInput: Order) {
  // if this function is called then order is already created.

  // 1) get the orderbook
  const orderBook = getOrCreateOrderBook(orderInput.market);
  // 2) get the all the asks in sorted way
  const sortedBids = Array.from(orderBook.bids).sort((a, b) => a[0] - b[0]); // todo , test a-b or b-a

  let sellerRemaining = orderInput.qty;
  const filledRestingOrders: string[] = [];
  for (const bid of sortedBids) {
    const currentBid = bid[0];

    for (const restingOrder of bid[1].orders) {
      // it will give one by one resting order at that price.
      const singleSBuyerRemaining = restingOrder.qty - restingOrder.filledQty; // that particular seller
      const matchedQty = Math.min(sellerRemaining, singleSBuyerRemaining); // this matchedQty make sure this quantity is always avialable at seller , always.

      sellerRemaining -= matchedQty;
      restingOrder.filledQty += matchedQty;
      bid[1].totalQty -= matchedQty; //in future or coming steps , we need to check if ask.totalQty = 0 then we need to remove that price from orderbook

      // create fill,
      createFill(orderInput.market, currentBid, matchedQty, restingOrder.userId, orderInput.userId, orderInput.orderId, restingOrder.orderId);
      //in the below line basically , we are updating the position of maker.
      const buyerPosition = createOrUpdatePosition(restingOrder.userId, orderInput.market, "long", matchedQty, currentBid)
      //update the order status and filled qty
      const takerOrder = ORDERS.get(orderInput.orderId)!
      takerOrder.status = "partially_filled";
      takerOrder.filledQty += matchedQty;

      const makerOrder = ORDERS.get(restingOrder.orderId)!;
      makerOrder.filledQty += matchedQty;
      makerOrder.status = "partially_filled";

      if (restingOrder.filledQty === restingOrder.qty) {
        makerOrder.status = "filled";
        // remove this seller from orderbook and it will continue the loop
        filledRestingOrders.push(restingOrder.orderId);
      }

      if (sellerRemaining === 0) {
        //buyer quantity is fulled then break
        takerOrder.status = "filled";
        break;
      }
    }
    // 2 things can happen in 2nd for loop: 
    // 1) buyer filled qty is full and he breaks out of the 2nd for loop and filledRestingOrder contains orderIds if any resting order is completed
    // 2) buyer is unfilled and seller resting orders are done. so we move to the next price.

    //create position , the below is basically for taker
    const sellerPosition = createOrUpdatePosition(orderInput.userId, orderInput.market, "short", orderInput.qty - sellerRemaining, currentBid);

    // todo : if he gets the buy for less price then we have to some how return him the extra money or do some setting in leverage or margin or liquidation position

    //removerestingorder method call
    removeRestingOrders(filledRestingOrders, currentBid, orderInput.side, orderInput.market)
    //remove entire ask record if total qyantity is 0 for that particular price
    if (bid[1].totalQty === 0) {
      removeEmptyPriceLevel(currentBid, orderInput.side, orderInput.market)
    }

    if (sellerRemaining === 0) {
      //buyer got full , no need of iteration for the next best price
      // buyerOrder.status = "filled";
      break;
    }
    //create or update position
    const buyerPosition = createOrUpdatePosition(orderInput.userId, orderInput.market, "short", orderInput.qty - sellerRemaining, currentBid);

    // todo : if he gets the buy for less price then we have to some how return him the extra money or do some setting in leverage or margin or liquidation position

    //removerestingorder method call
    removeRestingOrders(filledRestingOrders, currentBid, orderInput.side, orderInput.market)
    //remove entire ask record if total qyantity is 0 for that particular price
    if (bid[1].totalQty === 0) {
      removeEmptyPriceLevel(currentBid, orderInput.side, orderInput.market)
    }
  }

}

function createOrUpdatePosition(userId: string, market: string, side: PositionSide, qty: number, entryPrice: number) {
  const userAllPositions = POSITIONS.get(userId) ?? []; //user

  const existingPosition = userAllPositions.find(position => position.market === market);// 

  if (existingPosition) {
    //update
    //while updating the position , take the previous entry price and current entry price and do avg and then upate in the avg price
    // and remove from positions if "" is 0
    // check his existing side and compare what he is doint( getting ) and then decide whther to add or delete
    if (existingPosition.side === side) {
      // doing same activity again , so increase
      existingPosition.qty += qty;
      existingPosition.averagePrice = (existingPosition.averagePrice + entryPrice * qty) / 2;
      //update other if changes like margin and liquidateion

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

    } else if (existingPosition.qty < 0) {
      // create opposite position
      existingPosition.side = existingPosition.side === "long" ? "short" : "long";
      // existingPosition.qty = existingPosition.qty - (2*existingPosition.qty)
      existingPosition.qty -= (2 * existingPosition.qty) // to make sure the qty will be positive again
      // todo caluculate and change other thigns like avg price , liquidation , and unrealizedP&L

    } else {
      // no need to changte qty i guess becasue it is already done
      // todo caluculate and change other thigns like avg price , liquidation , and unrealizedP&L
    }
    return;
  }

  // create
  //
  const newPosition: Position = {
    positionId: crypto.randomUUID(),
    userId,
    market,
    side,// most important thing 
    qty,
    entryPrice,
    leverage: 0,
    margin: 0,
    liquidationPrice: 0,
    unrealizedPnl: 0,
    averagePrice: entryPrice //for now
  }
  userAllPositions.push(newPosition)
  POSITIONS.set(userId, userAllPositions);
}

function removeRestingOrders(filledRestingOrders: string[], currentAsk: number, side: OrderSide, market: string) {
  if (side === "buy") {
    //remove from asks
    const orderBook = getOrCreateOrderBook(market)!;
    const allRestingOrders = orderBook.asks.get(currentAsk)?.orders!;
    const restingOrders = allRestingOrders.filter(restingOrder => !filledRestingOrders.includes(restingOrder.orderId))
    orderBook.asks.get(currentAsk)!.orders = restingOrders
    // ORDERBOOKS.set(market,)
  }
}

function removeEmptyPriceLevel(currentAsk: number, side: OrderSide, market: string) {
  if (side === "buy") {
    const orderBook = getOrCreateOrderBook(market)!;
    orderBook.asks.delete(currentAsk)
  }
}

// this will return the orderbook if it is  present other wise it will create
function getOrCreateOrderBook(market: string) {
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

function createFill(market: string, price: number, qty: number, makerUserId: string, takerUserId: string, buyOrderId: string, sellOrderId: string,) {
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
}

function createOrder(payload:any){// change it to actual type
  // check price if avialable and return there only if not sufficient 
  // caluculate leverage , liquidation price . findout formulas
  // max slippage -> 5% for market and 1% for limit. 
  //even for marekt order we will send the current price and we will only place the order if the price is +/- of the slippage , other wise we will fill the respective quantity and cancel remainging.
  // so every market order is also a limit order ( and "price +- slippage = limit" this is the limit they can afford.)
  // the diff is the leftout thing will sit on orderbook for limit and cancel for market
  const isBalanceAvailable = checkBalance("userId from payload",4)
  if(!isBalanceAvailable) return;
  caluculateLiquidation()
    
}

function caluculateLiquidation(userId:string,qty:number,entryPrice:number,slippage:number,PositionSide:"long"|"short",orderType:"limit"|"market",margin:number){
// we will check the balence for both limit and market. for market ( we will check based on slippage he has choosed)
const balance = BALANCES.get(userId)!
const availableUsd = balance.USD.available;
const actualOrderPrice = entryPrice * qty;
const leverage = actualOrderPrice / margin ;
let bankruptcyPrice:number;
let liquidationPrice:number;
const maintenanceMargin = margin * 0.1;
if(margin<availableUsd) return; // think about it
if (PositionSide === "long"){ // dont lock balance here, we need to lock in after trade happens.
  bankruptcyPrice = entryPrice - (margin / qty);
  liquidationPrice = entryPrice - ((margin - maintenanceMargin)/qty)
}else {
  bankruptcyPrice = entryPrice + (margin / qty)
  liquidationPrice = entryPrice + ((margin - maintenanceMargin)/qty)
}
}

function checkBalance(userId:string,margin:number){
  const balance = BALANCES.get(userId)!
const availableUsd = balance.USD.available;
if(margin<availableUsd) return false;
return true;
}

while(1){
  // continously read from stream and execute it
  const payload:any = {};


  if(payload.message === "create_order") {
    createOrder(payload)
  }
}

