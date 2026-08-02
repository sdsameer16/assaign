import { getFileExtension } from "./cloudinary";

export type PageCountSource = "pdf" | "image" | "office";

export type PageCountResult = {
  estimated: number;
  billed: number;
  source: PageCountSource;
};

const IMAGE_EXTS = new Set(["jpeg", "jpg", "png"]);
const OFFICE_EXTS = new Set(["doc", "docx", "xls", "xlsx"]);

function billOffice(estimated: number): PageCountResult {
  const est = Math.max(1, Math.ceil(estimated));
  return { estimated: est, billed: est + 2, source: "office" };
}

async function countPdfPages(file: File): Promise<PageCountResult> {
  const pdfjs = await import("pdfjs-dist");
  // Use CDN worker matching installed pdfjs major version
  const version = (pdfjs as { version?: string }).version || "4.10.38";
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = doc.numPages || 1;
  try {
    if (typeof (doc as { cleanup?: () => void }).cleanup === "function") {
      (doc as { cleanup: () => void }).cleanup();
    }
  } catch {
    // ignore
  }
  const estimated = Math.max(1, pages);
  return { estimated, billed: estimated, source: "pdf" };
}

async function countDocxPages(file: File): Promise<PageCountResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xmlFile = zip.file("word/document.xml");
  if (!xmlFile) {
    return billOffice(1);
  }
  const xml = await xmlFile.async("string");
  const text = xml
    .replace(/<w:tab[^/]*\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const estimated = Math.max(1, Math.ceil(words / 300));
  return billOffice(estimated);
}

async function countXlsxPages(file: File): Promise<PageCountResult> {
  const XLSX = await import("xlsx");
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  let totalRows = 0;
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    totalRows += rows.filter((r) =>
      Array.isArray(r) ? r.some((c) => c !== null && c !== undefined && `${c}`.trim() !== "") : false,
    ).length;
  }
  const estimated = Math.max(1, Math.ceil(totalRows / 40));
  return billOffice(estimated);
}

function countByFileSize(file: File): PageCountResult {
  const sizeKB = file.size / 1024;
  const estimated = Math.max(1, Math.ceil(sizeKB / 40));
  return billOffice(estimated);
}

/** Detect billable print pages for a file (Office = estimate + 2). */
export async function countPrintPages(file: File): Promise<PageCountResult> {
  const ext = getFileExtension(file.name);

  if (IMAGE_EXTS.has(ext)) {
    return { estimated: 1, billed: 1, source: "image" };
  }

  if (ext === "pdf") {
    try {
      return await countPdfPages(file);
    } catch (e) {
      console.warn("PDF page count failed, falling back to size estimate:", e);
      const sizeKB = file.size / 1024;
      const estimated = Math.max(1, Math.ceil(sizeKB / 50));
      return { estimated, billed: estimated, source: "pdf" };
    }
  }

  if (ext === "docx") {
    try {
      return await countDocxPages(file);
    } catch (e) {
      console.warn("DOCX page estimate failed:", e);
      return countByFileSize(file);
    }
  }

  if (ext === "xlsx") {
    try {
      return await countXlsxPages(file);
    } catch (e) {
      console.warn("XLSX page estimate failed:", e);
      return countByFileSize(file);
    }
  }

  if (OFFICE_EXTS.has(ext)) {
    return countByFileSize(file);
  }

  return { estimated: 1, billed: 1, source: "image" };
}

export function pageCountHint(source: PageCountSource | null | undefined): string {
  if (source === "office") {
    return "Office estimate + 2 page buffer (included in total)";
  }
  if (source === "pdf") {
    return "Auto-detected from PDF";
  }
  if (source === "image") {
    return "Images count as 1 page";
  }
  return "Auto-detected";
}

/** Billable units: document pages for single; ceil(pages/2) sheets for double. */
export function billablePrintUnits(
  pageCount: number,
  sides: "single" | "double",
): number {
  const pages = Math.max(1, Math.floor(pageCount) || 1);
  return sides === "double" ? Math.ceil(pages / 2) : pages;
}
