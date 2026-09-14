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

export function createUser(insertUser: InsertUser): Promise<User> {
  return createVerifiedUser(insertUser, false);
}

export async function createVerifiedUser(
  insertUser: InsertUser,
  verified: boolean,
): Promise<User> {
  const password = insertUser.password;
  if (!password) {
    throw new Error("Password required");
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({
      username: insertUser.username,
      email: insertUser.email,
      password: hashedPassword,
      emailVerifiedAt: verified ? new Date() : null,
    })
    .returning();
  return user;
}

export async function markEmailVerified(userId: number): Promise<User | undefined> {
  const [updated] = await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated || undefined;
}

export async function setPassword(
  userId: number,
  password: string,
): Promise<User | undefined> {
  const hashedPassword = await bcrypt.hash(password, 10);
  const [updated] = await db
    .update(users)
    .set({ password: hashedPassword })
    .where(eq(users.id, userId))
    .returning();
  return updated || undefined;
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
  if (!user || !user.password) {
    return null;
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return null;
  }

  return { user, token: signUserToken(user) };
}

export function signUserToken(user: { id: number; email: string }): string {
  return jwt.sign({ userId: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: "7d" });
}
