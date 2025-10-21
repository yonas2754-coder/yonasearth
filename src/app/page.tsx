"use client";
export default function GoogleEarthButton() {
  const kmlUrl = `${window.location.origin}/api/sites.kml`;

  const openInGoogleEarth = () => {
    const earthUrl = `https://earth.google.com/web/@?link=${encodeURIComponent(kmlUrl)}`;
    window.open(earthUrl, "_blank");
  };

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-semibold">Telecom Sites Map</h2>
      <p className="text-sm text-gray-600">
        View your dynamically generated KML in Google Earth Web.
      </p>
      <button
        onClick={openInGoogleEarth}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg"
      >
        🌍 Open in Google Earth
      </button>
    </div>
  );
}
