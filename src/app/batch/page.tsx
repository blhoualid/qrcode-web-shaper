import BatchQRGenerator from "@/components/BatchQRGenerator";
import Link from "next/link";

export default function BatchPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <nav className="mb-8 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Retour
          </Link>
          <span className="text-gray-300">|</span>
          <span className="text-gray-800 font-medium">Génération en lot</span>
        </nav>

        <BatchQRGenerator />
      </div>
    </main>
  );
}
