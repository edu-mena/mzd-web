// Cliente HTTP único da aplicação.
//
// VITE_API_MODE=mock  → os pedidos são tratados por um servidor simulado no browser (src/api/mock),
//                       com os dados guardados em localStorage. Serve para desenvolver o frontend
//                       antes do backend existir.
// VITE_API_MODE=http  → os pedidos vão para o backend PHP em `${VITE_API_BASE}/api`.
//
// Contrato com o PHP:
// - JSON em ambos os sentidos; erros como { "erro": "mensagem" } com o status HTTP adequado
//   (401 sem sessão, 403 sem permissão, 404, 422 validação/regra de negócio, 429 demasiadas tentativas).
// - Sessão por cookie HttpOnly (SameSite=Lax/Strict); o frontend nunca guarda tokens.
// - CSRF: o PHP define um cookie legível "XSRF-TOKEN"; o frontend devolve-o no cabeçalho "X-XSRF-TOKEN"
//   em todos os pedidos que alteram dados.

export const API_MODE: 'mock' | 'http' = import.meta.env.VITE_API_MODE === 'http' ? 'http' : 'mock';
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function lerCookie(nome: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${nome}=`))
    ?.split('=')[1];
}

/**
 * Envia um ficheiro (multipart/form-data). No PHP: $_FILES['ficheiro'] + restantes campos em $_POST.
 * O servidor valida o tipo real do ficheiro (finfo), o tamanho e as permissões.
 */
export async function enviarFicheiro<T>(path: string, form: FormData): Promise<T> {
  if (API_MODE === 'mock') {
    const { handleUpload } = await import('./mock/server');
    return handleUpload<T>(path, form);
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  const csrf = lerCookie('XSRF-TOKEN');
  if (csrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(csrf);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { method: 'POST', headers, credentials: 'same-origin', body: form });
  } catch {
    throw new ApiError(0, 'Sem ligação ao servidor. O ficheiro não foi enviado.');
  }
  const dados = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, dados?.erro ?? `Erro ao enviar o ficheiro (${res.status}).`);
  return dados as T;
}

export async function request<T>(method: Metodo, path: string, body?: unknown): Promise<T> {
  if (API_MODE === 'mock') {
    const { handle } = await import('./mock/server');
    return handle<T>(method, path, body);
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const csrf = lerCookie('XSRF-TOKEN');
    if (csrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(csrf);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Sem ligação ao servidor. Verifique a internet e tente novamente.');
  }

  if (res.status === 204) return undefined as T;
  const dados = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, dados?.erro ?? `Erro inesperado (${res.status}).`);
  }
  return dados as T;
}
