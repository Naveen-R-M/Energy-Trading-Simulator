import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { JetBrains_Mono } from "next/font/google"
import "./globals.css"

// Suppress React development warnings
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args) => {
    if (args[0]?.includes?.('element.ref was removed') || 
        args[0]?.includes?.('does not recognize') ||
        args[0]?.includes?.('Hydration failed')) {
      return; // Suppress these specific warnings
    }
    originalError.apply(console, args);
  };
  
  // Force dark theme on any remaining white backgrounds
  const forceTheme = () => {
    const style = document.createElement('style');
    style.textContent = `
      * { 
        background-color: inherit !important; 
      }
      body, html, #__next, [data-reactroot] { 
        background: #0f1419 !important; 
        color: #ffffff !important; 
      }
      /* Aggressive white background elimination */
      div:not([class*="arco-"]):not([style*="background: #"]) {
        background: transparent !important;
      }
      [style*="background-color: rgb(255, 255, 255)"], 
      [style*="background-color: white"],
      [style*="background: white"],
      [style*="background: rgb(255, 255, 255)"],
      [style*="background-color:#fff"],
      [style*="background:#fff"],
      [style*="background-color: #ffffff"],
      [style*="background: #ffffff"] {
        background: #0f1419 !important;
      }
      /* Target common layout containers */
      .container, .wrapper, .content, .main, .section, .page {
        background: #0f1419 !important;
      }
      /* Fallback for any remaining white elements */
      [style*="255, 255, 255"] {
        background: #0f1419 !important;
      }
    `;
    document.head.appendChild(style);
    
    // Also scan for white elements dynamically
    const scanAndFix = () => {
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const computed = window.getComputedStyle(el);
        const bg = computed.backgroundColor;
        if (bg === 'rgb(255, 255, 255)' || bg === 'white' || bg === '#ffffff' || bg === '#fff') {
          el.style.backgroundColor = '#0f1419';
        }
      });
    };
    
    // Run immediately and after a delay for dynamic content
    scanAndFix();
    setTimeout(scanAndFix, 1000);
    setTimeout(scanAndFix, 3000);
  };
  
  // Apply theme after DOM loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceTheme);
  } else {
    forceTheme();
  }
}

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Virtual Energy Trading - PJM-RTO",
  description: "Professional energy trading simulation platform",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
