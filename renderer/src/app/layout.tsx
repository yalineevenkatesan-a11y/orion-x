import type { Metadata } from "next";
import { AppProvider } from "@/context/AppContext";
import { OrionErrorBoundary } from "../components/OrionErrorBoundary";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "ORION-X Studio",
  description: "Futuristic AI Desktop Workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Force relative resolution on the base document layer
                const base = document.createElement('base');
                base.href = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
                document.head.appendChild(base);

                // Intercept and correct structural attributes as elements append
                const observer = new MutationObserver((mutations) => {
                  mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                      if (node.tagName === 'SCRIPT' && node.src && node.getAttribute('src').startsWith('/_next/')) {
                        const relativeSrc = node.getAttribute('src').substring(1);
                        node.src = relativeSrc;
                      }
                      if (node.tagName === 'LINK' && node.href && node.getAttribute('href').startsWith('/_next/')) {
                        const relativeHref = node.getAttribute('href').substring(1);
                        node.href = relativeHref;
                      }
                    });
                  });
                });

                observer.observe(document.documentElement, { childList: true, subtree: true });
              })();
            `
          }}
        />
      </head>
      <body className="antialiased bg-radial-obsidian">
        <AppProvider>
          <OrionErrorBoundary>
            {children}
          </OrionErrorBoundary>
        </AppProvider>
      </body>
    </html>
  );
}
