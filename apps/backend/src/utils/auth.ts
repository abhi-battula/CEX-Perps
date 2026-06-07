import jwt from "jsonwebtoken"

export interface TokenPayload {
  userId: string;
}

const jwtSecret = process.env["JWT_SECRET"]!;
export function createJwt(userId: string): string {

  console.log("jwt secrettttttt------->", jwtSecret);

  const token = jwt.sign({ userId }, jwtSecret, { expiresIn: "7d" })
  return token;
}

export function verifyJwt(token: string) {
  console.log("inside verifyJwt with token", token);

    const isValid = jwt.verify(token, jwtSecret) as TokenPayload;
    return isValid.userId;
    

}