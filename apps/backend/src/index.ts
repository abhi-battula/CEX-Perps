import express  from "express";
import { appRouter } from "./routes/router";

const app = express();
app.use(express.json())

app.use(appRouter);


app.listen(3000,()=>{
    console.log("listening on port 3000");
    
})