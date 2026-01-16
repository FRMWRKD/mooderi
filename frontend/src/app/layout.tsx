import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { VideoJobProvider } from "@/contexts/VideoJobContext";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "MoodBoard - Visual Reference Library",
    description: "AI-powered moodboard creation from video content - v2.1.0",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body className={inter.className}>
                <ConvexClientProvider>
                    <AuthProvider>
                        <VideoJobProvider>
                            {children}
                        </VideoJobProvider>
                    </AuthProvider>
                </ConvexClientProvider>
            </body>
        </html>
    );
}
