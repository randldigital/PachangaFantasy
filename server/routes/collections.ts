import fs from "node:fs/promises";
import type { Express, Response } from "express";
import multer from "multer";
import { z } from "zod";
import {
  isCardRarity,
  isCardStatus,
  isCardType,
  type CardRarity,
  type CardStatus,
  type CardType,
} from "@shared/domain/collection";
import { logger } from "../logger";
import { isAdmin, loadClubMember, loadLeagueMember, rejectUnlessAdmin } from "../middleware/access";
import { requireAuth, requireUser } from "../middleware/auth";
import * as clubRepo from "../repos/clubRepo";
import * as collectionRepo from "../repos/collectionRepo";
import * as leagueRepo from "../repos/leagueRepo";
import type { AuthRequest } from "../types";
import type { Collection } from "@shared/schema";
import { compressAvatar } from "./avatars";

const UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMIT_BYTES, files: 1 },
});

const extraFields = z.object({
  title: z.string().trim().min(1).max(60),
  subtitle: z.string().trim().max(80).optional().default(""),
  body: z.string().trim().max(280).optional().default(""),
  rarity: z.enum(["common", "rare", "epic", "legendary"]),
});

const extraPatch = z.object({
  title: z.string().trim().min(1).max(60).optional(),
  subtitle: z.string().trim().max(80).optional(),
  body: z.string().trim().max(280).optional(),
  rarity: z.enum(["common", "rare", "epic", "legendary"]).optional(),
});

function albumQuery(req: AuthRequest) {
  const season = typeof req.query.season === "string" && req.query.season.length > 0 ? req.query.season : undefined;
  const cardType = isCardType(req.query.type) ? (req.query.type as CardType) : undefined;
  const rarity = isCardRarity(req.query.rarity) ? (req.query.rarity as CardRarity) : undefined;
  const status = isCardStatus(req.query.status) ? (req.query.status as CardStatus) : undefined;
  const owned = req.query.owned === "1" ? true : req.query.owned === "0" ? false : undefined;
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;
  const parsedLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  return { season, cardType, rarity, status, owned, cursor, limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined };
}

async function readImage(req: AuthRequest): Promise<{ buffer: Buffer } | { error: string }> {
  const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
  if (!file) {
    return { error: "An image file is required" };
  }
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    return { error: "Only JPEG, PNG, and WebP images are accepted" };
  }
  try {
    return { buffer: await compressAvatar(file.buffer) };
  } catch {
    return { error: "Only JPEG, PNG, and WebP images are accepted" };
  }
}

export function registerCollectionRoutes(app: Express) {
  app.post("/api/leagues/:id/collection", requireAuth, async (req: AuthRequest, res: Response) => {
    const access = await loadLeagueMember(req, res, parseInt(req.params.id));
    if (!access) return;
    if (rejectUnlessAdmin(res, access.league, access.user.id, "Only the administrator can create the collection")) {
      return;
    }
    try {
      const collection = await collectionRepo.createCollection({
        leagueId: access.league.id,
        createdBy: access.user.id,
      });
      res.status(201).json({ collection });
    } catch (error) {
      if (error instanceof collectionRepo.CollectionExistsError) {
        return res.status(409).json({ message: "This collection already exists", code: "COLLECTION_EXISTS" });
      }
      logger.error("Create league collection error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/clubs/:id/collection", requireAuth, async (req: AuthRequest, res: Response) => {
    const access = await loadClubMember(req, res, parseInt(req.params.id));
    if (!access) return;
    if (rejectUnlessAdmin(res, access.club, access.user.id, "Only the administrator can create the collection")) {
      return;
    }
    try {
      const collection = await collectionRepo.createCollection({
        clubId: access.club.id,
        createdBy: access.user.id,
      });
      res.status(201).json({ collection });
    } catch (error) {
      if (error instanceof collectionRepo.CollectionExistsError) {
        return res.status(409).json({ message: "This collection already exists", code: "COLLECTION_EXISTS" });
      }
      logger.error("Create club collection error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/leagues/:id/collection", requireAuth, async (req: AuthRequest, res: Response) => {
    const access = await loadLeagueMember(req, res, parseInt(req.params.id));
    if (!access) return;
    await sendAlbum(res, await collectionRepo.getByLeague(access.league.id), access.user.id, req);
  });

  app.get("/api/clubs/:id/collection", requireAuth, async (req: AuthRequest, res: Response) => {
    const access = await loadClubMember(req, res, parseInt(req.params.id));
    if (!access) return;
    await sendAlbum(res, await collectionRepo.getByClub(access.club.id), access.user.id, req);
  });

  app.post("/api/leagues/:id/collection/packs/open", requireAuth, async (req: AuthRequest, res: Response) => {
    const access = await loadLeagueMember(req, res, parseInt(req.params.id));
    if (!access) return;
    await openPack(res, await collectionRepo.getByLeague(access.league.id), access.user.id);
  });

  app.post("/api/clubs/:id/collection/packs/open", requireAuth, async (req: AuthRequest, res: Response) => {
    const access = await loadClubMember(req, res, parseInt(req.params.id));
    if (!access) return;
    await openPack(res, await collectionRepo.getByClub(access.club.id), access.user.id);
  });

  app.post("/api/leagues/:id/collection/repair", requireAuth, async (req: AuthRequest, res: Response) => {
    const access = await loadLeagueMember(req, res, parseInt(req.params.id));
    if (!access) return;
    if (rejectUnlessAdmin(res, access.league, access.user.id, "Only the administrator can repair the collection")) {
      return;
    }
    await repair(res, await collectionRepo.getByLeague(access.league.id));
  });

  app.post("/api/clubs/:id/collection/repair", requireAuth, async (req: AuthRequest, res: Response) => {
    const access = await loadClubMember(req, res, parseInt(req.params.id));
    if (!access) return;
    if (rejectUnlessAdmin(res, access.club, access.user.id, "Only the administrator can repair the collection")) {
      return;
    }
    await repair(res, await collectionRepo.getByClub(access.club.id));
  });

  app.post(
    "/api/leagues/:id/collection/extras",
    requireAuth,
    upload.single("image"),
    async (req: AuthRequest, res: Response) => {
      const access = await loadLeagueMember(req, res, parseInt(req.params.id));
      if (!access) return;
      await createExtra(req, res, await collectionRepo.getByLeague(access.league.id), access.league, access.user.id);
    },
  );

  app.post(
    "/api/clubs/:id/collection/extras",
    requireAuth,
    upload.single("image"),
    async (req: AuthRequest, res: Response) => {
      const access = await loadClubMember(req, res, parseInt(req.params.id));
      if (!access) return;
      await createExtra(req, res, await collectionRepo.getByClub(access.club.id), access.club, access.user.id);
    },
  );

  app.patch(
    "/api/collections/cards/:cardId",
    requireAuth,
    upload.single("image"),
    async (req: AuthRequest, res: Response) => {
      await updateExtra(req, res);
    },
  );

  app.delete("/api/collections/cards/:cardId", requireAuth, async (req: AuthRequest, res: Response) => {
    await removeExtra(req, res);
  });

  app.get("/api/collections/cards/:cardId/image", requireAuth, async (req: AuthRequest, res: Response) => {
    const cardId = parseInt(req.params.cardId);
    const card = Number.isNaN(cardId) ? undefined : await collectionRepo.getCard(cardId);
    if (!card?.imagePath) {
      return res.status(404).json({ message: "Image not found", code: "NOT_FOUND" });
    }
    const collection = await collectionRepo.getCollection(card.collectionId);
    if (!collection || !(await canRead(req, collection))) {
      return res.status(404).json({ message: "Image not found", code: "NOT_FOUND" });
    }
    const file = collectionRepo.extraImageFile(card.imagePath);
    if (!file) {
      return res.status(404).json({ message: "Image not found", code: "NOT_FOUND" });
    }
    try {
      const body = await fs.readFile(file);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=60");
      return res.send(body);
    } catch {
      return res.status(404).json({ message: "Image not found", code: "NOT_FOUND" });
    }
  });
}

async function sendAlbum(res: Response, collection: Collection | undefined, viewerId: number, req: AuthRequest) {
  if (!collection) {
    return res.json({ collection: null, cards: [], nextCursor: null, pack: null });
  }
  try {
    res.json(await collectionRepo.getAlbum(collection, { ...albumQuery(req), viewerId }));
  } catch (error) {
    logger.error("Collection album error", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function openPack(res: Response, collection: Collection | undefined, userId: number) {
  if (!collection) {
    return res.status(404).json({ message: "Collection not found", code: "COLLECTION_NOT_FOUND" });
  }
  try {
    res.json(await collectionRepo.openPack(collection.id, userId));
  } catch (error) {
    if (error instanceof collectionRepo.PackCooldownError) {
      return res.status(409).json({
        message: "The next pack is not ready",
        code: "PACK_COOLDOWN",
        nextPackAt: error.nextPackAt.toISOString(),
      });
    }
    if (error instanceof collectionRepo.PackEmptyError) {
      return res.status(409).json({ message: "There are no cards to open", code: "PACK_EMPTY" });
    }
    logger.error("Pack open error", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function repair(res: Response, collection: Collection | undefined) {
  if (!collection) {
    return res.status(404).json({ message: "Collection not found", code: "COLLECTION_NOT_FOUND" });
  }
  try {
    await collectionRepo.reconcileCollection(collection.id);
    res.json({ collection, repaired: true });
  } catch (error) {
    logger.error("Collection repair error", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createExtra(
  req: AuthRequest,
  res: Response,
  collection: Collection | undefined,
  organisation: { id: number; name: string; createdBy: number; participants: number[] | null },
  userId: number,
) {
  if (!collection) {
    return res.status(404).json({ message: "Collection not found", code: "COLLECTION_NOT_FOUND" });
  }
  if (!isAdmin(organisation, userId)) {
    return res.status(403).json({ message: "Only the administrator can create an extra card", code: "ADMIN_ONLY" });
  }
  const parsed = extraFields.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
  }
  const image = await readImage(req);
  if ("error" in image) {
    return res.status(400).json({ message: image.error, code: "EXTRA_IMAGE_INVALID" });
  }
  try {
    const card = await collectionRepo.createExtra(collection.id, parsed.data, image.buffer);
    res.status(201).json({ card });
  } catch (error) {
    logger.error("Create extra card error", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function loadExtra(req: AuthRequest, res: Response) {
  const cardId = parseInt(req.params.cardId);
  const card = Number.isNaN(cardId) ? undefined : await collectionRepo.getCard(cardId);
  if (!card || card.cardType !== "extra") {
    res.status(404).json({ message: "Card not found", code: "NOT_FOUND" });
    return undefined;
  }
  const collection = await collectionRepo.getCollection(card.collectionId);
  if (!collection) {
    res.status(404).json({ message: "Card not found", code: "NOT_FOUND" });
    return undefined;
  }
  const organisation = collection.leagueId != null
    ? await leagueRepo.getLeague(collection.leagueId)
    : collection.clubId != null
      ? await clubRepo.getClub(collection.clubId)
      : undefined;
  if (!organisation) {
    res.status(404).json({ message: "Card not found", code: "NOT_FOUND" });
    return undefined;
  }
  if (!isAdmin(organisation, requireUser(req).id)) {
    res.status(403).json({ message: "Only the administrator can change an extra card", code: "ADMIN_ONLY" });
    return undefined;
  }
  return card;
}

async function updateExtra(req: AuthRequest, res: Response) {
  const card = await loadExtra(req, res);
  if (!card) return;
  const parsed = extraPatch.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
  }
  const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
  let image: Buffer | undefined;
  if (file) {
    const read = await readImage(req);
    if ("error" in read) {
      return res.status(400).json({ message: read.error, code: "EXTRA_IMAGE_INVALID" });
    }
    image = read.buffer;
  }
  try {
    const updated = await collectionRepo.updateExtra(card, parsed.data, image);
    res.json({ card: updated });
  } catch (error) {
    logger.error("Update extra card error", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function removeExtra(req: AuthRequest, res: Response) {
  const card = await loadExtra(req, res);
  if (!card) return;
  try {
    const result = await collectionRepo.deleteExtra(card);
    res.json({ result });
  } catch (error) {
    logger.error("Delete extra card error", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function canRead(req: AuthRequest, collection: Collection): Promise<boolean> {
  if (collection.leagueId != null) {
    const league = await leagueRepo.getLeague(collection.leagueId);
    return Boolean(league && (league.createdBy === requireUser(req).id || league.participants?.includes(requireUser(req).id)));
  }
  if (collection.clubId != null) {
    const club = await clubRepo.getClub(collection.clubId);
    return Boolean(club && (club.createdBy === requireUser(req).id || club.participants?.includes(requireUser(req).id)));
  }
  return false;
}
