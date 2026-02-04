"use client";

import { useState, useCallback } from "react";
import QRCode from "qrcode";
import * as XLSX from "xlsx";

const PRESET_COLORS = [
  { name: "Noir", hex: "#000000" },
  { name: "Bleu", hex: "#2563eb" },
  { name: "Rouge", hex: "#dc2626" },
  { name: "Vert", hex: "#16a34a" },
  { name: "Violet", hex: "#9333ea" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Rose", hex: "#db2777" },
  { name: "Cyan", hex: "#0891b2" },
];

interface QRSettings {
  color: string;
  distance: number;
  cellSize: number;
  size: number;
}

interface URLEntry {
  id: string;
  url: string;
  settings: QRSettings;
}

const DEFAULT_SETTINGS: QRSettings = {
  color: "#000000",
  distance: 50,
  cellSize: 8,
  size: 50,
};

// Draw QR-style pattern in a half circle
function drawHalfCirclePattern(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
  cellSize: number,
  direction: "right" | "bottom"
) {
  const cells: { x: number; y: number }[] = [];

  for (let x = -radius; x <= radius; x += cellSize) {
    for (let y = -radius; y <= radius; y += cellSize) {
      let inHalfCircle = false;
      const dist = Math.sqrt(x * x + y * y);

      if (dist <= radius - cellSize / 2) {
        if (direction === "right" && x >= 0) {
          inHalfCircle = true;
        } else if (direction === "bottom" && y >= 0) {
          inHalfCircle = true;
        }
      }

      if (inHalfCircle) {
        cells.push({ x: centerX + x, y: centerY + y });
      }
    }
  }

  ctx.fillStyle = color;
  cells.forEach((cell) => {
    const hash = Math.sin(cell.x * 12.9898 + cell.y * 78.233) * 43758.5453;
    const shouldFill = (hash - Math.floor(hash)) > 0.45;
    if (shouldFill) {
      ctx.fillRect(cell.x, cell.y, cellSize - 1, cellSize - 1);
    }
  });
}

async function generateQRCodeBase64(
  text: string,
  settings: QRSettings,
  qrSize: number = 200
): Promise<string> {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, text, {
    width: qrSize,
    margin: 2,
    color: {
      dark: settings.color,
      light: "#ffffff",
    },
  });

  const halfCircleRadius = (qrSize * settings.size) / 100;
  const scaledDistance = ((settings.distance - 50) / 100) * qrSize;
  const scaledCellSize = Math.max(2, (settings.cellSize / 100) * qrSize);

  const maxDistance = Math.max(0, scaledDistance);
  const compositeSize = qrSize + halfCircleRadius + maxDistance;
  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = compositeSize;
  compositeCanvas.height = compositeSize;
  const ctx = compositeCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, compositeSize, compositeSize);
  ctx.drawImage(qrCanvas, 0, 0);

  drawHalfCirclePattern(ctx, qrSize + scaledDistance, qrSize / 2, halfCircleRadius, settings.color, scaledCellSize, "right");
  drawHalfCirclePattern(ctx, qrSize / 2, qrSize + scaledDistance, halfCircleRadius, settings.color, scaledCellSize, "bottom");

  // Rotate
  const diagonal = Math.ceil(Math.sqrt(2) * compositeSize);
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = diagonal;
  finalCanvas.height = diagonal;
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) throw new Error("Could not get canvas context");

  finalCtx.fillStyle = "#ffffff";
  finalCtx.fillRect(0, 0, diagonal, diagonal);
  finalCtx.translate(diagonal / 2, diagonal / 2);
  finalCtx.rotate((-135 * Math.PI) / 180);
  finalCtx.translate(-compositeSize / 2, -compositeSize / 2);
  finalCtx.drawImage(compositeCanvas, 0, 0);

  return finalCanvas.toDataURL("image/png");
}

export default function BatchQRGenerator() {
  const [entries, setEntries] = useState<URLEntry[]>([
    { id: crypto.randomUUID(), url: "", settings: { ...DEFAULT_SETTINGS } },
  ]);
  const [globalSettings, setGlobalSettings] = useState<QRSettings>({ ...DEFAULT_SETTINGS });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addEntry = () => {
    setEntries([
      ...entries,
      { id: crypto.randomUUID(), url: "", settings: { ...DEFAULT_SETTINGS } },
    ]);
  };

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter((e) => e.id !== id));
    }
  };

  const updateEntryUrl = (id: string, url: string) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, url } : e)));
  };

  const updateEntrySetting = (id: string, key: keyof QRSettings, value: string | number) => {
    setEntries(
      entries.map((e) =>
        e.id === id ? { ...e, settings: { ...e.settings, [key]: value } } : e
      )
    );
  };

  const applyGlobalSettings = () => {
    setEntries(entries.map((e) => ({ ...e, settings: { ...globalSettings } })));
  };

  const updateGlobalSetting = (key: keyof QRSettings, value: string | number) => {
    setGlobalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const generateXLSX = useCallback(async () => {
    const validEntries = entries.filter((e) => e.url.trim());
    if (validEntries.length === 0) {
      setError("Veuillez entrer au moins une URL valide.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const data: { URL: string; QRCode: string }[] = [];

      for (const entry of validEntries) {
        const qrBase64 = await generateQRCodeBase64(entry.url, entry.settings);
        data.push({
          URL: entry.url,
          QRCode: qrBase64,
        });
      }

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);

      // Adjust column widths
      ws["!cols"] = [
        { wch: 50 }, // URL column
        { wch: 80 }, // QR Code column (base64 is long)
      ];

      XLSX.utils.book_append_sheet(wb, ws, "QR Codes");

      // Download
      XLSX.writeFile(wb, "qrcodes.xlsx");
    } catch (err) {
      setError("Erreur lors de la génération du fichier Excel.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }, [entries]);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl w-full">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Génération en lot</h1>

      {/* Global Settings */}
      <div className="mb-8 p-4 bg-gray-50 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-700">Paramètres globaux</h2>
          <button
            onClick={applyGlobalSettings}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium"
          >
            Appliquer à tous
          </button>
        </div>

        {/* Global Color Picker */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">Couleur</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.hex}
                onClick={() => updateGlobalSetting("color", color.hex)}
                className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                  globalSettings.color === color.hex
                    ? "border-gray-800 ring-2 ring-offset-1 ring-gray-400"
                    : "border-gray-200"
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
            <input
              type="color"
              value={globalSettings.color}
              onChange={(e) => updateGlobalSetting("color", e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border border-gray-300"
            />
          </div>
        </div>

        {/* Global Sliders */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Distance ({globalSettings.distance}%)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={globalSettings.distance}
              onChange={(e) => updateGlobalSetting("distance", Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Taille carrés ({globalSettings.cellSize}%)</label>
            <input
              type="range"
              min="2"
              max="15"
              value={globalSettings.cellSize}
              onChange={(e) => updateGlobalSetting("cellSize", Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Taille demi-cercles ({globalSettings.size}%)</label>
            <input
              type="range"
              min="25"
              max="100"
              value={globalSettings.size}
              onChange={(e) => updateGlobalSetting("size", Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>
      </div>

      {/* URL Entries */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Liste des URLs</h2>

        <div className="space-y-4">
          {entries.map((entry, index) => (
            <div key={entry.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-medium text-gray-500 w-8">#{index + 1}</span>
                <input
                  type="text"
                  value={entry.url}
                  onChange={(e) => updateEntryUrl(entry.id, e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 text-sm"
                />
                <button
                  onClick={() => removeEntry(entry.id)}
                  disabled={entries.length === 1}
                  className={`p-2 rounded-lg transition-all ${
                    entries.length === 1
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-red-500 hover:bg-red-50"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Individual Settings */}
              <div className="flex items-center gap-4 pl-11">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Couleur:</span>
                  <input
                    type="color"
                    value={entry.settings.color}
                    onChange={(e) => updateEntrySetting(entry.id, "color", e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border border-gray-300"
                  />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-gray-500">Dist:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={entry.settings.distance}
                    onChange={(e) => updateEntrySetting(entry.id, "distance", Number(e.target.value))}
                    className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-xs text-gray-400 w-8">{entry.settings.distance}%</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-gray-500">Carrés:</span>
                  <input
                    type="range"
                    min="2"
                    max="15"
                    value={entry.settings.cellSize}
                    onChange={(e) => updateEntrySetting(entry.id, "cellSize", Number(e.target.value))}
                    className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-xs text-gray-400 w-8">{entry.settings.cellSize}%</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-gray-500">Taille:</span>
                  <input
                    type="range"
                    min="25"
                    max="100"
                    value={entry.settings.size}
                    onChange={(e) => updateEntrySetting(entry.id, "size", Number(e.target.value))}
                    className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-xs text-gray-400 w-8">{entry.settings.size}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addEntry}
          className="mt-4 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter une URL
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={generateXLSX}
        disabled={isGenerating}
        className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
          isGenerating
            ? "bg-gray-400 text-white cursor-wait"
            : "bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl"
        }`}
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Génération en cours...
          </span>
        ) : (
          "Générer le fichier Excel"
        )}
      </button>
    </div>
  );
}
