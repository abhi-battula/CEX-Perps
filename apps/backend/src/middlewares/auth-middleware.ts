import type { NextFunction, Request, Response } from "express";
import { verifyJwt } from "../utils/auth";

export function requiredAuth(req:Request,res:Response,next:NextFunction){
    //just get the token and verify and add the username in the req object
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1] // bearere token

    if(!authHeader || !token){
        return res.status(400).json({"msg":"token missing"});
    }
    
    try{
        const userId = verifyJwt(token);
        req.userId = userId; // req object is already defined by express and its types @types/express. so in the req object they dont have a key called userId , so if you add this new key then it will complain. so  you have to declare this user id in the request object in declaration files.
        next();
    } catch(e){
        res.status(400).json({"msg":"invalid token"})
    }
    
    
}