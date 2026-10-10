import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart(),
    nitro({
      rolldownConfig: {
        // "use client" and "use no memo" mean nothing in the server bundle, and Rolldown warns once per file
        onwarn(warning, warn) {
          if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning);
        },
      },
    }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
});
