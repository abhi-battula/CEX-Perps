type Balance = { // later change the datatypes of numbers to bigint
  available: number;
  locked: number;
}
//all users balence is stored here , irrespective of trade is open or not
export const BALANCES = new Map<string,{ USD: Balance }>(); 

//--------------------------------------------------------------------------------------------------------------------

export type PositionSide = "long" | "short";

export type Position = { // i am thinking 2 positions will be created for
  positionId: string;
  userId: string;
  market: string;
  side: PositionSide;
  qty: number;
  entryPrice: number; // we will consider this only as avg price 
  leverage: number; //
  margin: number; // margin*leverage = entryprice * qty 
  liquidationPrice: number;
  isLiquidating?: boolean;
}

export const POSITIONS = new Map<string,Position[]>(); // userId and his positions

//--------------------------------------------------------------------------------------------

export type OrderSide = "buy" | "sell";

export type OrderType = "limit" | "market";

export type OrderStatus =
  | "open"
  | "partially_filled"
  | "filled"
  | "cancelled";

export type Order = {
  orderId: string;
  userId: string;
  market: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  filledQty: number;
  price: number;
  leverage: number; // think
  margin: number;
  slippage: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
}

export const ORDERS = new Map<string,Order>();  //orderId

//------------------------------------------------------------------------------------------------------------------------------------

export type Fill = {  
  fillId: string;
  market: string;
  price: number;
  qty: number;
  makerUserId: string;
  takerUserId: string;
  buyOrderId: string;
  sellOrderId: string;
  timestamp: number;
}

export const FILLS: Fill[] = []; //only one fill for a trade/swap/position

//--------------------------------------------------------------------------------------------

export type RestingOrder = {
  orderId: string;
  userId: string;
  qty: number;
  filledQty: number;
  createdAt: number;
}

export type PriceLevel = {
  totalQty: number;
  orders: RestingOrder[];
}

export type OrderBook = {
  bids: Map<number, PriceLevel>;
  asks: Map<number, PriceLevel>;
  lastTradedPrice: number;
  markPrice: number;
}

export const ORDERBOOKS = new Map<string,OrderBook>();

//------------------------------------------------------
export let MARK_PRICE:number = 0 ;
