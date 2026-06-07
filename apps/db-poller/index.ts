import type { engineResponse } from "@repo/common";
import { redis } from "./redis";

console.log("Hello via Bun!");

try{
    await redis.xGroupCreate("engine-backend","db-poller-group","$",// use 0 if you want all the events , $ gives only the latest from when the this server is started
        {MKSTREAM:true} // this will Create the stream if missing, otherwise use the existing one.
    );
}catch(e){
    console.log("error while creating the group",e);
}


async function loop(){ // try to make this async , but remember async itself doesnt make it separat thread
    console.log("inside loop");
    while(true){
        const event = await redis.xReadGroup("db-poller-group","worker-1",{id:'>',key:"engine-backend"},{COUNT:1,BLOCK:4000});
        // todo : define engineRes type for sure
        console.log("event logged man, just put in db ----->",event);
        if(!event) continue;
        // db write
        console.log(JSON.stringify(event[0].messages[0].message));
        const engineRes = JSON.parse(event[0].messages[0].message["data-33"]) as engineResponse;
        console.log("engineRes--->",engineRes);
        
        // acknowledge back otherwise the messages remains in pending entries lists

        
    }
}

loop();
console.log("hello");
