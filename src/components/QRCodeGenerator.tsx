"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "qrcode";

const STORAGE_KEY = "qrcode-generator-settings";

interface StoredSettings {
  color: string;
  distance: number;
  cellSize: number;
  size: number;
  seed: number;
  previewBg: string;
  previewZoom: number;
  previewX: number;
  previewY: number;
}

function loadStoredSettings(): StoredSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveSettings(settings: StoredSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

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

// Draw QR-style pattern in a half circle
function drawHalfCirclePattern(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
  cellSize: number,
  direction: "right" | "bottom",
  seed: number = 1
) {
  const cells: { x: number; y: number }[] = [];

  // Generate grid of potential cells
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

  // Draw cells with QR-like pattern (pseudo-random based on position and seed)
  ctx.fillStyle = color;
  cells.forEach((cell) => {
    const hash = Math.sin(cell.x * 12.9898 + cell.y * 78.233 + seed * 47.123) * 43758.5453;
    const shouldFill = (hash - Math.floor(hash)) > 0.45;
    if (shouldFill) {
      ctx.fillRect(cell.x, cell.y, cellSize, cellSize);
    }
  });
}

interface HalfCircleSettings {
  distance: number;      // Distance from QR code (0-100, 50 = base position)
  cellSize: number;      // Size of squares in half circles (2-15)
  size: number;          // Size of half circles as percentage of QR width (25-100)
  seed: number;          // Seed for random pattern generation
}

const PREVIEW_BG_OPTIONS = [
  { name: "Damier", value: "checkered" },
  { name: "Blanc", value: "#ffffff" },
  { name: "Noir", value: "#000000" },
  { name: "Gris", value: "#6b7280" },
  { name: "Bleu", value: "#3b82f6" },
  { name: "Vert", value: "#22c55e" },
];

export default function QRCodeGenerator() {
  const [url, setUrl] = useState("");
  const [compositeDataUrl, setCompositeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrColor, setQrColor] = useState("#000000");
  const [previewBg, setPreviewBg] = useState("checkered");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [halfCircleSettings, setHalfCircleSettings] = useState<HalfCircleSettings>({
    distance: 50,  // 50 = base position, <50 = closer, >50 = farther
    cellSize: 8,
    size: 50,
    seed: 1,
  });
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load stored settings on mount
  useEffect(() => {
    const stored = loadStoredSettings();
    if (stored) {
      setQrColor(stored.color);
      setPreviewBg(stored.previewBg ?? "checkered");
      setPreviewZoom(stored.previewZoom ?? 1);
      setPreviewPosition({ x: stored.previewX ?? 0, y: stored.previewY ?? 0 });
      setHalfCircleSettings({
        distance: stored.distance,
        cellSize: stored.cellSize,
        size: stored.size,
        seed: stored.seed ?? 1,
      });
    }
    setIsInitialized(true);
  }, []);

  // Save settings when they change (after initialization)
  useEffect(() => {
    if (!isInitialized) return;
    saveSettings({
      color: qrColor,
      distance: halfCircleSettings.distance,
      cellSize: halfCircleSettings.cellSize,
      size: halfCircleSettings.size,
      seed: halfCircleSettings.seed,
      previewBg: previewBg,
      previewZoom: previewZoom,
      previewX: previewPosition.x,
      previewY: previewPosition.y,
    });
  }, [qrColor, halfCircleSettings, previewBg, previewZoom, previewPosition, isInitialized]);

  // Mouse handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!compositeDataUrl) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - previewPosition.x, y: e.clientY - previewPosition.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPreviewPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Wheel handler for zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!compositeDataUrl) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setPreviewZoom((prev) => Math.max(0.2, Math.min(3, prev + delta)));
  };

  // Reset position and zoom
  const resetView = () => {
    setPreviewZoom(1);
    setPreviewPosition({ x: 0, y: 0 });
  };

  const generateCompositeQR = useCallback(async (
    text: string,
    color: string,
    size: number,
    settings: HalfCircleSettings,
    transparent: boolean = false
  ) => {
    try {
      // Create QR code canvas
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, text, {
        width: size,
        margin: 2,
        color: {
          dark: color,
          light: transparent ? "#00000000" : "#ffffff",
        },
      });

      // Calculate half circle radius based on size percentage
      const halfCircleRadius = (size * settings.size) / 100;
      // Scale distance relative to QR size (50 = base, <50 = closer, >50 = farther)
      const scaledDistance = ((settings.distance - 50) / 100) * size;
      // Scale cell size relative to QR size
      const scaledCellSize = Math.max(2, (settings.cellSize / 100) * size);

      // Create composite canvas with extra space for half circles
      const maxDistance = Math.max(0, scaledDistance);
      const compositeSize = size + halfCircleRadius + maxDistance;
      const compositeCanvas = document.createElement("canvas");
      compositeCanvas.width = compositeSize;
      compositeCanvas.height = compositeSize;
      const ctx = compositeCanvas.getContext("2d");
      if (!ctx) return null;

      // Fill with background (white for preview, transparent for download)
      if (!transparent) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, compositeSize, compositeSize);
      }

      // Draw QR code
      ctx.drawImage(qrCanvas, 0, 0);

      // Draw half circle on the right side of the QR code
      drawHalfCirclePattern(
        ctx,
        size + scaledDistance,
        size / 2,
        halfCircleRadius,
        color,
        scaledCellSize,
        "right",
        settings.seed
      );

      // Draw half circle on the bottom of the QR code
      drawHalfCirclePattern(
        ctx,
        size / 2,
        size + scaledDistance,
        halfCircleRadius,
        color,
        scaledCellSize,
        "bottom",
        settings.seed
      );

      return compositeCanvas;
    } catch {
      return null;
    }
  }, []);

  const generatePreview = useCallback(async (
    text: string,
    color: string,
    settings: HalfCircleSettings
  ) => {
    try {
      setError(null);
      // Generate with transparent background for preview
      const compositeCanvas = await generateCompositeQR(text, color, 200, settings, true);
      if (!compositeCanvas) {
        throw new Error("Failed to generate");
      }

      // Apply rotation on canvas (like download) so the image is properly centered
      const diagonal = Math.ceil(Math.sqrt(2) * compositeCanvas.width);
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = diagonal;
      finalCanvas.height = diagonal;
      const ctx = finalCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not get context");

      // Rotate -135 degrees (counter-clockwise) around center
      ctx.translate(diagonal / 2, diagonal / 2);
      ctx.rotate((-135 * Math.PI) / 180);
      ctx.translate(-compositeCanvas.width / 2, -compositeCanvas.height / 2);
      ctx.drawImage(compositeCanvas, 0, 0);

      setCompositeDataUrl(finalCanvas.toDataURL("image/png"));
    } catch {
      setError("Échec de la génération du QR code. Veuillez réessayer.");
      setCompositeDataUrl(null);
    }
  }, [generateCompositeQR]);

  useEffect(() => {
    if (url.trim()) {
      generatePreview(url, qrColor, halfCircleSettings);
    } else {
      setCompositeDataUrl(null);
      setError(null);
    }
  }, [url, qrColor, halfCircleSettings, generatePreview]);

  const downloadQRCode = async () => {
    if (!url.trim()) return;

    try {
      const qrSize = 400;
      // Generate with transparent background for download
      const compositeCanvas = await generateCompositeQR(url, qrColor, qrSize, halfCircleSettings, true);
      if (!compositeCanvas) {
        throw new Error("Failed to generate");
      }

      // Calculate diagonal for rotated image to avoid cropping
      const diagonal = Math.ceil(Math.sqrt(2) * compositeCanvas.width);

      // Create final canvas with enough space for rotation
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = diagonal;
      finalCanvas.height = diagonal;
      const ctx = finalCanvas.getContext("2d");
      if (!ctx) return;

      // Keep transparent background (no fill)

      // Rotate -135 degrees (counter-clockwise) around center
      ctx.translate(diagonal / 2, diagonal / 2);
      ctx.rotate((-135 * Math.PI) / 180);
      ctx.translate(-compositeCanvas.width / 2, -compositeCanvas.height / 2);
      ctx.drawImage(compositeCanvas, 0, 0);

      const link = document.createElement("a");
      link.download = "qrcode.png";
      link.href = finalCanvas.toDataURL("image/png");
      link.click();
    } catch {
      setError("Échec du téléchargement. Veuillez réessayer.");
    }
  };

  const handleColorChange = (color: string) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      setQrColor(color);
    }
  };

  const updateSetting = (key: keyof HalfCircleSettings, value: number) => {
    setHalfCircleSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
      <div className="mb-6">
        <label
          htmlFor="url-input"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Entrez une URL ou du texte
        </label>
        <input
          id="url-input"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800 placeholder-gray-400"
        />
      </div>

      {/* Color Picker Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Couleur du QR Code
        </label>

        {/* Preset Colors */}
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.hex}
              onClick={() => setQrColor(color.hex)}
              className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                qrColor === color.hex
                  ? "border-gray-800 ring-2 ring-offset-2 ring-gray-400"
                  : "border-gray-200"
              }`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            />
          ))}
        </div>

        {/* Custom Hex Input */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="color"
              value={qrColor}
              onChange={(e) => setQrColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-gray-300"
            />
            <input
              type="text"
              value={qrColor.toUpperCase()}
              onChange={(e) => {
                const value = e.target.value;
                if (value.startsWith("#") && value.length <= 7) {
                  if (value.length === 7) {
                    handleColorChange(value);
                  } else {
                    setQrColor(value);
                  }
                }
              }}
              onBlur={(e) => {
                if (!/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                  setQrColor("#000000");
                }
              }}
              placeholder="#000000"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-mono text-sm"
              maxLength={7}
            />
          </div>
        </div>
      </div>

      {/* Half Circle Settings */}
      <div className="mb-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Paramètres des demi-cercles
        </label>

        {/* Distance Slider */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Distance du QR code</span>
            <span>
              {halfCircleSettings.distance < 50
                ? `Proche (${halfCircleSettings.distance}%)`
                : halfCircleSettings.distance > 50
                  ? `Éloigné (${halfCircleSettings.distance}%)`
                  : "Base (50%)"}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={halfCircleSettings.distance}
            onChange={(e) => updateSetting("distance", Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Proche</span>
            <span>Base</span>
            <span>Éloigné</span>
          </div>
        </div>

        {/* Cell Size Slider */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Taille des carrés</span>
            <span>{halfCircleSettings.cellSize}%</span>
          </div>
          <input
            type="range"
            min="2"
            max="15"
            value={halfCircleSettings.cellSize}
            onChange={(e) => updateSetting("cellSize", Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        {/* Half Circle Size Slider */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Taille des demi-cercles</span>
            <span>{halfCircleSettings.size}%</span>
          </div>
          <input
            type="range"
            min="25"
            max="100"
            value={halfCircleSettings.size}
            onChange={(e) => updateSetting("size", Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        {/* Regenerate Pattern Button */}
        <div className="md:col-span-3 flex justify-center mt-2">
          <button
            onClick={() => updateSetting("seed", Math.floor(Math.random() * 10000))}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Régénérer le motif
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col items-center">
        {/* Preview Controls */}
        <div className="flex items-center gap-4 mb-3">
          {/* Background Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Fond:</span>
            {PREVIEW_BG_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setPreviewBg(option.value)}
                className={`w-6 h-6 rounded border-2 transition-all ${
                  previewBg === option.value
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-gray-300"
                }`}
                style={{
                  background: option.value === "checkered"
                    ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                    : option.value,
                  backgroundSize: option.value === "checkered" ? "8px 8px" : undefined,
                  backgroundPosition: option.value === "checkered" ? "0 0, 0 4px, 4px -4px, -4px 0px" : undefined,
                  backgroundColor: option.value === "checkered" ? "#fff" : undefined,
                }}
                title={option.name}
              />
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPreviewZoom((prev) => Math.max(0.2, prev - 0.2))}
              className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-600 text-sm font-bold"
              title="Zoom -"
            >
              -
            </button>
            <span className="text-xs text-gray-500 w-12 text-center">{Math.round(previewZoom * 100)}%</span>
            <button
              onClick={() => setPreviewZoom((prev) => Math.min(3, prev + 0.2))}
              className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-600 text-sm font-bold"
              title="Zoom +"
            >
              +
            </button>
            <button
              onClick={resetView}
              className="ml-1 px-2 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-600 text-xs"
              title="Réinitialiser la vue"
            >
              Reset
            </button>
          </div>
        </div>

        {/* QR Code Display */}
        <div
          ref={previewContainerRef}
          className="w-[350px] h-[350px] rounded-xl flex items-center justify-center mb-6 border-2 border-gray-200 overflow-hidden"
          style={{
            backgroundImage: previewBg === "checkered"
              ? "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)"
              : "none",
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
            backgroundColor: previewBg === "checkered" ? "#ffffff" : (compositeDataUrl ? previewBg : "#f9fafb"),
            cursor: compositeDataUrl ? (isDragging ? "grabbing" : "grab") : "default",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
        >
          {compositeDataUrl ? (
            <div
              className="flex items-center justify-center w-full h-full"
              style={{ pointerEvents: "none" }}
            >
              <img
                src={compositeDataUrl}
                alt="Generated QR Code"
                draggable={false}
                style={{
                  transform: `translate(${previewPosition.x}px, ${previewPosition.y}px) scale(${previewZoom})`,
                  transition: isDragging ? "none" : "transform 0.1s ease-out",
                  maxWidth: "90%",
                  maxHeight: "90%",
                  objectFit: "contain",
                  userSelect: "none",
                }}
              />
            </div>
          ) : (
            <div className="text-gray-400 text-center px-4">
              <svg
                className="w-16 h-16 mx-auto mb-2 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
              <p className="text-sm">Votre QR code apparaîtra ici</p>
            </div>
          )}
        </div>

        <button
          onClick={downloadQRCode}
          disabled={!compositeDataUrl}
          className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
            compositeDataUrl
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          Télécharger le QR Code
        </button>
      </div>

      <canvas ref={previewCanvasRef} className="hidden" />
    </div>
  );
}
