export interface FormatLocationsRequest {
  areas: string[];
}

export interface FormatLocationsResponse {
  success: boolean;
  originalCount: number;
  formattedCount: number;
  data: Array<{
    original: string;
    formatted: string;
  }>;
  processingTime?: number;
  error?: string;
}