import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "UxMail",
  description: "Modern Multi-Account Email Client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-gray-50 text-gray-900">
      <body className={`${inter.className} h-full antialiased`}>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}