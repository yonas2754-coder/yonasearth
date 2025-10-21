import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const place = searchParams.get("place");
  const zoomParam = searchParams.get("zoom");

  if (!place) {
    return NextResponse.json(
      { error: "Missing 'place' query parameter" },
      { status: 400 }
    );
  }

  // Default zoom level (between 0–21)
  const zoom = zoomParam ? parseInt(zoomParam) : 8;

  try {
    // Step 1: Get coordinates from Google Maps Search
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    const query = encodeURIComponent(place);
    const searchUrl = `https://www.google.com/maps/search/${query}`;

    await page.goto(searchUrl, { waitUntil: "networkidle2" });
    await new Promise((res) => setTimeout(res, 3000));

    const finalUrl = page.url();
    const match = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

    if (!match) {
      await browser.close();
      return NextResponse.json({ error: "Coordinates not found" }, { status: 404 });
    }

    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);

    // Step 2: Get position name directly from Google Maps
    const placeUrl = `https://www.google.com/maps/place/${latitude},${longitude}/@${latitude},${longitude},${zoom}z`;
    const page2 = await browser.newPage();

    await page2.goto(placeUrl, { waitUntil: "domcontentloaded" });
    await new Promise((res) => setTimeout(res, 2000));

    const title = await page2.title();
    const positionName = title.replace(" - Google Maps", "").trim();

    await browser.close();

    // Step 3: Return result with zoom level
    return NextResponse.json({
      inputPlace: place,
      latitude,
      longitude,
      zoom,
      positionName,
      googleMapsUrl: placeUrl,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch coordinates or position name" },
      { status: 500 }
    );
  }
}
