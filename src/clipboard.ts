import { execFile as execFileCallback } from "node:child_process";
import { detectImageMime, normalizeAttachment } from "./normalize";

function execBuffer(command: string, args: string[], signal?: AbortSignal): Promise<Buffer | null> {
  return new Promise((resolve) => {
    execFileCallback(command, args, { encoding: "buffer", maxBuffer: 20 * 1024 * 1024, signal } as never, (error, stdout) => {
      if (error || !stdout || (Buffer.isBuffer(stdout) && stdout.length === 0)) {
        resolve(null);
        return;
      }

      resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout));
    });
  });
}

function execText(command: string, args: string[], signal?: AbortSignal): Promise<string | null> {
  return new Promise((resolve) => {
    execFileCallback(command, args, { encoding: "utf8", maxBuffer: 5 * 1024 * 1024, signal } as never, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }

      const text = typeof stdout === "string" ? stdout : String(stdout ?? "");
      resolve(text.length ? text : null);
    });
  });
}

const macImageScript = [
  "import AppKit",
  "let pb = NSPasteboard.general",
  "if let image = NSImage(pasteboard: pb), let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) { FileHandle.standardOutput.write(png) }",
].join("; ");

const windowsImageScript = [
  "Add-Type -AssemblyName System.Windows.Forms",
  "Add-Type -AssemblyName System.Drawing",
  "$image = [System.Windows.Forms.Clipboard]::GetImage()",
  "if ($null -ne $image) { $stream = New-Object System.IO.MemoryStream; $image.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png); $bytes = $stream.ToArray(); [Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length) }",
].join("; ");

async function readDarwinImage(signal?: AbortSignal): Promise<Buffer | null> {
  const swift = await execBuffer("swift", ["-e", macImageScript], signal);
  if (swift?.length) return swift;

  return execBuffer("pngpaste", ["-"], signal);
}

async function readWindowsImage(signal?: AbortSignal): Promise<Buffer | null> {
  return execBuffer("powershell", ["-NoProfile", "-STA", "-Command", windowsImageScript], signal);
}

async function readLinuxImage(signal?: AbortSignal): Promise<Buffer | null> {
  const wayland = await execBuffer("wl-paste", ["--type", "image/png"], signal);
  if (wayland?.length) return wayland;

  return execBuffer("xclip", ["-selection", "clipboard", "-t", "image/png", "-o"], signal);
}

async function readDarwinText(signal?: AbortSignal): Promise<string | null> {
  return execText("pbpaste", [], signal);
}

async function readWindowsText(signal?: AbortSignal): Promise<string | null> {
  return execText("powershell", ["-NoProfile", "-Command", "Get-Clipboard -Raw"], signal);
}

async function readLinuxText(signal?: AbortSignal): Promise<string | null> {
  const wayland = await execText("wl-paste", ["-n"], signal);
  if (wayland) return wayland;

  return execText("xclip", ["-selection", "clipboard", "-o"], signal);
}

export async function readClipboardImage(options: {
  platform: NodeJS.Platform;
  signal?: AbortSignal;
}): Promise<ReturnType<typeof normalizeAttachment> | null> {
  const bytes =
    options.platform === "darwin"
      ? await readDarwinImage(options.signal)
      : options.platform === "win32"
        ? await readWindowsImage(options.signal)
        : options.platform === "linux"
          ? await readLinuxImage(options.signal)
          : null;

  if (!bytes?.length) return null;

  const mimeType = detectImageMime(bytes);
  if (!mimeType) return null;

  return normalizeAttachment({
    data: bytes,
    mimeType,
    source: "clipboard",
    name: "clipboard-image",
  });
}

export async function readClipboardText(options: {
  platform: NodeJS.Platform;
  signal?: AbortSignal;
}): Promise<string | null> {
  if (options.platform === "darwin") return readDarwinText(options.signal);
  if (options.platform === "win32") return readWindowsText(options.signal);
  if (options.platform === "linux") return readLinuxText(options.signal);
  return null;
}
