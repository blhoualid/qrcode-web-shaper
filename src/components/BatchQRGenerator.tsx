"use client";

import { useState, useCallback } from "react";
import QRCode from "qrcode";

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
  qrSize: number = 150  // Reduced size for smaller base64
): Promise<string> {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, text, {
    width: qrSize,
    margin: 1,  // Reduced margin
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

  // Use JPEG with compression for smaller file size (stays under Excel 32767 char limit)
  return finalCanvas.toDataURL("image/jpeg", 0.7);
}

export default function BatchQRGenerator() {
  const [urlText, setUrlText] = useState("");
  const [settings, setSettings] = useState<QRSettings>({ ...DEFAULT_SETTINGS });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlCount, setUrlCount] = useState(0);

  // Parse URLs from text
  const parseUrls = useCallback((text: string, removeEmpty: boolean = true): string[] => {
    let lines = text.split("\n");
    if (removeEmpty) {
      lines = lines.filter((line) => line.trim() !== "");
    }
    return lines.map((line) => line.trim());
  }, []);

  // Update URL count when text changes
  const handleTextChange = (text: string) => {
    setUrlText(text);
    const urls = parseUrls(text, true);
    setUrlCount(urls.length);
  };

  // Remove empty lines from textarea
  const removeEmptyLines = () => {
    const urls = parseUrls(urlText, true);
    setUrlText(urls.join("\n"));
    setUrlCount(urls.length);
  };

  const updateSetting = (key: keyof QRSettings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const generateXLSX = useCallback(async () => {
    const urls = parseUrls(urlText, true);
    if (urls.length === 0) {
      setError("Veuillez entrer au moins une URL valide.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Dynamic import of xlsx to avoid Next.js build issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX = (await import("xlsx" as any)) as any;

      const data: { URL: string; QRCode: string }[] = [];

      for (const url of urls) {
        if (url.trim()) {
          const qrBase64 = await generateQRCodeBase64(url, settings);
          data.push({
            URL: url,
            QRCode: qrBase64,
          });
        }
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
  }, [urlText, settings, parseUrls]);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl w-full">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Génération en lot</h1>

      {/* URL Text Area */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Liste des URLs (une par ligne)
          </label>
          <span className="text-sm text-gray-500">
            {urlCount} URL{urlCount > 1 ? "s" : ""} détectée{urlCount > 1 ? "s" : ""}
          </span>
        </div>
        <textarea
          value={urlText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="https://example1.com&#10;https://example2.com&#10;https://example3.com"
          className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800 placeholder-gray-400 font-mono text-sm resize-y"
        />
        <button
          onClick={removeEmptyLines}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Supprimer les lignes vides
        </button>
      </div>

      {/* Global Settings */}
      <div className="mb-8 p-4 bg-gray-50 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Paramètres (appliqués à tous)</h2>

        {/* Color Picker */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">Couleur du QR Code</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.hex}
                onClick={() => updateSetting("color", color.hex)}
                className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                  settings.color === color.hex
                    ? "border-gray-800 ring-2 ring-offset-2 ring-gray-400"
                    : "border-gray-200"
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
            <div className="flex items-center gap-2 ml-2">
              <input
                type="color"
                value={settings.color}
                onChange={(e) => updateSetting("color", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-gray-300"
              />
              <input
                type="text"
                value={settings.color.toUpperCase()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                    updateSetting("color", value);
                  }
                }}
                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                maxLength={7}
              />
            </div>
          </div>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Distance Slider */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Distance</span>
              <span>
                {settings.distance < 50
                  ? `Proche (${settings.distance}%)`
                  : settings.distance > 50
                    ? `Éloigné (${settings.distance}%)`
                    : "Base (50%)"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.distance}
              onChange={(e) => updateSetting("distance", Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Proche</span>
              <span>Éloigné</span>
            </div>
          </div>

          {/* Cell Size Slider */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Taille des carrés</span>
              <span>{settings.cellSize}%</span>
            </div>
            <input
              type="range"
              min="2"
              max="15"
              value={settings.cellSize}
              onChange={(e) => updateSetting("cellSize", Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Half Circle Size Slider */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Taille demi-cercles</span>
              <span>{settings.size}%</span>
            </div>
            <input
              type="range"
              min="25"
              max="100"
              value={settings.size}
              onChange={(e) => updateSetting("size", Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={generateXLSX}
        disabled={isGenerating || urlCount === 0}
        className={`w-full py-4 px-6 rounded-lg font-medium transition-all text-lg ${
          isGenerating || urlCount === 0
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl"
        }`}
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Génération en cours... ({urlCount} QR codes)
          </span>
        ) : (
          <>
            <span className="flex items-center justify-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Générer et exporter en Excel ({urlCount} URL{urlCount > 1 ? "s" : ""})
            </span>
          </>
        )}
      </button>

      <p className="mt-4 text-center text-sm text-gray-500">
        Le fichier Excel contiendra 2 colonnes : URL et QR Code (base64)
      </p>
    </div>
  );
}
