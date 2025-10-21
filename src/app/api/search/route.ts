import { NextResponse, type NextRequest } from 'next/server';
import Fuse from 'fuse.js';

// --- 1. Import the Structured Woreda Data ---
// Assuming '@/data/ethiopian_woredas.json' contains the array of WoredaTown objects.
import woredaData from '@/data/ethiopian_woredas.json'; 

// --- 2. TypeScript Interfaces ---
interface RegionCity { 
    name: string; 
}

interface SubcityZone { 
    name: string; 
    region_city: RegionCity; 
}

interface WoredaTown {
    name: string; // The primary name (Woreda/Town)
    subcity_zone: SubcityZone;
}

// NOTE: The SearchResult interface is no longer strictly needed but kept for context.
// interface SearchResult {
//     item: WoredaTown; 
//     score: number;
// }

// --- 3. Fuse Initialization ---
// Ensure the imported JSON is treated as the correct data type (array).
const woredaList: WoredaTown[] = (woredaData as { basic_woreda_towns?: WoredaTown[] }).basic_woreda_towns
    ?? (woredaData as unknown as WoredaTown[]);

const fuse = new Fuse(woredaList, {
    keys: [
        // 1. Highest Priority: Search the Woreda/Town name directly
        { name: 'name', weight: 1.0 }, 
        
        // 2. Secondary Priority: Search the Zone name
        { name: 'subcity_zone.name', weight: 0.7 }, 
        
        // 3. Tertiary Priority: Search the Region name
        { name: 'subcity_zone.region_city.name', weight: 0.5 }
    ],
    
    // Setting this to true is what makes 'score' available (and sometimes 'undefined' by default)
    includeScore: true, 
    includeMatches: true, 
    
    // --- Optimized Fuzzy Search Parameters ---
    threshold: 0.3, 
    distance: 100,
    minMatchCharLength: 3, 
    ignoreLocation: true,
});

// Use Edge Runtime for speed
export const runtime = 'edge';

// --- 4. POST Handler for Single-Line, Space-Separated Output ---
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const query = body.query;
        
        if (!query || typeof query !== 'string') {
            // Return a simple text error for non-JSON requests
            return new Response('ERROR: Invalid_search_query_provided', { 
                status: 400, 
                headers: { 'Content-Type': 'text/plain' } 
            });
        }

        const normalizedQuery = query.toLowerCase().trim();

        // Perform the fuzzy search
        const results = fuse.search(normalizedQuery)
            // Filter out poor matches (score must be non-null and better than 0.4)
            .filter(r => r.score !== null&&r.score !== undefined  && r.score <= 0.4) 
            // Sort by best score (lowest score is best)
            // FIX: Use '!' on a.score and b.score to assert non-null after the .filter()
            .sort((a, b) => a.score! - b.score!); 

        // 1. Get the best match (the first item after sorting/filtering)
        const bestMatch = results[0];

        if (!bestMatch) {
            // Return a predictable 'empty' result line if no good match is found
            return new Response('NO_MATCH NO_ZONE NO_REGION 1.0000', { 
                status: 200, 
                headers: { 'Content-Type': 'text/plain' } 
            });
        }

        const item = bestMatch.item as WoredaTown;
        
        // 2. Format score to 4 decimal places 
        // FIX: Use '!' on bestMatch.score to assert non-null
        const score = bestMatch.score!.toFixed(4); 

        // 3. Sanitize names: Replace spaces with underscores (_)
        const woredaName = item.name.replace(/\s/g, '_');
        const zoneName = item.subcity_zone.name.replace(/\s/g, '_');
        const regionName = item.subcity_zone.region_city.name.replace(/\s/g, '_');

        // 4. Format the data into a single, space-separated string
        const singleLineOutput = `${woredaName} ${zoneName} ${regionName} ${score}`;

        // 5. Return a plain text response
        return new Response(singleLineOutput, { 
            status: 200, 
            headers: { 
                'Content-Type': 'text/plain' 
            } 
        });

    } catch (error) {
        console.error('Structured Fuzzy Search API Error:', error);
        // Return a plain text internal server error
        return new Response('ERROR: Internal_server_error_processing_the_search', { 
            status: 500, 
            headers: { 'Content-Type': 'text/plain' } 
        });
    }
}