import { EventType, type CreateOrder , type createOrderEngine, type engineResponse, type requestType} from "@repo/common";
import { redis } from "bun";
import { createClient } from "redis";
const producer = await createClient().on('error', err => console.log("redis client connection error", err)).connect();
const consumer = await createClient().on('error', err => console.log("redis client connection error", err)).connect();
const requests: Record<string, any> = {};

export async function createOrder(createOrderInput: CreateOrder) {// todo : for nowkeep it any but later add the above type that is createOrder
  //send to queue and wait for the response.
  console.log("inside create order service");

  const redisRes = await sendToEngine(createOrderInput,EventType.CREATE_ORDER)
  return redisRes;
}

export async function getBalanceService(userId:string){
  console.log("inside get balance service -->",userId);
  
  const redisRes = await sendToEngine(userId,EventType.GET_BALANCE)
  return redisRes;
}

export async function getPositionsService(userId:string,market:string){
  const redisRes = await sendToEngine({userId,market},EventType.GET_POSITIONS)
  return redisRes;
}

async function sendToEngine(payload:any, event:EventType) {
  const redisRes = await new Promise((resolve, reject) => { //promise
    const req_id = crypto.randomUUID().toString();
    requests[req_id] = resolve;
    const createOrderEngine: requestType = {
      event,
      data:{
        ...payload,
        userId: "test123456789", // todo : get the userId
        req_id:req_id
      }
    }
    producer.xAdd("backend-engine", "*", {"payload":JSON.stringify(createOrderEngine)});
  })
  return redisRes;
}

async function loop() {
  while (true) {
    console.log("loop start");
    
    const redisEngineRes = await consumer.xRead({ id: "$", key: "engine-backend" }, { BLOCK: 2000 });
    console.log("redisEngineRes-->",JSON.stringify(redisEngineRes));
    
    if(!redisEngineRes) continue;
    console.log("back to backend------>", JSON.stringify(redisEngineRes));
    const engineRes = JSON.parse(redisEngineRes[0].messages[0].message["data-33"]) as engineResponse;
    console.log("parsed engine Res---->",engineRes);
    console.log(requests[engineRes.req_id]);
    
    if(requests[engineRes.req_id])requests[engineRes.req_id](engineRes)
  }
}
loop();