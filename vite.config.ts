/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// 라이브러리 빌드: ES(npm) + UMD(CDN `<script>`, 전역 `Gad`).
// 퍼블리셔는 `<script src=".../gad-ofw-sdk.umd.js">` 후 `Gad.Ofw.loadAds(...)` 사용.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Gad',
      formats: ['es', 'umd'],
      fileName: (format) => `gad-ofw-sdk.${format}.js`,
    },
  },
  test: {
    environment: 'jsdom',
  },
});
