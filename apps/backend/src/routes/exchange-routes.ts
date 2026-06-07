import { Router } from "express";
import { requiredAuth } from "../middlewares/auth-middleware";
import { createOrderController, getBalanceController, getPositionsController } from "../controllers/exchange-controller";
import { authRouter } from "./auth-routes";

export const exchangeRouter = Router();

// for now i am removing requiredAuth as a middle ware but add it later
exchangeRouter.post("/order",(req,res)=>{ 
    console.log("inside exchange router aaaaaaaaaaaaaaaaaaaaaaa");
    // console.log(req);
    console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
    console.log(req.body);

    console.log(req.userId);
    createOrderController(req,res)
    
})

exchangeRouter.get("/balance",requiredAuth,getBalanceController)

exchangeRouter.get("/positions/:market",requiredAuth,getPositionsController)

exchangeRouter.get("/orders/:market",requiredAuth,(req,res)=>{
        // get this from prisma db , no engine required
})

exchangeRouter.get("/orders/:orderId",requiredAuth,(req,res)=>{

})

exchangeRouter.get("/fills",requiredAuth,(req,res)=>{
    // get this also from prisma db
})