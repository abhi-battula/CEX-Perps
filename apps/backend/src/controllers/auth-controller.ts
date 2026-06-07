import type { Request } from "express";
import express from "express"
import { authService } from "../services/auth-service";
import { signinSchema, signupSchema, type signupInput } from "../validators/auth-validator";

// controller will validate req and return if incorrect and call service and return the data.
// basically handles the status code and everything
export const signupController = async function (req: Request, res: express.Response) {

  const body = req.body;
  //validate req object
  const validation = signupSchema.safeParse(body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: validation.error
    })
  }

  try {
    const result = await authService.signup(validation.data);
    res.status(201).json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error("error raaaaa------->",error)
    res.status(400).json({
      success: false,
      data: "error while creating user"
    })
  }

}

export const signInController = async function (req: Request,res: express.Response) {
  const validatedBody = signinSchema.safeParse(req.body);
  if(!validatedBody.success){
    return res.status(400).json({"message":"invalid inputs"})
  }

  try {
    const result = await authService.signin(validatedBody.data);
    return res.status(200).json({
      success: true,
      data: result
    })
  }catch(e){
    console.log(e);
    res.status(500).json({"message":"error while signin"})
  }

}