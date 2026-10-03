// Compressão de fotografias no navegador antes do envio: poupa dados móveis na oficina
// e espaço no alojamento (as fotos dos telemóveis têm facilmente 4–8 MB).

const LADO_MAXIMO = 1600;
const QUALIDADE = 0.82;

export async function comprimirImagem(ficheiro: File): Promise<Blob> {
  if (!ficheiro.type.startsWith('image/') || ficheiro.type === 'image/gif') return ficheiro;
  try {
    const bitmap = await createImageBitmap(ficheiro);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', QUALIDADE));
    // Se por alguma razão o resultado for maior, fica o original.
    return blob && blob.size < ficheiro.size ? blob : ficheiro;
  } catch {
    return ficheiro;
  }
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
