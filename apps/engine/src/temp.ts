// function matchMarketBuy(orderInput: Order) {
//   // get the avialable price and kick him out ,
//   // in the worst case , if quantity is not avialable , then fill the filled quantity and cancel the remaining.

//   // 1) get the orderBook
//   const orderBook = getOrCreateOrderBook(orderInput.market);

//   // 2) get all the asks in sorted way
//   const sortedAsks = Array.from(orderBook.asks).sort((a, b) => a[0] - b[0]);

//   let buyerRemaining = orderInput.qty;
//   const filledRestingOrders: string[] = [];
//   for (const ask of sortedAsks) {
//     const currentAsk = ask[0];
//     const avialableQty = ask[1].totalQty// this is that much qty avialable at that price , not needed

//     for (const restingOrder of ask[1].orders) {
//       const sellerRemaining = restingOrder.qty - restingOrder.filledQty;
//       const matchedQty = Math.min(sellerRemaining, buyerRemaining);

//       buyerRemaining -= matchedQty;
//       restingOrder.filledQty += matchedQty;
//       ask[1].totalQty -= matchedQty;

//       // create fill,
//       createFill(orderInput.market, currentAsk, matchedQty, restingOrder.userId, orderInput.userId, orderInput.orderId, restingOrder.orderId);
//       // create or update position
//       const sellerPosition = createOrUpdatePosition(restingOrder.userId, orderInput.market, "short", matchedQty, currentAsk)
//       //update the order status and filled qty
//       const buyerOrder = ORDERS.get(orderInput.orderId)!
//       buyerOrder.status = "partially_filled";
//       buyerOrder.filledQty += matchedQty;

//       const sellerOrder = ORDERS.get(restingOrder.orderId)!;
//       sellerOrder.filledQty += matchedQty;
//       sellerOrder.status = "partially_filled";

//       if (restingOrder.filledQty === restingOrder.qty) {
//         sellerOrder.status = "filled";
//         // remove this seller from orderbook and it will continue the loop
//         filledRestingOrders.push(restingOrder.orderId);
//       }

//       if (buyerRemaining === 0) {
//         //buyer quantity is fulled then break
//         buyerOrder.status = "filled";
//         break;
//       }
//     }

//     //create or update position
//     const buyerPosition = createOrUpdatePosition(orderInput.userId, orderInput.market, "long", orderInput.qty - buyerRemaining, currentAsk);

//     // todo : if he gets the buy for less price then we have to some how return him the extra money or do some setting in leverage or margin or liquidation position

//     //removerestingorder method call
//     removeRestingOrders(filledRestingOrders, currentAsk, orderInput.side, orderInput.market)
//     //remove entire ask record if total qyantity is 0 for that particular price
//     if (ask[1].totalQty === 0) {
//       removeEmptyPriceLevel(currentAsk, orderInput.side, orderInput.market)
//     }
//   }

// }

// function matchMarketSell(orderInput: Order) {
//   // if this function is called then order is already created.

//   // 1) get the orderbook
//   const orderBook = getOrCreateOrderBook(orderInput.market);
//   // 2) get the all the asks in sorted way
//   const sortedBids = Array.from(orderBook.bids).sort((a, b) => a[0] - b[0]); // todo , test a-b or b-a

//   let sellerRemaining = orderInput.qty;
//   const filledRestingOrders: string[] = [];
//   for (const bid of sortedBids) {
//     const currentBid = bid[0];

//     for (const restingOrder of bid[1].orders) {
//       // it will give one by one resting order at that price.
//       const singleSBuyerRemaining = restingOrder.qty - restingOrder.filledQty; // that particular seller
//       const matchedQty = Math.min(sellerRemaining, singleSBuyerRemaining); // this matchedQty make sure this quantity is always avialable at seller , always.

//       sellerRemaining -= matchedQty;
//       restingOrder.filledQty += matchedQty;
//       bid[1].totalQty -= matchedQty; //in future or coming steps , we need to check if ask.totalQty = 0 then we need to remove that price from orderbook

//       // create fill,
//       createFill(orderInput.market, currentBid, matchedQty, restingOrder.userId, orderInput.userId, orderInput.orderId, restingOrder.orderId);
//       //in the below line basically , we are updating the position of maker.
//       const buyerPosition = createOrUpdatePosition(restingOrder.userId, orderInput.market, "long", matchedQty, currentBid)
//       //update the order status and filled qty
//       const takerOrder = ORDERS.get(orderInput.orderId)!
//       takerOrder.status = "partially_filled";
//       takerOrder.filledQty += matchedQty;

//       const makerOrder = ORDERS.get(restingOrder.orderId)!;
//       makerOrder.filledQty += matchedQty;
//       makerOrder.status = "partially_filled";

//       if (restingOrder.filledQty === restingOrder.qty) {
//         makerOrder.status = "filled";
//         // remove this seller from orderbook and it will continue the loop
//         filledRestingOrders.push(restingOrder.orderId);
//       }

//       if (sellerRemaining === 0) {
//         //buyer quantity is fulled then break
//         takerOrder.status = "filled";
//         break;
//       }
//     }
//     // 2 things can happen in 2nd for loop: 
//     // 1) buyer filled qty is full and he breaks out of the 2nd for loop and filledRestingOrder contains orderIds if any resting order is completed
//     // 2) buyer is unfilled and seller resting orders are done. so we move to the next price.

//     //create position , the below is basically for taker
//     const sellerPosition = createOrUpdatePosition(orderInput.userId, orderInput.market, "short", orderInput.qty - sellerRemaining, currentBid);

//     // todo : if he gets the buy for less price then we have to some how return him the extra money or do some setting in leverage or margin or liquidation position

//     //removerestingorder method call
//     removeRestingOrders(filledRestingOrders, currentBid, orderInput.side, orderInput.market)
//     //remove entire ask record if total qyantity is 0 for that particular price
//     if (bid[1].totalQty === 0) {
//       removeEmptyPriceLevel(currentBid, orderInput.side, orderInput.market)
//     }

//     if (sellerRemaining === 0) {
//       //buyer got full , no need of iteration for the next best price
//       // buyerOrder.status = "filled";
//       break;
//     }
//     //create or update position
//     const buyerPosition = createOrUpdatePosition(orderInput.userId, orderInput.market, "short", orderInput.qty - sellerRemaining, currentBid);

//     // todo : if he gets the buy for less price then we have to some how return him the extra money or do some setting in leverage or margin or liquidation position

//     //removerestingorder method call
//     removeRestingOrders(filledRestingOrders, currentBid, orderInput.side, orderInput.market)
//     //remove entire ask record if total qyantity is 0 for that particular price
//     if (bid[1].totalQty === 0) {
//       removeEmptyPriceLevel(currentBid, orderInput.side, orderInput.market)
//     }
//   }

// }