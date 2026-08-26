import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/vue-i18n/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  treeshake: true,
})
