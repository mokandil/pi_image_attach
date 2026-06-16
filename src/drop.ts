import fs from "node:fs/promises";
import path from "node:path";
import { isImagePath, normalizeAttachment, stripWrappingQuotes, toPiImageContent } from "./normalize";
import type { PiImageContent } from "./types";

function tokenizeShellLike(text: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of text.trim()) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

export function parseDroppedPaths(text: string): string[] {
  return tokenizeShellLike(text).map(stripWrappingQuotes);
}

export async function collectDroppedImages(input: {
  text: string;
  signal?: AbortSignal;
  readFile?: (filePath: string, options?: { signal?: AbortSignal }) => Promise<Buffer>;
}): Promise<{ cleanedText: string; images: PiImageContent[]; hadImageTokens: boolean }> {
  const tokens = tokenizeShellLike(input.text);
  const imageTokens = tokens.filter((token) => isImagePath(token));

  if (imageTokens.length === 0) {
    return { cleanedText: input.text, images: [], hadImageTokens: false };
  }

  const readFile = input.readFile ?? ((filePath: string, options?: { signal?: AbortSignal }) => fs.readFile(filePath, options));
  const images: PiImageContent[] = [];

  for (const token of imageTokens) {
    const filePath = stripWrappingQuotes(token);
    try {
      const bytes = await readFile(filePath, { signal: input.signal });
      const image = normalizeAttachment({
        data: bytes,
        source: "drop",
        name: path.basename(filePath),
      });
      images.push(toPiImageContent(image));
    } catch {
      // Ignore read failures; the user still gets a graceful fallback.
    }
  }

  const cleanedText = tokens.filter((token) => !isImagePath(token)).join(" ").trim();
  return { cleanedText, images, hadImageTokens: true };
}
