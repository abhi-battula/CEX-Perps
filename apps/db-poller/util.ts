import { prisma } from "db";

export async function createOrder(data:unknown){ // use data custom type here , and you can use "as" in actual arguments not in formal arguments
    prisma.order.create({
        data:{
            filledQty:"",
            initialMargin :"",
            market : "",
            price,
            qty,
            side,
            slippage,
            status,
            type,
            buyFills,
            orderid,
            sellFills,
            userId
        }
    })
}

export async function createFill(data:[]){
    
}