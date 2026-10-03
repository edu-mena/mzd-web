import { createContext, useContext } from 'react';

export type TipoToast = 'sucesso' | 'erro';
export type ToastFn = (message: string, tipo?: TipoToast) => void;

export const ToastContext = createContext<ToastFn>(() => {});

export function useToast() {
  return useContext(ToastContext);
}
