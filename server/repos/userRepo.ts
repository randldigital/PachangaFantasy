import {
  users,
  type User,
  type InsertUser,
} from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../env";

export async function getUser(id: number): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user || undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user || undefined;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user || undefined;
}

export async function createUser(insertUser: InsertUser): Promise<User> {
  const hashedPassword = await bcrypt.hash(insertUser.password, 10);
  const [user] = await db
    .insert(users)
    .values({
      username: insertUser.username,
      email: insertUser.email,
      password: hashedPassword,
    })
    .returning();
  return user;
}

export async function setAvatarPath(
  userId: number,
  avatarPath: string | null,
): Promise<User | undefined> {
  const [updated] = await db
    .update(users)
    .set({ avatarPath })
    .where(eq(users.id, userId))
    .returning();
  return updated || undefined;
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ user: User; token: string } | null> {
  const user = await getUserByEmail(email);
  if (!user) {
    return null;
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return null;
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  return { user, token };
}
