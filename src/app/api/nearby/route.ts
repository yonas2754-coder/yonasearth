// app/api/find-nearby/route.ts (or pages/api/find-nearby.ts) - UPDATED

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDistance } from 'geolib';
import fs from 'fs';
import path from 'path';

const LAT_KEYS = ['lat', 'Lat', 'latitude', 'Latitude'];
const LON_KEYS = ['long', 'Long', 'longitude', 'Longitude'];

export async function POST(req: Request) {
  try {
    const { latitude: userLat, longitude: userLon, maxDistanceMeters } = await req.json();

    if (!userLat || !userLon || maxDistanceMeters === undefined || maxDistanceMeters === null) {
      return NextResponse.json({ error: 'Missing coordinates or maxDistanceMeters' }, { status: 400 });
    }

    const userLatitude = parseFloat(userLat);
    const userLongitude = parseFloat(userLon);
    const distanceMeters = parseFloat(maxDistanceMeters);

    if (isNaN(userLatitude) || isNaN(userLongitude) || isNaN(distanceMeters) || distanceMeters < 0) {
        return NextResponse.json({ error: 'Invalid coordinate or distance format' }, { status: 400 });
    }

    const maxDistanceMetersToUse = distanceMeters; 
    const filePath = path.join(process.cwd(), 'public', 'commen', 'SiteInformation.xlsx');
    
    if (!fs.existsSync(filePath)) {
         return NextResponse.json({ error: 'Site information file not found' }, { status: 500 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; 
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const getCoordinate = (row: any, keys: string[]): number | null => {
        // ... (coordinate parsing logic remains the same)
        for (const key of keys) {
            if (row[key] !== undefined) {
                const coord = parseFloat(row[key]);
                return isNaN(coord) ? null : coord;
            }
        }
        return null;
    };

    // 💡 STEP 1: Filter and map to include the calculated distance
    const nearbySitesWithDistance = (rows as any[])
        .map((row) => {
            const siteLat = getCoordinate(row, LAT_KEYS);
            const siteLon = getCoordinate(row, LON_KEYS);

            if (siteLat === null || siteLon === null) {
                return null; 
            }

            const distance = getDistance(
              { latitude: userLatitude, longitude: userLongitude },
              { latitude: siteLat, longitude: siteLon }
            );

            // Return the row data along with the calculated distance
            return {
                ...row,
                distanceMeters: distance, // 💡 NEW PROPERTY ADDED HERE
            };
        })
        .filter(row => row !== null && row.distanceMeters <= maxDistanceMetersToUse);


    // 💡 STEP 2: Sort the filtered array by the distanceMeters property
    nearbySitesWithDistance.sort((a, b) => {
        // Sort ascending (closest first)
        return a.distanceMeters - b.distanceMeters;
    });

    // 5. Return the sorted results
    return NextResponse.json({ 
        nearbySites: nearbySitesWithDistance, // Return the sorted array
        queryCoordinates: { latitude: userLatitude, longitude: userLongitude },
        maxDistance: `${distanceMeters} meters` 
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error during processing' }, { status: 500 });
  }
}