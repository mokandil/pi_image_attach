import path from "node:path";
import type { AttachedImage, PiImageContent } from "./types";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

export function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function isImagePath(value: string): boolean {
  const clean = stripWrappingQuotes(value);
  return IMAGE_EXTENSIONS.has(path.extname(clean).toLowerCase());
}

export function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 8) {
    const png = buffer.subarray(0, 8);
    if (png.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return "image/png";
    }
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "GIF8") {
    return "image/gif";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export function normalizeAttachment(input: {
  data: Buffer;
  source: AttachedImage["source"];
  mimeType?: string | null;
  name?: string;
}): AttachedImage {
  const mimeType = input.mimeType ?? detectImageMime(input.data);
  if (!mimeType) {
    throw new Error("Unsupported image bytes");
  }

  return {
    data: input.data.toString("base64"),
    mimeType,
    name: input.name,
    source: input.source,
  };
}

export type IncomingPiImage = {
  type: "image";
  data?: string;
  mimeType?: string;
  source?: {
    type: "base64";
    data?: string;
    mediaType?: string;
  };
};

export function coerceIncomingImageContent(image: IncomingPiImage): PiImageContent | null {
  const data = image.data ?? image.source?.data;
  let mimeType = image.mimeType ?? image.source?.mediaType;

  if (!data) {
    return null;
  }

  if (!mimeType) {
    const bytes = Buffer.from(data, "base64");
    mimeType = detectImageMime(bytes) ?? undefined;
  }

  if (!mimeType) {
    return null;
  }

  return {
    type: "image",
    data,
    mimeType,
  };
}

export function toPiImageContent(image: AttachedImage): PiImageContent {
  return {
    type: "image",
    data: image.data,
    mimeType: image.mimeType,
  };
}
