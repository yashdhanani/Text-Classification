import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NeuralText — AI Text Classification Platform",
    template: "%s | NeuralText",
  },
  description:
    "Enterprise-grade AI/NLP text classification platform. Train BERT, LSTM, and transformer models. Analyze sentiment, classify documents, and deploy models at scale.",
  keywords: ["NLP", "text classification", "sentiment analysis", "BERT", "machine learning"],
  authors: [{ name: "NeuralText" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "NeuralText — AI Text Classification Platform",
    description: "Enterprise-grade AI/NLP text classification platform.",
    siteName: "NeuralText",
  },
};

// Strip browser-extension injected attributes before React hydrates.
// Covers: BIS (bis_skin_checked, bis_register) and BuiltIn (__processed_*).
const cleanExtensionAttrs = `(function(){
  try {
    var walk = function(el) {
      if (!el || el.nodeType !== 1) return;
      var rem = [];
      for (var i = 0; i < el.attributes.length; i++) {
        var n = el.attributes[i].name;
        if (n.startsWith('bis_') || n.startsWith('__processed_')) rem.push(n);
      }
      for (var j = 0; j < rem.length; j++) el.removeAttribute(rem[j]);
      for (var k = 0; k < el.children.length; k++) walk(el.children[k]);
    };
    walk(document.documentElement);
  } catch(e) {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: cleanExtensionAttrs }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

