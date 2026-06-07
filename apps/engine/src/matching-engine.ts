import { EventType, type createOrderEngine, type engineResponse } from "@repo/common";
import { BALANCES, FILLS, ORDERBOOKS, ORDERS, POSITIONS, type Order, type OrderBook, type OrderSide, type RestingOrder, type Position, type PositionSide, type PriceLevel, type Fill } from "./types/exchange.types";
import { caluculateLiquidation, checkBalance, createFill, createOrUpdatePosition, getOrCreateOrderBook, onRampBalance, removeEmptyPriceLevel, removeRestingOrders } from "./util/util";

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


const currentFills:Fill[]=[];
function matchBuy(orderInput: Order) { //buy , limit
  // 1) get the orderBook
  const orderBook = getOrCreateOrderBook(orderInput.market);
  // 2) get the all the asks in sorted way
  // const sortedAsks = Object.keys(orderBook.asks).sort((a,b)=>Number(a)-Number(b)) ;
  const sortedAsks = Array.from(orderBook.asks).sort((a, b) => a[0] - b[0]);

  if (!sortedAsks.length) {//ifempty array then directly add into orderbook in bids and break
    console.log("engine-sortedasks--->", sortedAsks);
    const restingOrder: RestingOrder = {
      orderId: orderInput.orderId,
      userId: orderInput.userId,
      qty: orderInput.qty,
      filledQty: orderInput.filledQty,
      createdAt: 0
    }
    const priceLevel: PriceLevel = {
      totalQty: orderInput.qty,
      orders: [restingOrder]
    }
    orderBook.bids.set(orderInput.price, priceLevel)
    return;
  }
  // Array.from(orderBook.asks)
  let buyerRemaining = orderInput.qty;
  let totalFilledQty = 0; //the below both are used for buyer position 
  let totalCost = 0;
  const filledRestingOrders: string[] = [];
  let firstLoop: number = 0;
  for (const ask of sortedAsks) {
    const currentAsk = ask[0];
    console.log("@@@@firstLoop", ++firstLoop);
    let secondLoop: number = 0;
    if (currentAsk <= orderInput.price!) {// the buy order might get fully or parially filled in this case

      for (const restingOrder of ask[1].orders) {
        console.log("@@@secondLoop", ++secondLoop);

        // it will give one by one resting order at that price.
        const singleSellerRemaining = restingOrder.qty - restingOrder.filledQty; // that particular seller
        const matchedQty = Math.min(buyerRemaining, singleSellerRemaining); // this matchedQty make sure this quantity is always avialable at seller , always.
        totalFilledQty += matchedQty;
        totalCost += matchedQty * currentAsk;
        buyerRemaining -= matchedQty;
        restingOrder.filledQty += matchedQty;
        ask[1].totalQty -= matchedQty; //in future or coming steps , we need to check if ask.totalQty = 0 then we need to remove that price from orderbook

        const sellerOrder = ORDERS.get(restingOrder.orderId)!;
        // create fill,
        const fill = createFill(orderInput.market, currentAsk, matchedQty, restingOrder.userId, orderInput.userId, orderInput.orderId, restingOrder.orderId);
        currentFills.push(fill)
        console.log("engine--fill created", FILLS);

        //update the lastTradedPrice 
        orderBook.lastTradedPrice = currentAsk;
        const sellerPosition = createOrUpdatePosition(restingOrder.userId, orderInput.market, "short", matchedQty, currentAsk, sellerOrder.leverage)
        //update the order status and filled qty
        const buyerOrder = ORDERS.get(orderInput.orderId)!
        buyerOrder.status = "partially_filled";
        buyerOrder.filledQty += matchedQty;


        sellerOrder.filledQty += matchedQty;
        sellerOrder.status = "partially_filled";
        console.log("******restingorder---->", restingOrder, buyerRemaining);

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
      console.log("@@ after secnod loop", orderBook);

      // 2 things can happen in 2nd for loop: 
      // 1) buyer filled qty is full and he breaks out of the 2nd for loop and filledRestingOrder contains orderIds if any resting order is completed
      // 2) buyer is unfilled and seller resting orders are done. so we move to the next price.

      //create position( this line is shifted out of the both for loop)
      // const buyerPosition = createOrUpdatePosition(orderInput.userId, orderInput.market, "long", orderInput.qty - buyerRemaining, currentAsk);

      // todo : if he gets the buy for less price then we have to some how return him the extra money or do some setting in leverage or margin or liquidation position

      //removerestingorder method call
      removeRestingOrders(filledRestingOrders, currentAsk, orderInput.side, orderInput.market)
      //remove entire ask record if total qyantity is 0 for that particular price
      if (ask[1].totalQty === 0) {
        removeEmptyPriceLevel(currentAsk, orderInput.side, orderInput.market)
      }
      console.log("buy still there-->", buyerRemaining);

      if (buyerRemaining === 0) {
        //buyer got full , no need of iteration for the next best price
        // buyerOrder.status = "filled";
        break;
      }

    } else {// ask price is more than input price , so just add/make him sit in orderbook
      // the difference of qty - filledQty will be enterd into orderbook.
      //create resting order and add him to buy side witht he selected price

      //new:- if(market order) then  just cancel the pending orders and upate the order record
      if (orderInput.type === "market") {
        const buyerOrder = ORDERS.get(orderInput.orderId)!
        // buyerOrder.status = "cancelled";// todo : think about this you are cancelling the order even when few positions are created.
        // buyerOrder.filledQty += matchedQty;
        if (buyerOrder.filledQty === 0) {
          buyerOrder.status = "cancelled";
        }
        //return or break
        return;
      }
      console.log("**********2,creating new restingourder");

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
  if (buyerRemaining !== 0) { // no ASKS left , so create resting order for pending things
    // only for limit
    if (orderInput.type === "market") {
      const buyerOrder = ORDERS.get(orderInput.orderId)!
      // buyerOrder.status = "cancelled";// todo : think about this you are cancelling the order even when few positions are created.
      // buyerOrder.filledQty += matchedQty;
      if (buyerOrder.filledQty === 0) {
        buyerOrder.status = "cancelled";
      }
      //return or break
      return;
    }
    console.log("**********2,creating new restingourder");

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
      return;
    }
    orderBook.bids.get(orderInput.price!)!.totalQty += buyerRemaining;
    orderBook.bids.get(orderInput.price!)!.orders.push(newRestingOrder);

  }
  if (totalFilledQty > 0) {
    const averageEntryPrice = totalCost / totalFilledQty;
    const buyerOrder = ORDERS.get(orderInput.orderId)!;
    createOrUpdatePosition(
      orderInput.userId,
      orderInput.market,
      "long",
      totalFilledQty,
      averageEntryPrice,
      buyerOrder.leverage
    );
  }
}

function matchSell(orderInput: Order) {
  console.log("inside matchSell() with orderINput",orderInput);
  
  // if this function is called then order is already created.

  // 1) get the orderbook
  const orderBook = getOrCreateOrderBook(orderInput.market);
  // 2) get the all the asks in sorted way
  const sortedBids = Array.from(orderBook.bids).sort((a, b) => b[0] - a[0]); // todo , test a-b or b-a

  console.log("ORDERBOOK", orderBook);
console.log("BIDS", orderBook.bids);
console.log("SORTED_BIDS", sortedBids);

  if (!sortedBids.length) {//ifempty array then directly add into orderbook in bids and break
    console.log("engine-sortedbids--->", sortedBids);
    const restingOrder: RestingOrder = {
      orderId: orderInput.orderId,
      userId: orderInput.userId,
      qty: orderInput.qty,
      filledQty: orderInput.filledQty,
      createdAt: 0
    }
    const priceLevel: PriceLevel = {
      totalQty: orderInput.qty,
      orders: [restingOrder]
    }
    orderBook.asks.set(orderInput.price, priceLevel)
    return;
  }

  let sellerRemaining = orderInput.qty;
  let totalFilledQty = 0;
  let totalCost = 0;
  const filledRestingOrders: string[] = [];
  for (const bid of sortedBids) {
    const currentBid = bid[0];

    if (currentBid >= orderInput.price!) {// the seller order might get fully or parially filled in this case

      for (const restingOrder of bid[1].orders) {
        // it will give one by one resting order at that price.
        const singleSBuyerRemaining = restingOrder.qty - restingOrder.filledQty; // that particular seller
        const matchedQty = Math.min(sellerRemaining, singleSBuyerRemaining); // this matchedQty make sure this quantity is always avialable at seller , always.

        totalFilledQty += matchedQty;
        totalCost += matchedQty * currentBid;
        sellerRemaining -= matchedQty;
        restingOrder.filledQty += matchedQty;
        bid[1].totalQty -= matchedQty; //in future or coming steps , we need to check if ask.totalQty = 0 then we need to remove that price from orderbook

        // create fill,
        const fill = createFill(orderInput.market, currentBid, matchedQty, restingOrder.userId, orderInput.userId, restingOrder.orderId, orderInput.orderId);
        currentFills.push(fill);
        //update lastTradedPrice very imp
        orderBook.lastTradedPrice = currentBid;
        const makerOrder = ORDERS.get(restingOrder.orderId)!;
        //in the below line basically , we are updating the position of maker.
        const buyerPosition = createOrUpdatePosition(restingOrder.userId, orderInput.market, "long", matchedQty, currentBid, makerOrder.leverage)
        //update the order status and filled qty
        const takerOrder = ORDERS.get(orderInput.orderId)!
        takerOrder.status = "partially_filled";
        takerOrder.filledQty += matchedQty;


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
      // const sellerPosition = createOrUpdatePosition(orderInput.userId, orderInput.market, "short", orderInput.qty - sellerRemaining, currentBid);

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


      //new:- if(market order) then  just cancel the pending orders and upate the order record
      if (orderInput.type === "market") {
        const buyerOrder = ORDERS.get(orderInput.orderId)!
        // buyerOrder.status = "cancelled";// todo : think about this you are cancelling the order even when few positions are created.
        // buyerOrder.filledQty += matchedQty;
        if (buyerOrder.filledQty === 0) {
          buyerOrder.status = "cancelled";
        }
        //return or break
        return;
      }
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
  //after both the for loops
  if(sellerRemaining !== 0 ){ // copy pasted above code
    if (orderInput.type === "market") {
        const buyerOrder = ORDERS.get(orderInput.orderId)!
        // buyerOrder.status = "cancelled";// todo : think about this you are cancelling the order even when few positions are created.
        // buyerOrder.filledQty += matchedQty;
        if (buyerOrder.filledQty === 0) {
          buyerOrder.status = "cancelled";
        }
        //return or break
        return;
      }
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
        return;
      }
      orderBook.asks.get(orderInput.price!)!.totalQty += sellerRemaining;
      orderBook.asks.get(orderInput.price!)!.orders.push(newRestingOrder);
  }
  if (totalFilledQty > 0) {
    const averageEntryPrice = totalCost / totalFilledQty;
    const leverage = ORDERS.get(orderInput.orderId)!.leverage;
    createOrUpdatePosition(
      orderInput.userId,
      orderInput.market,
      "short",
      totalFilledQty,
      averageEntryPrice,
      leverage
    );
  }

}










export function createOrder(createOrderInput: createOrderEngine) {// change it to actual type
  // check price if avialable and return there only if not sufficient 
  // caluculate leverage , liquidation price . findout formulas
  // max slippage -> 5% for market and 1% for limit. 
  //even for marekt order we will send the current price and we will only place the order if the price is +/- of the slippage , other wise we will fill the respective quantity and cancel remainging.
  // so every market order is also a limit order ( and "price +- slippage = limit" this is the limit they can afford.)
  // the diff is the leftout thing will sit on orderbook for limit and cancel for market
  console.log("inside create order input with data--->", createOrderInput);

  onRampBalance(createOrderInput.data.userId);

  //check balance
  const isBalanceAvailable = checkBalance(createOrderInput.data)
  console.log( "BALANCE CHECK RESULT",isBalanceAvailable);
  if (!isBalanceAvailable.valid) {
    return {
      status: false,
      msg: "balance not suffient",
      req_id: createOrderInput.data.req_id
    }
  }
  //here when we are sending price , we should make sure for the limit we are sending the payload price 
  // and for market , we are sending current ws price
  // const { bankruptcyPrice, liquidationPrice, margin, price } = caluculateLiquidation(createOrderInput.data, MARK_PRICE);
  // console.log("liquidatin methiso ---->", { bankruptcyPrice, liquidationPrice, margin, price });

  // first create order
  const newOrder: Order = {
    orderId: crypto.randomUUID(),
    userId: createOrderInput.data.userId,
    market: createOrderInput.data.market,
    side: createOrderInput.data.side,
    type: createOrderInput.data.type,
    qty: createOrderInput.data.qty,
    filledQty: 0,
    price: isBalanceAvailable.price,// this is the caluculated max price with the help of slippage in the case of "market", this is the actual price enterd by the user in the limit order case
    leverage: createOrderInput.data.leverage,
    margin: isBalanceAvailable.margin,
    slippage: createOrderInput.data.type === "market" ? createOrderInput.data.slippage : 0,
    status: "open",
    createdAt: 0,
    updatedAt: 0
  }

  // new order created
  ORDERS.set(newOrder.orderId, newOrder);
  console.log("order created--->", ORDERS.get(newOrder.orderId));

  const userBalance = BALANCES.get(createOrderInput.data.userId)!;

  // lock balance , todo:this should not be done for liquidation orders
  userBalance.USD.available -= newOrder.margin;
  userBalance.USD.locked += newOrder.margin;

  // call match methods , buy or sell
  console.log("AFTER BALANCE CHECK");
  (createOrderInput.data.side === "buy") ? matchBuy(newOrder) : matchSell(newOrder)


  return {
  event: EventType.CREATE_ORDER,
  status: true,
  msg: "order created ",
  req_id: createOrderInput.data.req_id,
    // we will return orderId , he will get the details for order.
    data: {order:ORDERS.get(newOrder.orderId),currentFills}

    // we will return fillIds array , he will fetch and return
}

}





// while(1){
//   // continously read from stream and execute it
//   const payload:any = {};


//   if(payload.message === "create_order") {
//     createOrder(payload)
//   }
// }

