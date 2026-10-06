import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Simple Analytics - Data Client",
  description: "Backend for Simple Analytics Webflow Hybrid App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
