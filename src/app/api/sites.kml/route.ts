import { NextResponse } from "next/server";
import { create } from "xmlbuilder2";

export async function GET() {
  // Example telecom site data (could come from Prisma or external API)
  const sites = [
    { name: "Addis Ababa Site", lon: 38.74, lat: 9.03 },
    { name: "Jimma Site", lon: 36.83, lat: 7.67 },
    { name: "Mekelle Site", lon: 39.47, lat: 13.50 },
  ];

  // Build KML XML dynamically
  const kml = create({ version: "1.0", encoding: "UTF-8" })
    .ele("kml", { xmlns: "http://www.opengis.net/kml/2.2" })
    .ele("Document");

  for (const site of sites) {
    kml
      .ele("Placemark")
      .ele("name").txt(site.name).up()
      .ele("Point")
      .ele("coordinates")
      .txt(`${site.lon},${site.lat},0`)
      .up().up().up();
  }

  const xml = kml.end({ prettyPrint: true });

  // Send the file with the right headers
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/vnd.google-earth.kml+xml",
      "Content-Disposition": 'inline; filename="sites.kml"',
    },
  });
}
