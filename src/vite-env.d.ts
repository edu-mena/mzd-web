/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'mock' | 'http';
  readonly VITE_API_BASE?: string;
}

declare const __BUILD__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
