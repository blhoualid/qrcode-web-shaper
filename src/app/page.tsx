import QRCodeGenerator from "@/components/QRCodeGenerator";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
          QR Code Generator
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Entrez un lien pour générer un QR code
        </p>
        <QRCodeGenerator />

        {/* Link to batch page */}
        <div className="mt-6 text-center">
          <Link
            href="/batch"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Génération en lot (Excel)
          </Link>
        </div>
      </div>
    </main>
  );
}
