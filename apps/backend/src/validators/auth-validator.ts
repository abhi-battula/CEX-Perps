import {z} from "zod"

export const signupSchema = z.object({
    username: z.string().trim().min(1,"username is required"),
    password: z.string().min(8)
})

export type signupInput = z.infer<typeof signupSchema>;

export const signinSchema = z.object({
    username: z.string().trim().min(1),
    password: z.string().min(8)
})

export type signinInput = z.infer<typeof signinSchema>;