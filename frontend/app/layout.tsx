import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Customizer — AI Resume Tailor",
  description: "Paste a job description, upload your resume, and get an AI-tailored version instantly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
