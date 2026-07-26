import { Router } from "express";
import { eq, and, ne } from "drizzle-orm";
import multer from "multer";
import { db, mediaUploadsTable } from "@workspace/db";
import { authenticate, requireAdmin } from "../middlewares/authenticate";
import { uploadToCloudinary, deleteFromCloudinary, isCloudinaryConfigured } from "../lib/cloudinary";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function parseId(raw: unknown): number | null {
  const n = parseInt(String(raw ?? ""), 10);
  return n > 0 ? n : null;
}

function cloudinaryResourceType(mediaType: string): "image" | "video" | "raw" {
  if (mediaType === "video_url") return "video";
  if (mediaType === "image_url") return "image";
  return "image";
}

// ── List media ────────────────────────────────────────────────────────────────
router.get("/media", authenticate, async (req, res): Promise<void> => {
  const isAdmin = req.userRole === "admin";
  const rows = await db
    .select()
    .from(mediaUploadsTable)
    .where(isAdmin ? ne(mediaUploadsTable.status, "deleted") : eq(mediaUploadsTable.status, "published"));
  res.json(rows);
});

// ── Create media (URL-based, no file upload) ──────────────────────────────────
router.post("/media", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { title, description, mediaType, url, thumbnailUrl, category } = req.body as Record<string, string>;
  if (!title || !mediaType || !url) {
    res.status(400).json({ error: "title, mediaType and url are required" });
    return;
  }
  const [row] = await db.insert(mediaUploadsTable).values({
    createdBy: req.userId!,
    title, description: description ?? null, mediaType, url,
    thumbnailUrl: thumbnailUrl ?? null, category: category ?? null,
    status: "draft",
  }).returning();
  res.status(201).json(row);
});

// ── Upload file to Cloudinary (new item) ──────────────────────────────────────
router.post(
  "/media/upload",
  authenticate,
  requireAdmin,
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!isCloudinaryConfigured()) {
      res.status(503).json({ error: "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET." });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const { title, description, mediaType, category } = req.body as Record<string, string>;
    if (!title || !mediaType) {
      res.status(400).json({ error: "title and mediaType are required" });
      return;
    }

    const resourceType = cloudinaryResourceType(mediaType);
    const uploaded = await uploadToCloudinary(req.file.buffer, { resource_type: resourceType });

    const [row] = await db.insert(mediaUploadsTable).values({
      createdBy: req.userId!,
      title,
      description: description ?? null,
      mediaType,
      url: uploaded.url,
      thumbnailUrl: null,
      cloudinaryPublicId: uploaded.public_id,
      category: category ?? null,
      status: "draft",
    }).returning();

    res.status(201).json(row);
  },
);

// ── Replace file for existing item (upload new file, delete old from Cloudinary) ─
router.post(
  "/media/:id/replace",
  authenticate,
  requireAdmin,
  upload.single("file"),
  async (req, res): Promise<void> => {
    const id = parseId(req.params["id"]);
    if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
    if (!isCloudinaryConfigured()) {
      res.status(503).json({ error: "Cloudinary is not configured." });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const [existing] = await db.select().from(mediaUploadsTable).where(eq(mediaUploadsTable.id, id));
    if (!existing || existing.status === "deleted") {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Delete old Cloudinary asset if it exists
    if (existing.cloudinaryPublicId) {
      await deleteFromCloudinary(existing.cloudinaryPublicId, cloudinaryResourceType(existing.mediaType));
    }

    const resourceType = cloudinaryResourceType(existing.mediaType);
    const uploaded = await uploadToCloudinary(req.file.buffer, { resource_type: resourceType });

    const [row] = await db.update(mediaUploadsTable)
      .set({ url: uploaded.url, cloudinaryPublicId: uploaded.public_id, thumbnailUrl: null, updatedAt: new Date() })
      .where(eq(mediaUploadsTable.id, id))
      .returning();

    res.json(row);
  },
);

// ── Update metadata ────────────────────────────────────────────────────────────
router.patch("/media/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const { title, description, mediaType, url, thumbnailUrl, category } = req.body as Record<string, string>;
  const [row] = await db.update(mediaUploadsTable)
    .set({ title, description, mediaType, url, thumbnailUrl, category, updatedAt: new Date() })
    .where(and(eq(mediaUploadsTable.id, id), ne(mediaUploadsTable.status, "deleted")))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

// ── Publish / Unpublish ────────────────────────────────────────────────────────
router.post("/media/:id/publish", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(mediaUploadsTable)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(mediaUploadsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/media/:id/unpublish", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(mediaUploadsTable)
    .set({ status: "unpublished", updatedAt: new Date() })
    .where(eq(mediaUploadsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

// ── Delete (permanent removes from Cloudinary too) ────────────────────────────
router.delete("/media/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const permanent = req.query["permanent"] === "true";

  if (permanent) {
    const [existing] = await db.select().from(mediaUploadsTable).where(eq(mediaUploadsTable.id, id));
    if (existing?.cloudinaryPublicId) {
      await deleteFromCloudinary(existing.cloudinaryPublicId, cloudinaryResourceType(existing.mediaType));
    }
    await db.delete(mediaUploadsTable).where(eq(mediaUploadsTable.id, id));
  } else {
    await db.update(mediaUploadsTable)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(mediaUploadsTable.id, id));
  }
  res.sendStatus(204);
});

export default router;
