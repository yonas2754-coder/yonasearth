import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import * as XLSX from "xlsx";
import { promises as fs } from "fs";
import { IncomingForm, File as FormidableFile } from "formidable";
import path from "path";
import os from "os";

export const config = { api: { bodyParser: false } };

// Helper to parse uploaded file
async function parseForm(req: Request): Promise<{ file: FormidableFile; zoom?: number }> {
  const form = new IncomingForm({ uploadDir: "./public/uploads", keepExtensions: true });
  return new Promise((resolve, reject) => {
    form.parse(req as any, (err, fields, files) => {
      if (err) return reject(err);

      let uploaded: FormidableFile;
      const f = files.file;
      if (Array.isArray(f)) uploaded = f[0];
      else uploaded = f as FormidableFile;

      if (!uploaded) return reject(new Error("No file uploaded"));

      const zoom = 8;
      resolve({ file: uploaded, zoom });
    });
  });
}

// Parse CSV/TXT file into JSON
function parseCSVorTXT(content: string) {
  const delimiter = content.includes("\t") ? "\t" : content.includes(",") ? "," : /\s+/;
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(delimiter).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((v) => v.trim());
    const obj: any = {};
    headers.forEach((h, i) => (obj[h] = values[i] || ""));
    return obj;
  });
}

// Delay helper
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function POST(req: Request) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const sendProgress = async (data: any) => {
    await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  try {
    const { file, zoom: defaultZoom } = await parseForm(req);
    const ext = path.extname(file.originalFilename || "").toLowerCase();
    let rows: any[] = [];

    // Read file based on extension
    if (ext === ".xlsx" || ext === ".xls") {
      const workbook = XLSX.readFile(file.filepath || file.path);
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (ext === ".csv" || ext === ".txt") {
      const content = await fs.readFile(file.filepath || file.path, "utf-8");
      rows = parseCSVorTXT(content);
    } else {
      await sendProgress({ error: "Unsupported file type" });
      writer.close();
      return new Response(readable, { headers: { "Content-Type": "text/event-stream" } });
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const concurrency = Math.max(os.cpus().length - 1, 2);
    let processed = 0;
    const results: any[] = [];

    const queue: Promise<void>[] = [];

    async function processRow(row: any, index: number) {
      const place =
        row["Specific Area (location where they face service issues)"] ||
        row["Specific Area"] ||
        row["Area"] ||
        "";

      if (!place) {
        results[index] = { ...row, latitude: "", longitude: "", googleMapsUrl: "No area name" };
        processed++;
        await sendProgress({ index: processed, total: rows.length, row: results[index] });
        return;
      }

      try {
        const page = await browser.newPage();
        const query = encodeURIComponent(place);
        const url = `https://www.google.com/maps/search/${query}`;
        await page.goto(url, { waitUntil: "networkidle2" });
        await delay(1000);

        const finalUrl = page.url();
        const match = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+)z/);

        if (!match) {
          results[index] = { ...row, latitude: "", longitude: "", googleMapsUrl: "Not found or rate-limited" };
        } else {
          const latitude = parseFloat(match[1]);
          const longitude = parseFloat(match[2]);
          const zoom = defaultZoom || parseInt(match[3]);
          const googleMapsUrl = `https://www.google.com/maps/place/${latitude},${longitude}/@${latitude},${longitude},${zoom}z`;
          results[index] = { ...row, latitude, longitude, zoom, googleMapsUrl };
        }

        await page.close();
      } catch (err: any) {
        results[index] = { ...row, error: err.message };
      }

      processed++;
      await sendProgress({ index: processed, total: rows.length, row: results[index] });
    }

    // Process with concurrency
    for (let i = 0; i < rows.length; i++) {
      const p = processRow(rows[i], i);
      queue.push(p);
      if (queue.length >= concurrency) {
        await Promise.race(queue);
        queue.filter((pr) => !pr); // Keep queue small (optional)
      }
    }
    await Promise.all(queue);

    await browser.close();

    const newSheet = XLSX.utils.json_to_sheet(results);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Results");
    const outputPath = "./public/uploads/results.xlsx";
    XLSX.writeFile(newWorkbook, outputPath);
    await fs.unlink(file.filepath || file.path);

    await sendProgress({ finished: true, downloadUrl: "/uploads/results.xlsx" });
    writer.close();
  } catch (err: any) {
    await writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
    writer.close();
  }

  return new Response(readable, { headers: { "Content-Type": "text/event-stream" } });
}
