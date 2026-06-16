import process from "node:process";
import { CustomEditor, type ExtensionAPI, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { matchesKey, type EditorTheme, type TUI } from "@earendil-works/pi-tui";
import { ImageAttachRuntime } from "./runtime";

type UiApi = {
  notify: (message: string, level?: "info" | "warning" | "error") => void;
  setWidget: (name: string, value?: string[]) => void;
  setStatus: (name: string, value?: string) => void;
  pasteToEditor: (text: string) => void;
  getEditorText: () => string;
  setEditorText: (text: string) => void;
};

class PasteImageEditor extends CustomEditor {
  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    private readonly runtime: ImageAttachRuntime,
    private readonly ui: UiApi,
  ) {
    super(tui, theme, keybindings);
    this.onPasteImage = () => {
      void this.runtime.paste({ ui: this.ui });
    };
  }

  override handleInput(data: string): void {
    if (matchesKey(data, "escape") && this.runtime.clear(this.ui)) {
      return;
    }

    if (matchesKey(data, "backspace") && this.getText().length === 0 && this.runtime.clear(this.ui)) {
      return;
    }

    super.handleInput(data);
  }
}

export default function (pi: ExtensionAPI) {
  const runtime = new ImageAttachRuntime(process.platform as NodeJS.Platform);

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setWidget("pi-image-attach", undefined);
    ctx.ui.setStatus("pi-image-attach", "pi-image-attach loaded");
    ctx.ui.notify("pi-image-attach loaded", "info");
    const ui = ctx.ui;
    ctx.ui.setEditorComponent((tui, theme, keybindings) => new PasteImageEditor(tui, theme, keybindings, runtime, ui));
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setEditorComponent(undefined);
  });

  pi.registerCommand("paste-image", {
    description: "Paste an image from the clipboard into pi",
    handler: async (_args, ctx) => {
      await runtime.paste(ctx);
    },
  });

  pi.registerCommand("clear-images", {
    description: "Clear queued image attachments",
    handler: async (_args, ctx) => {
      runtime.clear(ctx.ui);
    },
  });

  pi.on("input", async (event, ctx) => runtime.handleInput(event, ctx));
}
