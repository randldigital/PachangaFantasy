import fs from "node:fs/promises";
import path from "node:path";
import type { Express, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { storageDir } from "../env";
import { logger } from "../logger";
import { requireAuth, requireUser } from "../middleware/auth";
import * as userRepo from "../repos/userRepo";
import type { AuthRequest } from "../types";

export const AVATAR_SIZE = 256;
export const AVATAR_MAX_BYTES = 80 * 1024;
const UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;
const QUALITY_STEPS = [70, 60, 50, 40, 30];

export const AVATAR_DIR = path.resolve(process.cwd(), storageDir(), "avatars");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMIT_BYTES, files: 1 },
});

/** Squares and re-encodes to JPEG, stepping quality down until it fits the size cap. */
export async function compressAvatar(input: Buffer): Promise<Buffer> {
  const base = sharp(input, { failOn: "error" })
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" });

  let encoded = await base.clone().jpeg({ quality: QUALITY_STEPS[0] }).toBuffer();
  for (const quality of QUALITY_STEPS.slice(1)) {
    if (encoded.byteLength <= AVATAR_MAX_BYTES) {
      break;
    }
    encoded = await base.clone().jpeg({ quality }).toBuffer();
  }
  return encoded;
}

function avatarFile(userId: number): string {
  return path.join(AVATAR_DIR, `${userId}.jpg`);
}

async function sendAvatar(res: Response, userId: number) {
  const user = await userRepo.getUser(userId);
  if (!user?.avatarPath) {
    return res.status(404).json({ message: "No avatar", code: "NO_AVATAR" });
  }

  const file = avatarFile(userId);
  try {
    const body = await fs.readFile(file);
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.send(body);
  } catch {
    return res.status(404).json({ message: "No avatar", code: "NO_AVATAR" });
  }
}

export function registerAvatarRoutes(app: Express) {
  app.post(
    "/api/users/me/avatar",
    requireAuth,
    upload.single("avatar"),
    async (req: AuthRequest, res: Response) => {
      try {
        const user = requireUser(req);
        const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
        if (!file) {
          return res.status(400).json({ message: "An image file is required", code: "AVATAR_REQUIRED" });
        }
        if (!file.mimetype.startsWith("image/")) {
          return res.status(400).json({ message: "Only images are accepted", code: "AVATAR_NOT_IMAGE" });
        }

        let compressed: Buffer;
        try {
          compressed = await compressAvatar(file.buffer);
        } catch {
          return res.status(400).json({ message: "Only images are accepted", code: "AVATAR_NOT_IMAGE" });
        }

        await fs.mkdir(AVATAR_DIR, { recursive: true });
        const relativePath = path.join(storageDir(), "avatars", `${user.id}.jpg`);
        await fs.writeFile(avatarFile(user.id), compressed);
        await userRepo.setAvatarPath(user.id, relativePath);

        logger.info("Avatar uploaded", { user: user.id, bytes: compressed.byteLength });
        res.json({ avatarPath: relativePath, bytes: compressed.byteLength });
      } catch (error) {
        logger.error("Avatar upload error", error);
        res.status(500).json({ message: "Failed to upload avatar" });
      }
    },
  );

  app.delete("/api/users/me/avatar", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = requireUser(req);
      await fs.rm(avatarFile(user.id), { force: true });
      await userRepo.setAvatarPath(user.id, null);
      res.json({ avatarPath: null });
    } catch (error) {
      logger.error("Avatar delete error", error);
      res.status(500).json({ message: "Failed to remove avatar" });
    }
  });

  app.get("/api/users/me/avatar", requireAuth, async (req: AuthRequest, res: Response) => {
    await sendAvatar(res, requireUser(req).id);
  });

  app.get("/api/users/:id/avatar", requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(404).json({ message: "No avatar", code: "NO_AVATAR" });
    }
    await sendAvatar(res, userId);
  });
}
