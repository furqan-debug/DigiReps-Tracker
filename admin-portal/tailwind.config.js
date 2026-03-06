/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#1d4ed8', // A strong blue matching Hubstaff flavor
                secondary: '#475569',
                background: '#f8fafc',
                surface: '#ffffff',
            },
        },
    },
    plugins: [],
}
