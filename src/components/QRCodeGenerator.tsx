"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

// Draw QR-style pattern in a half circle
function drawHalfCirclePattern(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
  direction: "right" | "bottom"
) {
  const cellSize = 8;
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

  // Draw cells with QR-like pattern (pseudo-random based on position)
  ctx.fillStyle = color;
  cells.forEach((cell) => {
    const hash = Math.sin(cell.x * 12.9898 + cell.y * 78.233) * 43758.5453;
    const shouldFill = (hash - Math.floor(hash)) > 0.45;
    if (shouldFill) {
      ctx.fillRect(cell.x, cell.y, cellSize - 1, cellSize - 1);
    }
  });
}

export default function QRCodeGenerator() {
  const [url, setUrl] = useState("");
  const [compositeDataUrl, setCompositeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrColor, setQrColor] = useState("#000000");
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const generateCompositeQR = useCallback(async (text: string, color: string, size: number) => {
    try {
      // Create QR code canvas
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, text, {
        width: size,
        margin: 2,
        color: {
          dark: color,
          light: "#ffffff",
        },
      });

      // Create composite canvas with extra space for half circles
      // Diameter = QR code width, so radius = size / 2
      const halfCircleRadius = size / 2;
      const compositeSize = size + halfCircleRadius;
      const compositeCanvas = document.createElement("canvas");
      compositeCanvas.width = compositeSize;
      compositeCanvas.height = compositeSize;
      const ctx = compositeCanvas.getContext("2d");
      if (!ctx) return null;

      // Fill with white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, compositeSize, compositeSize);

      // Draw QR code
      ctx.drawImage(qrCanvas, 0, 0);

      // Draw half circle on the right side of the QR code
      drawHalfCirclePattern(ctx, size, size / 2, halfCircleRadius, color, "right");

      // Draw half circle on the bottom of the QR code
      drawHalfCirclePattern(ctx, size / 2, size, halfCircleRadius, color, "bottom");

      return compositeCanvas;
    } catch {
      return null;
    }
  }, []);

  const generatePreview = useCallback(async (text: string, color: string) => {
    try {
      setError(null);
      const compositeCanvas = await generateCompositeQR(text, color, 200);
      if (!compositeCanvas) {
        throw new Error("Failed to generate");
      }
      setCompositeDataUrl(compositeCanvas.toDataURL("image/png"));
    } catch {
      setError("Échec de la génération du QR code. Veuillez réessayer.");
      setCompositeDataUrl(null);
    }
  }, [generateCompositeQR]);

  useEffect(() => {
    if (url.trim()) {
      generatePreview(url, qrColor);
    } else {
      setCompositeDataUrl(null);
      setError(null);
    }
  }, [url, qrColor, generatePreview]);

  const downloadQRCode = async () => {
    if (!url.trim()) return;

    try {
      const qrSize = 400;
      const compositeCanvas = await generateCompositeQR(url, qrColor, qrSize);
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

      // Fill with white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, diagonal, diagonal);

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

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col items-center">
        {/* QR Code Display */}
        <div className="w-[350px] h-[350px] bg-gray-50 rounded-xl flex items-center justify-center mb-6 border-2 border-dashed border-gray-200 overflow-hidden">
          {compositeDataUrl ? (
            <div className="flex items-center justify-center">
              <img
                src={compositeDataUrl}
                alt="Generated QR Code"
                className="-rotate-[135deg] max-w-[280px] max-h-[280px]"
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
