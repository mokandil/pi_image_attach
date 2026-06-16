import process from "node:process";
import { readClipboardImage, readClipboardText } from "./clipboard";
import { collectDroppedImages } from "./drop";
import { coerceIncomingImageContent, type IncomingPiImage } from "./normalize";
import { PendingAttachments, syncAttachmentUi, toPiImages } from "./state";
import type { AttachedImage, PiImageContent } from "./types";

type UiApi = {
  notify: (message: string, level?: "info" | "warning" | "error") => void;
  setWidget: (name: string, value?: string[]) => void;
  setStatus: (name: string, value?: string) => void;
  pasteToEditor: (text: string) => void;
  getEditorText: () => string;
  setEditorText: (text: string) => void;
};

type CommandContext = { ui: UiApi; signal?: AbortSignal };

type InputEvent = { text: string; images?: IncomingPiImage[]; source?: string };

export class ImageAttachRuntime {
  private readonly pending = new PendingAttachments();

  constructor(private readonly platform: NodeJS.Platform = process.platform as NodeJS.Platform) {}

  private refresh(ui: UiApi): void {
    syncAttachmentUi(ui, this.pending.peek());
  }

  private queue(image: AttachedImage, ui: UiApi): void {
    this.pending.add(image);
    this.refresh(ui);
  }

  clear(ui: UiApi): boolean {
    const count = this.pending.peek().length;
    if (count === 0) return false;

    this.pending.clear();
    this.refresh(ui);
    ui.notify(count === 1 ? "Cleared queued image." : "Cleared queued images.", "info");
    return true;
  }

  async paste(ctx: CommandContext): Promise<void> {
    const image = await readClipboardImage({ platform: this.platform, signal: ctx.signal });
    if (image) {
      this.queue(image, ctx.ui);
      ctx.ui.notify("Image queued. Add text and press Enter.", "info");
      return;
    }

    const text = await readClipboardText({ platform: this.platform, signal: ctx.signal });
    if (text?.length) {
      ctx.ui.pasteToEditor(text);
      return;
    }

    ctx.ui.notify("Clipboard has no image or text. Use @file as fallback.", "warning");
  }

  async handleInput(
    event: InputEvent,
    ctx: CommandContext,
  ): Promise<{ action: "continue" } | { action: "transform"; text: string; images: PiImageContent[] }> {
    if (event.source === "extension" || event.text.startsWith("/")) {
      return { action: "continue" };
    }

    const pendingImages = this.pending.peek();
    const dropped = await collectDroppedImages({ text: event.text, signal: ctx.signal });
    const incomingImages = (event.images ?? []).map(coerceIncomingImageContent).filter(
      (image): image is PiImageContent => image !== null,
    );
    const images = [...incomingImages, ...toPiImages(pendingImages), ...dropped.images];
    const shouldTransform = pendingImages.length > 0 || dropped.hadImageTokens || incomingImages.length > 0;

    if (!shouldTransform) {
      return { action: "continue" };
    }

    if (pendingImages.length > 0) {
      this.pending.clear();
      this.refresh(ctx.ui);
    }

    if (dropped.hadImageTokens && dropped.images.length === 0) {
      ctx.ui.notify("Could not read one or more dropped image files. Use @file if needed.", "warning");
    }

    return { action: "transform", text: dropped.cleanedText, images };
  }
}
