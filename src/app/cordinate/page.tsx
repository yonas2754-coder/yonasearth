'use client';

import * as React from 'react';
import { useState, FormEvent } from 'react';
import { Input, Button } from '@fluentui/react-components';

interface Site {
  [key: string]: any;
}

export default function FindNearbySites() {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [maxDistanceMeters, setMaxDistanceMeters] = useState('1000');

  const [nearbySites, setNearbySites] = useState<Site[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNearbySites([]);
    setColumnHeaders([]);

    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    const distNum = parseFloat(maxDistanceMeters);

    if (isNaN(latNum) || isNaN(lonNum) || isNaN(distNum) || distNum <= 0) {
      setError('Please enter valid coordinates and a positive distance in meters.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: latNum, longitude: lonNum, maxDistanceMeters: distNum }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch data from the server.');
      } else {
        const sites = data.nearbySites as Site[];
        setNearbySites(sites);
        if (sites.length > 0) setColumnHeaders(Object.keys(sites[0]));
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('An unexpected network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h1>Find Sites Within a Custom Distance (Meters)</h1>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}
      >
        <Input
          type="number"
          step="any"
          placeholder="Latitude"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          required
          style={{ flex: 1, minWidth: 150 }}
        />
        <Input
          type="number"
          step="any"
          placeholder="Longitude"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          required
          style={{ flex: 1, minWidth: 150 }}
        />
        <Input
          type="number"
          step="1"
          placeholder="Max Distance (meters)"
          value={maxDistanceMeters}
          onChange={(e) => setMaxDistanceMeters(e.target.value)}
          required
          style={{ flex: 1, minWidth: 150 }}
        />
        <Button appearance="primary" type="submit" disabled={loading} style={{ flexShrink: 0 }}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {error && <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && !error && nearbySites.length > 0 && (
        <>
          <h2>
            Found {nearbySites.length} Nearby Site(s) (within {maxDistanceMeters} meters)
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f2f2f2' }}>
                  {columnHeaders.map((header) => (
                    <th key={header} style={tableHeaderStyle}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nearbySites.map((site, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                    {columnHeaders.map((header) => (
                      <td key={`${index}-${header}`} style={tableCellStyle}>
                        {site[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && !error && nearbySites.length === 0 && !columnHeaders.length && (
        <p>Enter coordinates and search to find nearby sites.</p>
      )}

      {!loading && !error && nearbySites.length === 0 && columnHeaders.length > 0 && (
        <p>No sites found within {maxDistanceMeters} meters of the coordinates.</p>
      )}
    </div>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: 8,
  textAlign: 'left',
};

const tableCellStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: 8,
};
