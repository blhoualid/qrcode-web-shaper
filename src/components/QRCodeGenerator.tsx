"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
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

export default function QRCodeGenerator() {
  const [url, setUrl] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrColor, setQrColor] = useState("#000000");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateQRCode = useCallback(async (text: string, color: string) => {
    try {
      setError(null);
      const dataUrl = await QRCode.toDataURL(text, {
        width: 300,
        margin: 2,
        color: {
          dark: color,
          light: "#ffffff",
        },
      });
      setQrCodeDataUrl(dataUrl);
    } catch {
      setError("Failed to generate QR code. Please try again.");
      setQrCodeDataUrl(null);
    }
  }, []);

  useEffect(() => {
    if (url.trim()) {
      generateQRCode(url, qrColor);
    } else {
      setQrCodeDataUrl(null);
      setError(null);
    }
  }, [url, qrColor, generateQRCode]);

  const downloadQRCode = async () => {
    if (!url.trim()) return;

    try {
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, url, {
        width: 400,
        margin: 2,
        color: {
          dark: qrColor,
          light: "#ffffff",
        },
      });

      // Create a new canvas for the rotated image
      const rotatedCanvas = document.createElement("canvas");
      const ctx = rotatedCanvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size to accommodate rotated image
      const size = qrCanvas.width;
      rotatedCanvas.width = size;
      rotatedCanvas.height = size;

      // Rotate -135 degrees (counter-clockwise)
      ctx.translate(size / 2, size / 2);
      ctx.rotate((-135 * Math.PI) / 180);
      ctx.translate(-size / 2, -size / 2);
      ctx.drawImage(qrCanvas, 0, 0);

      const link = document.createElement("a");
      link.download = "qrcode.png";
      link.href = rotatedCanvas.toDataURL("image/png");
      link.click();
    } catch {
      setError("Failed to download QR code. Please try again.");
    }
  };

  const handleColorChange = (color: string) => {
    // Validate hex color
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
        {/* QR Code Display - larger container for rotated image */}
        <div className="w-[350px] h-[350px] bg-gray-50 rounded-xl flex items-center justify-center mb-6 border-2 border-dashed border-gray-200 overflow-hidden">
          {qrCodeDataUrl ? (
            <div className="w-[240px] h-[240px] flex items-center justify-center">
              <Image
                src={qrCodeDataUrl}
                alt="Generated QR Code"
                width={240}
                height={240}
                className="-rotate-[135deg]"
                unoptimized
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
          disabled={!qrCodeDataUrl}
          className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
            qrCodeDataUrl
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          Télécharger le QR Code
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
