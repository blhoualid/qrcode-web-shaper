"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import QRCode from "qrcode";

export default function QRCodeGenerator() {
  const [url, setUrl] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateQRCode = useCallback(async (text: string) => {
    try {
      setError(null);
      const dataUrl = await QRCode.toDataURL(text, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
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
      generateQRCode(url);
    } else {
      setQrCodeDataUrl(null);
      setError(null);
    }
  }, [url, generateQRCode]);

  const downloadQRCode = async () => {
    if (!url.trim()) return;

    try {
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, url, {
        width: 400,
        margin: 2,
        color: {
          dark: "#000000",
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

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <div className="mb-6">
        <label
          htmlFor="url-input"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Enter URL or Text
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

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col items-center">
        <div className="w-[300px] h-[300px] bg-gray-50 rounded-xl flex items-center justify-center mb-6 border-2 border-dashed border-gray-200">
          {qrCodeDataUrl ? (
            <Image
              src={qrCodeDataUrl}
              alt="Generated QR Code"
              width={300}
              height={300}
              className="rounded-lg -rotate-[135deg]"
              unoptimized
            />
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
              <p className="text-sm">Your QR code will appear here</p>
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
          Download QR Code
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
