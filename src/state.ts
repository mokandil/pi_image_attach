import { toPiImageContent, type AttachedImage, type PiImageContent } from "./normalize";

export class PendingAttachments {
  private images: AttachedImage[] = [];

  add(image: AttachedImage): void {
    this.images.push(image);
  }

  addMany(images: AttachedImage[]): void {
    this.images.push(...images);
  }

  peek(): AttachedImage[] {
    return [...this.images];
  }

  consume(): AttachedImage[] {
    const current = this.images;
    this.images = [];
    return current;
  }

  clear(): void {
    this.images = [];
  }
}

export function buildAttachmentWidgetLines(images: AttachedImage[]): string[] | undefined {
  if (images.length === 0) return undefined;

  const lines = [images.length === 1 ? "📎 1 image queued" : `📎 ${images.length} images queued`];
  for (const image of images.slice(0, 3)) {
    lines.push(`• ${image.name ?? image.source}`);
  }
  if (images.length > 3) {
    lines.push(`• +${images.length - 3} more`);
  }
  return lines;
}

export function syncAttachmentUi(ui: {
  setWidget: (name: string, value?: string[]) => void;
  setStatus: (name: string, value?: string) => void;
}, images: AttachedImage[]): void {
  ui.setWidget("pi-image-attach", buildAttachmentWidgetLines(images));
  ui.setStatus("pi-image-attach", images.length ? `📎 ${images.length} queued` : undefined);
}

export function toPiImages(images: AttachedImage[]): PiImageContent[] {
  return images.map(toPiImageContent);
}
