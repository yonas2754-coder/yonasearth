import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

// Set a high timeout for the request since Puppeteer scraping can be slow
export const maxDuration = 60; // 60 seconds

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

  let browser;
  try {
    // Step 1: Get coordinates from Google Maps Search
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    const query = encodeURIComponent(place);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    // Corrected Google Maps search URL
    const searchUrl = `${apiUrl}/search/${query}`; 

    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 }); // 30s timeout
    await new Promise((res) => setTimeout(res, 3000)); // Wait for redirect

    const finalUrl = page.url();
    // Regex to capture latitude and longitude from the final URL after redirection
    const match = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

    if (!match) {
      await browser.close();
      return NextResponse.json({ error: "Coordinates not found after search. Place might be too ambiguous." }, { status: 404 });
    }

    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);

    // Step 2: Get position name directly from Google Maps
     const placeUrl = `${apiUrl}/place/${latitude},${longitude}/@${latitude},${longitude},${zoom}z`
    
    //const placeUrl = `https://www.google.com/maps/@${latitude},${longitude},${zoom}z`;
    
    const page2 = await browser.newPage(); 

    await page2.goto(placeUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
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
    console.error("Puppeteer or API failed:", error);
    if (browser) await browser.close();
    return NextResponse.json(
      { error: "Failed to fetch coordinates or position name. Server error or Puppeteer issue." },
      { status: 500 }
    );
  }
}