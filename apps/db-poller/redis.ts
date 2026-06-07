import { createClient } from "redis";

export const redis = await createClient().on('error',(err)=>{console.log("redis client error",err)}).connect();

