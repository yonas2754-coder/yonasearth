// app/api/batch-proximity/route.ts

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDistance } from 'geolib';
import fs from 'fs';
import path from 'path';

// --- Configuration ---
// Make sure this file name matches the site information file you placed in /public/commen
const SITE_FILE_NAME = 'SiteInformation.xlsx';

// --- Data Structures ---
interface CustomerRow {
  latitude: number;
  longitude: number;
  status: 'Success' | 'Error';
  originalData: Record<string, any>; // Holds all original Excel columns
}

// Interface defining the expected columns from the stationary site file
interface SiteRow {
    'Site ID': number;
    'Region/ Zone': string;
    'Lat': number;
    'Long': number;
    'Admin Region': string;
    'Zone (Sub City)': string;
    'Wereda': string;
    'Town': string;
    'Kebele': string;
    'Tower type': string;
    'Power type': string;
    'Tower location': string;
    'Vendor': string;
    [key: string]: any; // Allows for any other columns
}

// Helper function to convert any unit to meters
function convertToMeters(value: number, unit: 'meters' | 'km'): number {
    if (unit === 'km') {
        return value * 1000;
    }
    return value; // Already in meters
}

// Helper function to read the stationary site file from the server
function readSiteData(): SiteRow[] {
    const filePath = path.join(process.cwd(), 'public', 'commen', SITE_FILE_NAME);
    
    if (!fs.existsSync(filePath)) {
        console.error(`Site file not found at: ${filePath}`);
        // Fatal error: stop execution if the file is missing
        throw new Error(`Site information file (${SITE_FILE_NAME}) not found on the server.`);
    }

    try {
        const fileContent = fs.readFileSync(filePath);
        // Assuming CSV/XLSX reading works and returns an array of objects
        const workbook = XLSX.read(fileContent, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0]; 
        const json: SiteRow[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        // Basic cleaning: ensure Lat/Long are numbers
        return json.map(row => ({
            ...row,
            Lat: parseFloat(row.Lat as any),
            Long: parseFloat(row.Long as any)
        })).filter(row => !isNaN(row.Lat) && !isNaN(row.Long));
    } catch (e) {
         console.error(`Error reading or parsing site file (${SITE_FILE_NAME}):`, e);
         throw new Error(`Failed to read or parse the site data file. Check file format.`);
    }
}


export async function POST(req: Request) {
    try {
        const { 
            customerData: rawCustomerData, 
            maxDistanceValue: rawMaxDistanceValue,
            maxDistanceUnit: rawMaxDistanceUnit 
        } = await req.json();

        // 1. Input Validation and Conversion
        const maxDistanceValue = parseFloat(rawMaxDistanceValue);
        const maxDistanceUnit = rawMaxDistanceUnit as 'meters' | 'km';
        const customerData = rawCustomerData as CustomerRow[];

        if (isNaN(maxDistanceValue) || maxDistanceValue <= 0 || !['meters', 'km'].includes(maxDistanceUnit)) {
            return NextResponse.json({ error: "Invalid distance value or unit provided." }, { status: 400 });
        }
        
        const maxDistanceMeters = convertToMeters(maxDistanceValue, maxDistanceUnit);


        // 2. Load stationary site data (Error handling is inside readSiteData)
        const siteData = readSiteData();

        if (siteData.length === 0) {
             return NextResponse.json({ error: "Stationary site data is empty or invalid." }, { status: 500 });
        }

        const proximityResults: any[] = [];

        // 3. Perform Batch Proximity Analysis
        for (const customer of customerData) {
            // Only process rows where scraping succeeded
            if (customer.status !== 'Success' || !customer.latitude || !customer.longitude) continue; 
            
            const customerCoords = { latitude: customer.latitude, longitude: customer.longitude };

            const nearbySites = siteData
                .map(item => {
                    const siteCoords = { latitude: item.Lat, longitude: item.Long };
                    const distanceMeters = getDistance(customerCoords, siteCoords);
                    return { site: item, distanceMeters };
                })
                .filter(item => item.distanceMeters <= maxDistanceMeters)
                .sort((a, b) => a.distanceMeters - b.distanceMeters); 
            
            // 4. MERGE LOGIC: Include all required columns explicitly
            if (nearbySites.length > 0) {
                for (const item of nearbySites) {
                    const site = item.site;

                    proximityResults.push({
                        // A. ALL ORIGINAL COLUMNS FROM USER'S EXCEL FILE (names preserved)
                        ...customer.originalData,
                        
                        // B. SCRAPING METADATA
                        'Customer_API_Status': customer.status,
                        'Customer_Scraped_Lat': customer.latitude.toFixed(6),
                        'Customer_Scraped_Long': customer.longitude.toFixed(6),
                        
                        // C. PROXIMITY MATCH RESULTS
                        'Match_Distance_m': Math.round(item.distanceMeters),
                        'Match_Distance_km': (item.distanceMeters / 1000).toFixed(3),

                        // D. STATIONARY SITE DATA (ALL 13 COLUMNS INCLUDED WITH SITE_ PREFIX)
                        'Site_ID': site['Site ID'],
                        'Site_Region/Zone': site['Region/ Zone'],
                        'Site_Lat': site.Lat,
                        'Site_Long': site.Long,
                        'Site_Admin_Region': site['Admin Region'],
                        'Site_Zone/Sub_City': site['Zone (Sub City)'],
                        'Site_Wereda': site.Wereda,
                        'Site_Town': site.Town,
                        'Site_Kebele': site.Kebele,
                        'Site_Tower_Type': site['Tower type'],
                        'Site_Power_Type': site['Power type'],
                        'Site_Tower_Location': site['Tower location'],
                        'Site_Vendor': site.Vendor,
                    });
                }
            }
        }

        return NextResponse.json(proximityResults);

    } catch (error) {
        console.error("Batch proximity analysis failed:", error);
        return NextResponse.json(
            { error: (error as Error).message || "An unknown error occurred during processing." },
            { status: 500 }
        );
    }
}