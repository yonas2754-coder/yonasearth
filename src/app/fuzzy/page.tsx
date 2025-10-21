'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';

import {
  makeStyles,
  tokens,
  Button,
  Input,
  Label,
  Select,
  Option,
  ProgressBar,
  Tooltip,
  Card,
  Divider,
  Text,
  Caption1,
  FluentProvider,
  webLightTheme,
} from '@fluentui/react-components';

import { ArrowDownloadRegular, SearchRegular } from '@fluentui/react-icons';

// --- API routes (ADJUSTED) ---
const COORDINATES_API_ROUTE = '/api/coordinates';
const PROXIMITY_API_ROUTE = '/api/batch-proximity';
// 🚨 NEW API ROUTE FOR FUZZY MATCHING
const FUZZY_SEARCH_API_ROUTE = '/api/search'; 

// --- Colors & tokens ---
const CUSTOMER_SCRAPED_COLOR = '#e6f7ff'; // light blue
const SITE_MATCH_COLOR = '#fffbe6';

interface PlaceResult {
  inputPlace: string;
  latitude: number;
  longitude: number;
  zoom: number;
  positionName: string;
  googleMapsUrl: string;
  status: 'Success' | 'Error';
  errorMessage?: string;
  originalData: Record<string, any>;
  // 🚨 NEW PROPERTY: Store the result of the fuzzy match
  fuzzyMatch: string; 
}

const useStyles = makeStyles({
    // ... (useStyles remains the same) ...
    root: {
        minHeight: '100vh',
        backgroundColor: tokens.colorNeutralBackground3,
        fontFamily: tokens.fontFamilyBase,
        padding: tokens.spacingHorizontalXXL,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.spacingHorizontalM,
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
        borderRadius: tokens.borderRadiusLarge,
        marginBottom: tokens.spacingVerticalL,
    },
    content: {
        maxWidth: '1200px',
        margin: '0 auto',
    },
    card: {
        padding: tokens.spacingVerticalL,
        marginBottom: tokens.spacingVerticalL,
        borderRadius: tokens.borderRadiusMedium,
        boxShadow: tokens.shadow8,
        background: tokens.colorNeutralBackground1,
    },
    fileInput: {
        display: 'flex',
        gap: tokens.spacingHorizontalM,
        alignItems: 'center',
    },
    smallMuted: {
        color: tokens.colorNeutralForegroundInverted,
        opacity: 0.9,
    },
    tableWrapper: {
        overflowX: 'auto',
        maxHeight: '380px',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: tokens.fontSizeBase300,
    },
    th: {
        position: 'sticky',
        top: 0,
        background: tokens.colorNeutralBackground4,
        textAlign: 'left',
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        zIndex: 2,
    },
    td: {
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
        borderBottom: `1px dashed ${tokens.colorNeutralStroke2}`,
        verticalAlign: 'top',
    },
    actionsRow: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
        alignItems: 'center',
    },
});

export default function ExcelProcessorV9() {
  const styles = useStyles();

  // ... (state variables remain the same) ...
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalRowsToProcess, setTotalRowsToProcess] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [originalHeaders, setOriginalHeaders] = useState<string[]>([]);
  const [finalProximityResults, setFinalProximityResults] = useState<any[]>([]);
  const [proximityLoading, setProximityLoading] = useState(false);
  const [combinedHeaders, setCombinedHeaders] = useState<string[]>([]);
  const [maxDistanceValue, setMaxDistanceValue] = useState('1');
  const [maxDistanceUnit, setMaxDistanceUnit] = useState<'km' | 'meters'>('km');

  useEffect(() => {
    // ... (online status check remains the same) ...
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getCellBackgroundColor = (header: string) => {
    if (header.startsWith('Site_') || header.startsWith('Match_')) return SITE_MATCH_COLOR;
    if (header.startsWith('Customer_Scraped_') || header.startsWith('Customer_API_Status') || header.startsWith('API Status')) return CUSTOMER_SCRAPED_COLOR;
    return tokens.colorNeutralBackground1;
  };

  // --- File handling (remains mostly the same) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... (file loading and parsing remains the same) ...
    if (!isOnline) {
      alert('You are offline — connect to the internet to process.');
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setResults([]);
    setFinalProximityResults([]);
    setOriginalHeaders([]);
    setProgress(0);
    setProcessedCount(0);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = ev.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheet];
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

        if (rows.length < 2) {
          alert('File contains no data rows.');
          setLoading(false);
          return;
        }

        const headerRow = rows[0] as string[];
        setOriginalHeaders(headerRow);

        const placeColumnIndex = 2; // column C (0-based)
        if (!headerRow[placeColumnIndex]) {
          alert("Expected 'Specific Area' in column C (third column).");
          setLoading(false);
          return;
        }

        const rowDataToProcess = rows.slice(1)
          .map(row => {
            const obj: Record<string, any> = {};
            headerRow.forEach((h, i) => (obj[h] = row[i] ?? ''));
            return { placeName: row[placeColumnIndex], originalData: obj };
          })
          .filter(x => x.placeName && String(x.placeName).trim());

        setTotalRowsToProcess(rowDataToProcess.length);
        if (rowDataToProcess.length > 0) await processPlaceNames(rowDataToProcess);
        else alert('No valid place names found in Column C.');
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'Failed to parse file.');
      } finally {
        setLoading(false);
        e.target.value = '';
        setProgress(100);
      }
    };
    reader.readAsBinaryString(file as Blob);
  };

  // --- Coordinate scraping (MODIFIED) ---
  const processPlaceNames = async (rows: { placeName: string; originalData: Record<string, any> }[]) => {
    const out: PlaceResult[] = [];
    const total = rows.length;
    let count = 0;

    for (const r of rows) {
      if (!navigator.onLine) {
        alert('Connection lost — stopping.');
        break;
      }

      let matchedPlaceName = r.placeName; // Default to the raw input
      let fuzzyResultString = 'NO_MATCH';
      
      // 1. FUZZY SEARCH STEP
      try {
        const fuzzyRes = await fetch(FUZZY_SEARCH_API_ROUTE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: r.placeName }),
        });
        
        if (fuzzyRes.ok) {
            // The fuzzy API returns a plain text, space-separated string (e.g., "Mekele Axum Tigray 0.01")
          const fuzzyData = await fuzzyRes.text();
            
            // Check if it's a NO_MATCH string from the API
          if (!fuzzyData.startsWith('NO_MATCH')) {
            fuzzyResultString = fuzzyData;
            // The first part of the result is the Woreda/Town name (the best match)
            // Use only the WoredaName and ZoneName for a more targeted search
            const parts = fuzzyData.split(' ');
            if (parts.length >= 3) {
                // Combine Woreda and Zone/Region (e.g., "Mekele, Tigray") for a better geocode query
                matchedPlaceName = `${parts[0].replace(/_/g, ' ')}, ${parts[2].replace(/_/g, ' ')}`;
            } else {
                matchedPlaceName = parts[0].replace(/_/g, ' ');
            }
          }
        }
      } catch (err) {
        console.warn(`Fuzzy search failed for ${r.placeName}:`, err);
        // If fuzzy search fails, we continue with the original name
      }

      // 2. COORDINATE SCRAPING STEP (using the matchedPlaceName)
      try {
        const res = await fetch(`${COORDINATES_API_ROUTE}?place=${encodeURIComponent(matchedPlaceName)}`);
        
        if (!res.ok) {
          const parsed = await res.json().catch(() => ({}));
          out.push({ 
                inputPlace: r.placeName, latitude: 0, longitude: 0, zoom: 0, 
                positionName: 'N/A', googleMapsUrl: 'N/A', status: 'Error', 
                errorMessage: parsed.error || `Status ${res.status}`, 
                originalData: r.originalData,
                fuzzyMatch: fuzzyResultString // Store the fuzzy result
            });
        } else {
          const data = await res.json();
          out.push({ 
                ...(data as PlaceResult), 
                status: 'Success', 
                originalData: r.originalData,
                fuzzyMatch: fuzzyResultString // Store the fuzzy result
            });
        }
      } catch (err: any) {
        out.push({ 
            inputPlace: r.placeName, latitude: 0, longitude: 0, zoom: 0, 
            positionName: 'N/A', googleMapsUrl: 'N/A', status: 'Error', 
            errorMessage: err.message || 'Network error', 
            originalData: r.originalData,
            fuzzyMatch: fuzzyResultString // Store the fuzzy result
        });
      }

      count++;
      setProcessedCount(count);
      setProgress(Math.round((count / total) * 100));
    }
    setResults(out);
  };

  // --- Export helpers (MODIFIED) ---
  const handleExportScraped = () => {
    if (results.length === 0) return;
    
    // 🚨 MODIFICATION: Add the fuzzyMatch data to the exported object
    const data = results.map(r => ({ 
        ...r.originalData, 
        API_Status: r.status, 
        Customer_Scraped_Latitude: r.latitude.toFixed(6), 
        Customer_Scraped_Longitude: r.longitude.toFixed(6), 
        Customer_Scraped_Resolved_Name: r.positionName, 
        Customer_Scraped_Google_Maps_URL: r.googleMapsUrl, 
        Customer_API_Status_Error_Message: r.errorMessage || '',
        // New columns for fuzzy match results
        Fuzzy_Match_Woreda_Zone_Region_Score: r.fuzzyMatch.split(' ').slice(0, 4).join(' '), // Woreda Zone Region Score
        Fuzzy_Match_Search_Query: r.fuzzyMatch.split(' ').slice(0, 3).map(s => s.replace(/_/g, ' ')).join(', '), // Reconstructed search query
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GeoResults');
    const name = fileName ? fileName.replace(/(\.xlsx|\.csv)$/i, '_GEO_RESULTS.xlsx') : 'geo_results.xlsx';
    XLSX.writeFile(wb, name);
  };

  // ... (handleExportCombined and handleProximityAnalysis remain the same) ...
  const handleExportCombined = () => {
    if (finalProximityResults.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(finalProximityResults);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Proximity_Results');
    const name = fileName ? fileName.replace(/(\.xlsx|\.csv)$/i, '_PROXIMITY_ANALYSIS.xlsx') : 'proximity_analysis.xlsx';
    XLSX.writeFile(wb, name);
  };

  // --- Proximity analysis ---
  const handleProximityAnalysis = async () => {
    const value = parseFloat(maxDistanceValue);
    if (isNaN(value) || value <= 0) return alert('Enter a valid positive distance');
    if (results.filter(r => r.status === 'Success').length === 0) return alert('No successful scrapes to analyze.');
    setProximityLoading(true);
    setFinalProximityResults([]);
    setCombinedHeaders([]);
    try {
      const res = await fetch(PROXIMITY_API_ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerData: results.filter(r => r.status === 'Success'), maxDistanceValue, maxDistanceUnit }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Status ${res.status}`);
      }
      const finalData = await res.json();
      setFinalProximityResults(finalData || []);
      if (finalData && finalData.length > 0) setCombinedHeaders(Object.keys(finalData[0]));
      else alert(`No nearby sites found within ${maxDistanceValue} ${maxDistanceUnit}.`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Proximity analysis failed');
    } finally {
      setProximityLoading(false);
    }
  };

  // ... (ProgressBlock remains the same) ...
  const ProgressBlock = () => (
    <div style={{ marginTop: tokens.spacingVerticalM }}>
      <Caption1>Processing: {processedCount} / {totalRowsToProcess}</Caption1>
      <ProgressBar value={progress / 100} />
    </div>
  );

  return (
    <FluentProvider theme={webLightTheme}>
      <div className={styles.root}>
        <div className={styles.content}>
          {/* ... (Header remains the same) ... */}
          <div className={styles.header}>
            <div>
              <h1>Geo-Analysis Processor</h1>
              <Text style={{ fontSize: 12, opacity: 0.9 }}>Upload customer file, scrape coordinates, and join to nearest sites.</Text>
            </div>
            <div style={{ display: 'flex', gap: tokens.spacingHorizontalM, alignItems: 'center' }}>
            
            </div>
          </div>

          {/* Upload card (remains the same) */}
          <Card className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacingHorizontalL }}>
              <div style={{ flex: 1 }}>
                <Label>Step 1 — Upload customer complaints (.xlsx / .csv)</Label>
                <div className={styles.fileInput}>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={loading || !isOnline} style={{ padding: '6px 12px', borderRadius: '4px', border: `1px solid ${tokens.colorNeutralStroke2}` }} />
                  <div>
                    <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
                     
                    
                    </div>
                    <Caption1 style={{ marginTop: tokens.spacingVerticalS }}>{fileName ? `Selected: ${fileName}` : 'No file chosen'}</Caption1>
                  </div>
                </div>
                {loading && <ProgressBlock />}
              </div>
            </div>
          </Card>

          {/* Results preview (MODIFIED to show Fuzzy Match) */}
          {results.length > 0 && (
            <Card className={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Label>Scraped Coordinates Preview ({results.length})</Label>
                <div className={styles.actionsRow}>
                  <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={handleExportScraped}>Export Scraped Coordinates</Button>
                </div>
              </div>

              <Divider style={{ margin: `${tokens.spacingVerticalM} 0` }} />

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {originalHeaders.map((h, i) => (<th key={i} className={styles.th}>{h}</th>))}
                      {/* NEW COLUMN: Show the matched result and score */}
                      <th className={styles.th}>Fuzzy_Match</th> 
                      <th className={styles.th}>API_Status</th>
                      <th className={styles.th}>Latitude</th>
                      <th className={styles.th}>Longitude</th>
                      <th className={styles.th}>Resolved_Name</th>
                      <th className={styles.th}>Map_Link</th>
                      <th className={styles.th}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, idx) => (
                      <tr key={idx}>
                        {originalHeaders.map((h, c) => (<td key={c} className={styles.td}>{r.originalData[h]}</td>))}
                        {/* NEW CELL: Display Fuzzy Match Result */}
                        <td className={styles.td}>
                            {r.fuzzyMatch.startsWith('NO_MATCH') 
                                ? <strong style={{color: tokens.colorPaletteRedForeground1}}>No Match</strong>
                                : r.fuzzyMatch.split(' ').slice(0, 3).map(s => s.replace(/_/g, ' ')).join(', ') + ` (Score: ${r.fuzzyMatch.split(' ').slice(-1)})`}
                        </td>
                        <td className={styles.td}><strong style={{ color: r.status === 'Success' ? tokens.colorPaletteGreenForeground1 : tokens.colorPaletteRedForeground1 }}>{r.status}</strong></td>
                        <td className={styles.td}>{r.latitude.toFixed(6)}</td>
                        <td className={styles.td}>{r.longitude.toFixed(6)}</td>
                        <td className={styles.td}>{r.positionName}</td>
                        <td className={styles.td}>{r.status === 'Success' ? <a href={r.googleMapsUrl} target="_blank" rel="noopener noreferrer">View</a> : 'N/A'}</td>
                        <td className={styles.td}>{r.errorMessage || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Proximity card (remains the same) */}
          {results.length > 0 && (
            <Card className={styles.card}>
              <Label>Step 2 — Proximity Analysis</Label>
              {/* ... (Proximity controls remain the same) ... */}
              <div style={{ display: 'flex', gap: tokens.spacingHorizontalL, alignItems: 'center', marginTop: tokens.spacingVerticalM }}>
                <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center' }}>
                  <Label>Max distance</Label>
                  <Input type="number" value={maxDistanceValue} onChange={(e) => setMaxDistanceValue(e.target.value)} style={{ width: 120 }} />
                  <Select
                        value={maxDistanceUnit}
                        onChange={(e) => setMaxDistanceUnit(e.target.value as 'km' | 'meters')}
                        style={{ minWidth: '120px' }}
                    >
                        <option value="km">Kilometers (km)</option>
                        <option value="meters">Meters</option>
                    </Select>
                </div>

                <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
                  <Button appearance="primary" disabled={proximityLoading} onClick={handleProximityAnalysis}>{proximityLoading ? 'Analyzing...' : `Run Proximity (${maxDistanceValue} ${maxDistanceUnit})`}</Button>
               
                </div>
              </div>

              {proximityLoading && <div style={{ marginTop: tokens.spacingVerticalM }}><ProgressBar /></div>}
            </Card>
          )}

          {/* Final results table (remains the same) */}
          {finalProximityResults.length > 0 && (
            <Card className={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Label>Final Combined Results ({finalProximityResults.length})</Label>
                <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={handleExportCombined}>Export Combined Data</Button>
              </div>

              <Divider style={{ margin: `${tokens.spacingVerticalM} 0` }} />

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {combinedHeaders.map((h, i) => (<th key={i} className={styles.th}>{h}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {finalProximityResults.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {combinedHeaders.map((h, cIdx) => (<td key={cIdx} className={styles.td} style={{ background: getCellBackgroundColor(h) }}>{row[h]}</td>))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        </div>
      </div>
    </FluentProvider>
  );
}