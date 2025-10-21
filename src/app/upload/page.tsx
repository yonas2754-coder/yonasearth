"use client";
import { useState } from "react";
import * as XLSX from "xlsx";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState<number>(12);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<any[]>([]);

  const handleUpload = async () => {
    if (!file) return alert("Please select a file");
    setRows([]);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("zoom", zoom.toString());

    const res = await fetch("/api/process-locations/stream", { method: "POST", body: formData });
    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].replace(/^data: /, "");
        if (!line) continue;
        const data = JSON.parse(line);

        if (data.finished) {
          alert("Processing complete! Download Excel at: " + data.downloadUrl);
          continue;
        }

        if (data.index && data.total) setProgress((data.index / data.total) * 100);

        if (data.row) {
          setRows((prev) => {
            const newRows = [...prev];
            newRows[data.index - 1] = data.row;
            return newRows;
          });
        }
      }

      buffer = lines[lines.length - 1];
    }
  };

  const exportToExcel = () => {
    if (!rows.length) return alert("No data yet");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LiveResults");
    XLSX.writeFile(wb, `live_results_${Date.now()}.xlsx`);
  };

  const exportToCSV = () => {
    if (!rows.length) return alert("No data yet");
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `live_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Google Maps Coordinates Processor</h1>

      <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mb-4" />
      <input type="number" value={zoom} onChange={(e) => setZoom(parseInt(e.target.value))} className="mb-4 border p-2 rounded w-full" placeholder="Optional zoom level" />
      <button onClick={handleUpload} className="mb-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Start Processing</button>

      <div className="mb-4 flex gap-2">
        <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Download Live Excel</button>
        <button onClick={exportToCSV} className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700">Download Live CSV</button>
      </div>

      <div className="mb-4">
        <div className="w-full h-4 bg-gray-300 rounded">
          <div className="h-4 bg-green-500 rounded" style={{ width: `${progress}%` }}></div>
        </div>
        <p>{Math.round(progress)}% completed</p>
      </div>

      <div className="overflow-x-auto max-h-[500px] border rounded p-2">
        <table className="min-w-full border-collapse border">
          <thead>
            <tr className="bg-gray-200 sticky top-0">
              <th className="border px-2 py-1">#</th>
              <th className="border px-2 py-1">Specific Area</th>
              <th className="border px-2 py-1">Latitude</th>
              <th className="border px-2 py-1">Longitude</th>
              <th className="border px-2 py-1">Zoom</th>
              <th className="border px-2 py-1">Google Maps URL</th>
              <th className="border px-2 py-1">Status / Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td className="border px-2 py-1">{idx + 1}</td>
                <td className="border px-2 py-1">{row["Specific Area (location where they face service issues)"] || ""}</td>
                <td className="border px-2 py-1">{row.latitude || ""}</td>
                <td className="border px-2 py-1">{row.longitude || ""}</td>
                <td className="border px-2 py-1">{row.zoom || ""}</td>
                <td className="border px-2 py-1">{row.googleMapsUrl ? <a href={row.googleMapsUrl} target="_blank" className="text-blue-600 underline">Link</a> : ""}</td>
                <td className="border px-2 py-1">{row.error || row.googleMapsUrl === "Not found or rate-limited" ? "Failed" : "Success"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
