import { createClient } from "redis";
import { engineRequestSchema } from "./types/types";
// import { MARK_PRICE } from "./types/exchange.types";
import { createOrderEngineSchema, EventType, type engineResponse, type requestType } from "@repo/common";
import { createOrder } from "./matching-engine";
import { liquidationLoop } from "./liquidation-engine";
import { manageRoute } from "./managing-route";

const backendConsumer = createClient({ url: "" })
backendConsumer.on('error', err => console.log("redis client error", err));
backendConsumer.connect()

const priceConsumer = createClient({ url: "" })
priceConsumer.on('error', err => console.log("redis client error", err));
priceConsumer.connect()
const producer = await createClient().on('error', err => console.log("redis producre client error", err)).connect();
// while loop , which will pull the payload and current price from the redis stream and do the work.
// so create the redis stream and let the worker/ws pull the data to stream 

let MARK_PRICE = 0;


async function backendLoop() {
    while (true) {
        // const response = await consumer.xReadGroup("engine",`engine-${Math.random()}`,[{id:">",key:"backend-engine"}])    // this is basically for consuemr group. the first arg is for which group you are consuming , the second is of which consumer/worker is consuming it ,and third is from which stream you want to consume.

        // const response = await consumer.xRead({id:">",key:"backend-engine"},{BLOCK:100,COUNT:1}) // from which stream and from where 

        const response = await backendConsumer.xRead({ id: "$", key: "backend-engine" }, { BLOCK: 5000 })
        if (!response) continue;
        console.log("prinitng respnose from engine------>", response);
        console.log("************", JSON.stringify(response));
        // const parsedRes = JSON.parse(response[0]);
        const parsedRes = JSON.parse(response[0].messages[0].message["payload"]) as requestType;


        // new
        const {status,msg,data} = manageRoute(parsedRes)

        // const engineRequestValidation = createOrderEngineSchema.safeParse(parsedRes)
        // if (!engineRequestValidation.success) {
        //     console.log("####faild");
        //     continue;
        // }

        // const engineRes = createOrder(engineRequestValidation.data)
        const req_id = parsedRes.data.req_id
        const engineRes:engineResponse = {
            event:parsedRes.event,
            status,
            msg,
            data,
            req_id
        } // todo : we should have proper response format.
        console.log("engine res--->", engineRes);
        // if(!answer){
        //     // todo : if answer is undefined then think and send some msg like failed or something else
        //     producer.xAdd("engine-backend", "*", { "data-33": JSON.stringify(engineRes) });
        //     continue;
        // }
        producer.xAdd("engine-backend", "*", { "data-33": JSON.stringify(engineRes) }); // i think this id is not necessary , check once
        if(parsedRes.event==="create_order" && status){
            // you need to add 2 items in the queue , one is create_order and the other is fills
            // in this if condtino just add fills, you need fillIds array here
            const engineRes:engineResponse = {
                event: EventType.ADD_FILLS,
                status: true,
                msg: "",
                req_id: "",
                data:data?.currentFills!
            }
            console.log("inside if block , so sending fills to stream-->",engineRes);
            producer.xAdd("engine-backend", "*", { "data-33": JSON.stringify(engineRes) });
        }
    }
}

async function priceLoop() {
    console.log("inside priceloop");

    while (true) {
        const response = await priceConsumer.xRead({ id: "$", key: "worker-engine" }, { BLOCK: 2000 });
        if (!response) continue;
        // console.log("************", JSON.stringify(response));
        const parsedRes = JSON.parse(response[0].messages[0].message["payload"]);
        // console.log("parsedREs------>",parsedRes);
        MARK_PRICE = Number(parsedRes.MARK_PRICE);
        liquidationLoop(MARK_PRICE);
        // console.log("MARK_PRICE------>",MARK_PRICE);

    }
}
backendLoop();
priceLoop();






// todo after break:
// start redis , and check if data is coming from stream to engine , if yes
// the todo : 1) modify the data and send it back. 2) get the data in backend and call the resolver based on req_id 
console.log("hello from bun 77");