// import express from "express"
// import { createClient } from "redis";
// import {prisma} from "db"
// import type { workflow } from "@repo/common";


// const app = express();
// app.use(express.json());
// const requests: Record<string, any> = {};

// const producer = await createClient().on('error', err => console.log("redis client error", err)).connect();
// const consumer = await createClient().on('error', err => console.log("redis client consumer error", err)).connect();

// app.post("/create", async (req, res) => {
//   const body = req.body;
//   // console.log("req--->", body);
//   // console.log("stringify---->", JSON.stringify(body));

//   // producer.xAdd("backend-engine","*",{"data-1111":"1111111111"}) // key: name of the stream , id: * redis gives default with timestamp, message:Record<string,redisArg> -> your data in string
//   const redisRes = await toEngine(body)
//   // res.json("ok bro , fire and wait",redisRes)
//   res.json({ msg: "ok bro , fire and wait", redisRes })
// })

// async function toEngine(body: any) {
//   const req_id = Math.random().toString();
//   const redisRes = await new Promise((resolve, reject) => {

//     requests[req_id] = resolve;
//     const payload = { ...body, req_id }
//     console.log("req_id--->",req_id);
    
//     producer.xAdd("backend-engine", "*", { "data-22": JSON.stringify(payload) })

//   })
//   return redisRes;
// }

// // first write while loop in async funcitn but later put the while loop in main thread or top level code.
// async function readStream() {
//   console.log("inside readStream");

//   while (true) {
//     const redisRes = await consumer.xRead({ id: "$", key: "engine-backend"},{BLOCK:2000});
//     console.log("redisRes---->",redisRes);
    
//     if (redisRes) {
//       console.log(redisRes);
//       // const req_id = JSON.parse(redisRes)
//       const parsedRes = JSON.parse(redisRes[0].messages[0].message["data-33"])
//       const req_id = parsedRes.req_id;
//       requests[req_id](parsedRes);
//     }
//   }
// }
// readStream()

// app.listen(3000, () => { console.log("server is running on 3000") })