import {z} from "zod";

export const engineRequestSchema  = z.object({
    event: z.enum(["create_order"]),
    data: z.object({})
})

export type engineRequestType = z.infer<typeof engineRequestSchema>; 