import type { Request, Response } from "express";
// import { createOrderSchema } from "../validators/backend-exchange"
import { createOrder, getBalanceService, getPositionsService } from "../services/exchange-service";
import { success } from "zod";
import { createOrderSchema } from "@repo/common";


export async function createOrderController(req: Request, res: Response) {
  // do zod validation and throw error.
  const zodValidation = createOrderSchema.safeParse(req.body);
  if(!zodValidation.success){
      return res.status(400).json({message:"invalid payload"})
  }
  // const createOrder = zodValidation.data;
  
  // const a = await createOrder(req.body)
  try {
    const order = await createOrder(zodValidation.data);
    res.status(200).json({
      success:true,
      data:order
    })
  } catch (e) {
    res.status(400).json({
      success: false,
      data: "error while fetching balance"
    })
  }
}

export async function getBalanceController(req: Request, res: Response) {
  try {
    const balance = await getBalanceService(req.userId!);
    res.status(200).json({
      success:true,
      data:balance
    })
  } catch (e) {
    res.status(400).json({
      success: false,
      data: "error while fetching balance"
    })
  }
}


export async function getPositionsController(req: Request, res: Response) {
  try {
    const market = req.params["market"] as string;
    console.log("inside contrller of positions ---->",market);
    
    const positions = await getPositionsService(req.userId!,market);
    res.status(200).json({
      success:true,
      data:positions
    })
  } catch (e) {
    res.status(400).json({
      success: false,
      data: "error while fetching positions"
    })
  }
}