import { createClient } from "redis";
import { WebSocket } from "ws";

const ws = new WebSocket("wss://fstream.binance.com/market/ws/solusdc@markPrice")
// import {redisclient} from "redis";
const publisher = await createClient().on('error', () => console.log("redis client error")).connect();

let MARK_PRICE: string;

ws.on('open', () => { console.log("inside open call back"); })
let count = 1;
ws.on('message', (data) => {
    console.log("===new interval created===");
    const parsedRes = JSON.parse(data.toString());
    // setTimeout(()=>{console.log(`getting msg from binance ${++count}-->`,JSON.parse(data.toString()))},5000);
    MARK_PRICE = parsedRes.P;
})

ws.on('close', () => { console.log("connection closed") })
ws.on('error', (err) => { console.log("erron in ws =====>", err) })
setInterval(async () => {
    console.log("Mark price--> ", MARK_PRICE);
    const payload = {MARK_PRICE}
    // publisher.xAdd("worker-engine","*",payload)
    const a = await publisher.xAdd("worker-engine","*",{"payload":JSON.stringify(payload)})
    console.log("aaa---------->",a);
    
}
    , 2000)
console.log("Hello via Bun!");