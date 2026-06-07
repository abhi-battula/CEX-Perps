import bcrypt from "bcryptjs";
import { prisma } from "db"
import type { signinInput, signupInput } from "../validators/auth-validator"
import { createJwt } from "../utils/auth";

const signup = async function (data: signupInput) {
  //signup logic and db logic
  console.log("inside signup service ---->",data);
  
  const username = data.username
  const user = await prisma.user.findUnique({
    where: {
      username
    }
  });
  if (user) {
    throw new Error("User already exists");
  }
  const hashedPassword = await bcrypt.hash(data.password, 10);
  const newUser = await prisma.user.create({
    data: {
      username,
      password: hashedPassword
    }
  })
  const token = createJwt(newUser.userid);
  return {
    token
  }

}

const signin = async function (data:signinInput) {
  const user = await prisma.user.findUnique({where:{username: data.username}});
  if(!user){
    return {"msg":"user doesnt exist, please create"}
  }
  const isValidPassword = await bcrypt.compare(data.password,user.password);
  if(!isValidPassword){
    return {"msg":"invalid credentials"}
  }

  const token = createJwt(user.userid);
  return {token}
}

export const authService = { signup, signin }