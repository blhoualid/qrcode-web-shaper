import QRCodeGenerator from "@/components/QRCodeGenerator";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
          QR Code Generator
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Enter a link below to generate a QR code
        </p>
        <QRCodeGenerator />
      </div>
    </main>
  );
}
