import  {Router} from "express"
import { authRouter } from "./auth-routes";
import { exchangeRouter } from "./exchange-routes";


export const appRouter = Router();


appRouter.use(authRouter);
appRouter.use(exchangeRouter);
