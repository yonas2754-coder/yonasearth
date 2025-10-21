import { NextRequest, NextResponse } from 'next/server';
// Assuming 'types/locations' is defined outside of this file and still accessible
import { FormatLocationsRequest, FormatLocationsResponse } from './types/locations';

// Helper function definitions remain the same
function createPrompt(areas: string[]): string {
  return `Format these Ethiopian area names for Google Maps search:

Areas to format:
${areas.map(area => `- ${area}`).join('\n')}

Format each area as: "Specific Area, City/Zone, Region, Ethiopia"
For Addis Ababa areas: "Area Name, Addis Ababa, Ethiopia"

Return ONLY a JSON array where each object has "original" and "formatted" fields.`;
}

function parseResponse(response: string, originalAreas: string[]): Array<{original: string; formatted: string}> {
  try {
    // Regex to find the JSON array structure
    const jsonMatch = response.match(/\[\s*{[\s\S]*}\s*\]/);
    if (jsonMatch) {
      // The matched string is cleaned up before parsing for robustness
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    // Fallback: return unformatted data with a default suffix
    return originalAreas.map(area => ({
      original: area,
      formatted: `${area}, Ethiopia`
    }));
  }
}
// ---
// The main API logic is now an exported POST function
export async function POST(request: NextRequest): Promise<NextResponse<FormatLocationsResponse>> {
  const startTime = Date.now();
  let areas: string[] = [];

  try {
    // 1. Parse the request body using request.json()
    const reqBody: FormatLocationsRequest = await request.json();
    areas = reqBody.areas;

    // 2. Validation
    if (!areas || !Array.isArray(areas)) {
      const errorResponse: FormatLocationsResponse = {
        success: false,
        originalCount: 0,
        formattedCount: 0,
        data: [],
        error: 'Areas array is required'
      };
      // Use NextResponse.json() to return JSON responses
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // 3. Ollama API Call
    const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Note: Use the 'areas' variable populated from the request body
      body: JSON.stringify({
        model: 'deepseek-coder:latest',
        prompt: createPrompt(areas),
        stream: false,
      }),
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama error: ${ollamaResponse.status} - ${ollamaResponse.statusText}`);
    }

    const result = await ollamaResponse.json();
    const formattedData = parseResponse(result.response, areas);
    
    const processingTime = Date.now() - startTime;
    
    // 4. Success Response
    const successResponse: FormatLocationsResponse = {
      success: true,
      originalCount: areas.length,
      formattedCount: formattedData.length,
      data: formattedData,
      processingTime
    };

    return NextResponse.json(successResponse, { status: 200 });

  } catch (error) {
    // 5. Error Handling
    const processingTime = Date.now() - startTime;
    
    const errorResponse: FormatLocationsResponse = { 
      success: false,
      originalCount: areas.length || 0, // Use the count if available, otherwise 0
      formattedCount: 0,
      data: [],
      processingTime,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Optional: Add a handler for unsupported methods (e.g., GET)
export async function GET() {
  const errorResponse: FormatLocationsResponse = { 
    success: false,
    originalCount: 0,
    formattedCount: 0,
    data: [],
    error: 'Method not allowed' 
  };
  return NextResponse.json(errorResponse, { status: 405 });
}