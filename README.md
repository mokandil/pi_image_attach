# pi-image-attach

Cross-platform image attach flow for pi.

## What it does
- `Ctrl+V` / `Alt+V` pastes images from the clipboard when the terminal sends that key to pi
- `Esc` clears a queued image attachment
- `Backspace` clears a queued image when the editor is empty
- text clipboard content still pastes normally
- dropped image files are attached on submit
- queued images show in a small widget above the editor
- `@file` remains the fallback for manual attachment

### Notes
- `Ctrl+V` only works when the terminal forwards it to pi; some terminals intercept it for their own paste handling.
- If `Ctrl+V` is intercepted, use `Alt+V` or `/paste-image`.

## Commands
- `/paste-image` — paste an image from clipboard
- `/clear-images` — clear queued attachments

## Install

### As a pi package
```bash
pi install npm:pi-image-attach
```

### Manual install
Place this folder in `~/.pi/agent/extensions/pi-image-attach/` and run `/reload`.
