import { Router } from "express";
import { signInController, signupController } from "../controllers/auth-controller";

export const authRouter = Router()

authRouter.post("/signin",signInController)

authRouter.post("/signup",signupController)
