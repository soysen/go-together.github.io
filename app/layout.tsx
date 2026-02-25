import type { Metadata } from "next";
import { Chiron_GoRound_TC } from "next/font/google";
import "../styles/globals.css";

const chiron = Chiron_GoRound_TC({
    variable: "--font-chiron",
    weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "這週去哪玩",
    description: "選個喜歡的活動，來一場說走就走的小旅行",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <link rel="icon" href="./favicon/favicon-16x16.png" />
                <meta property="og:title" content="這週去哪玩" />
                <meta property="og:description" content="選個喜歡的活動，來一場說走就走的小旅行" />
                <meta property="og:image" content="https://soysen.github.io/go-together.github.io/favicon/cover.png" />
                <link rel="apple-touch-icon" href="./favicon/apple-touch-icon.png" />
            </head>
            <body
                className={`${chiron.variable} antialiased`}
            >
                {children}
            </body>
        </html>
    );
}
