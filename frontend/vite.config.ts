import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
function fixGraphologyPlugin() {
  return {
    name: 'fix-graphology',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (id.includes('graphology')) {
        return code.replace('import(data, merge = false) {', '["import"](data, merge = false) {');
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), fixGraphologyPlugin()]
})

