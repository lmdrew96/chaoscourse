import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export type SourceFormat = "pdf" | "docx";

const detectFormat = (fileName: string, buffer: Buffer): SourceFormat => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";

  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF") {
    return "pdf";
  }
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return "docx";
  }

  throw new Error(
    `Unsupported file format for "${fileName}" — expected .pdf or .docx`,
  );
};

export const extractPdfText = async (buffer: Buffer): Promise<string> => {
  const result = await pdfParse(buffer);
  return result.text;
};

export const extractDocxText = async (buffer: Buffer): Promise<string> => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
};

export const extractText = async (
  buffer: Buffer,
  fileName: string,
): Promise<{ text: string; format: SourceFormat }> => {
  const format = detectFormat(fileName, buffer);
  const text = format === "pdf"
    ? await extractPdfText(buffer)
    : await extractDocxText(buffer);
  return { text, format };
};
