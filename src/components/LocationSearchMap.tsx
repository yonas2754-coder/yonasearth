"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

const markerIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

// Update map view when user selects a place
function ChangeMapView({ coords }: { coords: [number, number] }) {
  const map = useMap();
  map.setView(coords, 14);
  return null;
}

export default function LocationSearchMap() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  const handleSearch = async (value: string) => {
    setQuery(value);
    if (value.length < 3) {
      setResults([]);
      return;
    }

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        value
      )}&format=json&addressdetails=1&limit=8`
    );
    const data = await res.json();
    setResults(data);
  };

  const handleSelect = (place: any) => {
    setSelected(place);
    setResults([]);
    setQuery(place.display_name);
  };

  const coords: [number, number] = selected
    ? [parseFloat(selected.lat), parseFloat(selected.lon)]
    : [9.0108, 38.7613]; // Default: Addis Ababa

  return (
    <div className="relative w-full h-screen flex flex-col items-center p-4">
      {/* Search box container */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-lg z-[1000]">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search a place (e.g., Lemi Kura, Bole Arrabsa)"
          className="w-full p-2 border rounded-lg shadow-md bg-white focus:ring focus:border-blue-400"
        />

        {results.length > 0 && (
          <ul className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-[1001]">
            {results.map((place, index) => (
              <li
                key={index}
                onClick={() => handleSelect(place)}
                className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
              >
                {place.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map container */}
      <div className="w-full h-full rounded-lg overflow-hidden shadow">
        <MapContainer
          center={coords}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          />
          {selected && (
            <>
              <ChangeMapView coords={coords} />
              <Marker position={coords} icon={markerIcon}>
                <Popup>{selected.display_name}</Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
