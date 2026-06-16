export type ImageSource = "clipboard" | "drop" | "file";

export type AttachedImage = {
  data: string;
  mimeType: string;
  name?: string;
  source: ImageSource;
};

export type PiImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};
