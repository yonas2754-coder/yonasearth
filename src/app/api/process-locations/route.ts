import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const place = body.place;
    if (!place) return NextResponse.json({ error: "Missing place" }, { status: 400 });

    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();

    const query = encodeURIComponent(place);
    await page.goto(`https://www.google.com/maps/search/${query}`, { waitUntil: "networkidle2" });
    await new Promise((res) => setTimeout(res, 1000));

    const finalUrl = page.url();
    const match = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+)z/);

    await page.close();
    await browser.close();

    if (!match) {
      return NextResponse.json({ error: "Not found" });
    }

    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);
    const zoom = parseInt(match[3]);
    const googleMapsUrl = `https://www.google.com/maps/place/${latitude},${longitude}/@${latitude},${longitude},${zoom}z`;

    return NextResponse.json({ latitude, longitude, zoom, googleMapsUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
