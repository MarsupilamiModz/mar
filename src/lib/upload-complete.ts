import { prisma } from "@/lib/db";
import { buildAssetPublicUrl } from "@/lib/assets";

export type UploadPurpose =
  | "mod-version"
  | "mod-screenshot"
  | "creator-portfolio"
  | "creator-banner"
  | "creator-avatar"
  | "collection-cover";

export async function finalizeUploadSession(sessionId: string, userId: string) {
  const session = await prisma.storageUploadSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.userId !== userId) {
    throw new Error("Upload session not found");
  }
  if (session.status !== "IN_PROGRESS") {
    throw new Error("Upload already finalized");
  }

  await prisma.storageUploadSession.update({
    where: { id: sessionId },
    data: { status: "COMPLETED" },
  });

  const publicUrl = buildAssetPublicUrl(session.fileKey);
  const meta = (session.metadata ?? {}) as Record<string, string>;

  switch (session.purpose as UploadPurpose) {
    case "mod-screenshot": {
      if (!session.modId) break;
      const orderIndex = await prisma.modMedia.count({ where: { modId: session.modId } });
      const hasFeatured = await prisma.modMedia.count({
        where: { modId: session.modId, isFeatured: true },
      });
      await prisma.modMedia.create({
        data: {
          modId: session.modId,
          mediaType: "IMAGE",
          imageUrl: publicUrl,
          orderIndex,
          isFeatured: hasFeatured === 0,
        },
      });
      break;
    }
    case "collection-cover": {
      const collectionId = meta.collectionId;
      if (collectionId) {
        await prisma.modCollection.update({
          where: { id: collectionId },
          data: { coverUrl: publicUrl },
        });
      }
      break;
    }
    case "creator-portfolio":
    case "creator-banner":
    case "creator-avatar":
      return { url: publicUrl, key: session.fileKey, purpose: session.purpose };
    default:
      break;
  }

  return { url: publicUrl, key: session.fileKey, purpose: session.purpose };
}
