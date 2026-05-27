import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: 5173,
        headers: {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=(self), payment=()",
        },
    },
    preview: {
        port: 4173,
    },
    build: {
        target: "es2020",
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    // React bundle
                    if (id.includes("react") ||
                        id.includes("react-dom") ||
                        id.includes("react-router-dom")) {
                        return "react";
                    }
                    // Charts bundle
                    if (id.includes("recharts")) {
                        return "charts";
                    }
                    // Radix bundle
                    if (id.includes("@radix-ui")) {
                        return "radix";
                    }
                },
            },
        },
    },
});
