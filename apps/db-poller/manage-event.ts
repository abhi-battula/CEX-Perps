import type { engineResponse } from "@repo/common";
import { createFill, createOrder } from "./util";


export async function manageEvent(event:engineResponse){

    switch(event.event){
        case "create_order":
            // do db write method and return
            createOrder(event.data)
        case "add_fills":
            // do db write to fills , you will get fills[]
            createFill(event.data as [])
    }
}