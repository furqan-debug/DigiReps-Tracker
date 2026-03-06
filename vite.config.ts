import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['nock', 'mock-aws-s3', 'aws-sdk', 'uiohook-napi', 'active-win', 'better-sqlite3']
            }
          }
        }
      },
      preload: {
        input: 'electron/preload.ts',
      },
      // Optional: Use Node.js API in the Renderer process
      // renderer: process.env.NODE_ENV === 'test' ? undefined : {},
    }),
  ],
})
