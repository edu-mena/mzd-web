// Site público: conteúdo editável pelo administrador e pedidos de serviço dos visitantes.
//
// Regras (o PHP deve replicá-las):
// - GET /site e POST /site/pedidos são públicos; o resto exige sessão.
// - Pedidos: limitar por IP (ex.: 5 por hora), campo-armadilha "site" que tem de vir vazio (robôs),
//   consentimento obrigatório para ser contactado. Um pedido nunca cria cliente: a receção decide.
// - Imagens enviadas pelo administrador ficam numa pasta pública própria (/media/site), só imagens,
//   com o tipo verificado por finfo e tamanho máximo de 5 MB.

import { ApiError } from '../client';
import type { Metodo } from '../client';
import { db, guardar } from './db';
import { auditar, exigir, novoId, texto, umDe } from './contexto';
import type { Handler } from './contexto';
import { notificar } from './comunicacoes';
import type { ConteudoSite, EstadoPedido, PedidoServico } from '../../types';

const ESTADOS: EstadoPedido[] = ['novo', 'contactado', 'marcado', 'arquivado'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const recentes = new Map<string, number[]>();

const imagem = (v: any, campo: string) => {
  const url = texto(v?.url, `${campo}: imagem`, 1, 300);
  if (!/^(\/site\/|\/media\/site\/|mock-anexo:)/.test(url)) throw new ApiError(422, `${campo}: imagem inválida.`);
  return { url, alt: texto(v?.alt, `${campo}: descrição da imagem`, 3, 160), credito: v?.credito ? String(v.credito).slice(0, 200) : undefined };
};
const lista = <T,>(v: unknown, campo: string, max: number, f: (x: any, i: number) => T): T[] => {
  if (!Array.isArray(v)) throw new ApiError(422, `${campo}: lista inválida.`);
  if (v.length > max) throw new ApiError(422, `${campo}: máximo ${max}.`);
  return v.map(f);
};
const ident = (x: any, i: number) => String(x?.id ?? '').trim().slice(0, 40) || `i${Date.now().toString(36)}${i}`;

function validarConteudo(b: any): ConteudoSite {
  return {
    hero: { titulo: texto(b?.hero?.titulo, 'Título principal', 5, 80), subtitulo: texto(b?.hero?.subtitulo, 'Subtítulo', 10, 300), imagem: imagem(b?.hero?.imagem, 'Imagem principal') },
    destaques: lista(b?.destaques, 'Destaques', 4, (x) => ({ titulo: texto(x?.titulo, 'Destaque', 3, 50), texto: texto(x?.texto, 'Texto do destaque', 5, 200) })),
    modelos: lista(b?.modelos, 'Modelos', 12, (x, i) => ({ id: ident(x, i), nome: texto(x?.nome, 'Modelo', 2, 40), descricao: texto(x?.descricao, `Descrição de ${x?.nome ?? 'modelo'}`, 5, 240), imagem: imagem(x?.imagem, `Modelo ${x?.nome ?? i + 1}`) })),
    servicos: lista(b?.servicos, 'Serviços', 12, (x, i) => ({ id: ident(x, i), titulo: texto(x?.titulo, 'Serviço', 3, 50), descricao: texto(x?.descricao, `Descrição de ${x?.titulo ?? 'serviço'}`, 5, 240), imagem: imagem(x?.imagem, `Serviço ${x?.titulo ?? i + 1}`) })),
    galeria: lista(b?.galeria, 'Galeria', 24, (x, i) => ({ id: ident(x, i), ...imagem(x, `Galeria ${i + 1}`) })),
    testemunhos: lista(b?.testemunhos, 'Testemunhos', 12, (x, i) => ({ id: ident(x, i), nome: texto(x?.nome, 'Nome no testemunho', 2, 60), viatura: x?.viatura ? String(x.viatura).trim().slice(0, 60) || undefined : undefined, texto: texto(x?.texto, 'Testemunho', 10, 400) })),
    contactos: {
      telefone: texto(b?.contactos?.telefone, 'Telefone', 9, 30),
      whatsapp: texto(b?.contactos?.whatsapp, 'WhatsApp', 9, 30),
      email: (() => { const e = texto(b?.contactos?.email, 'Email', 5, 120); if (!EMAIL.test(e)) throw new ApiError(422, 'Email inválido.'); return e; })(),
      morada: texto(b?.contactos?.morada, 'Morada', 3, 200),
      horario: texto(b?.contactos?.horario, 'Horário', 3, 120),
      mapaUrl: (() => { const u = String(b?.contactos?.mapaUrl ?? '').trim(); if (u && !/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/.test(u)) throw new ApiError(422, 'Ligação do mapa: use um endereço do Google Maps.'); return u || undefined; })(),
    },
    seo: { titulo: texto(b?.seo?.titulo, 'Título para o Google', 10, 70), descricao: texto(b?.seo?.descricao, 'Descrição para o Google', 30, 170) },
  };
}

export const rotasSite: [Metodo, string, Handler][] = [
  // Público
  ['GET', '/site', () => db().site],

  ['POST', '/site/pedidos', ({ body }) => {
    // Robôs preenchem tudo: o campo-armadilha "site" vem preenchido → aceita-se em silêncio e descarta-se.
    if (body?.site) return { recebido: true };
    const telefone = texto(body?.telefone, 'Telefone', 9, 30);
    if (telefone.replace(/\D/g, '').length < 9) throw new ApiError(422, 'Telefone: indique pelo menos 9 dígitos.');
    const agora = Date.now();
    const chave = telefone.replace(/\D/g, '');
    const deste = (recentes.get(chave) ?? []).filter((t) => agora - t < 3600000);
    if (deste.length >= 3) throw new ApiError(429, 'Já recebemos os seus pedidos. Vamos contactá-lo em breve.');
    if (body?.consentimento !== true) throw new ApiError(422, 'Confirme que aceita ser contactado sobre este pedido.');
    const email = body?.email ? String(body.email).trim().toLowerCase() : '';
    if (email && !EMAIL.test(email)) throw new ApiError(422, 'Email inválido.');
    const dataPreferida = body?.dataPreferida ? String(body.dataPreferida) : undefined;
    if (dataPreferida && (!/^\d{4}-\d{2}-\d{2}$/.test(dataPreferida) || dataPreferida < new Date(agora - 86400000).toISOString().slice(0, 10))) {
      throw new ApiError(422, 'Escolha uma data a partir de hoje.');
    }
    const p: PedidoServico = {
      id: novoId('pedido', 'ps'),
      data: new Date(agora).toISOString(),
      nome: texto(body?.nome, 'Nome', 3, 80),
      telefone,
      email: email || undefined,
      modelo: body?.modelo ? String(body.modelo).trim().slice(0, 40) || undefined : undefined,
      matricula: body?.matricula ? String(body.matricula).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) || undefined : undefined,
      servico: texto(body?.servico, 'Serviço', 2, 60),
      dataPreferida,
      mensagem: body?.mensagem ? String(body.mensagem).trim().slice(0, 1000) || undefined : undefined,
      estado: 'novo',
    };
    db().pedidos.unshift(p);
    recentes.set(chave, [...deste, agora]);
    notificar({ perfis: ['rececionista'] }, 'Novo pedido no site', `${p.nome} · ${p.servico}${p.modelo ? ` · ${p.modelo}` : ''}`, '/comunicacoes');
    auditar(null, 'pedido_site', 'pedido', p.id, `${p.nome} · ${p.servico}`);
    guardar();
    return { recebido: true };
  }],

  // Administrador
  ['PUT', '/site', ({ body }) => {
    const u = exigir('site.gerir');
    const conteudo = { ...validarConteudo(body), atualizadoEm: new Date().toISOString(), atualizadoPorId: u.id };
    db().site = conteudo;
    auditar(u.id, 'editar', 'site');
    guardar();
    return conteudo;
  }],

  // Receção
  ['GET', '/site/pedidos', () => {
    exigir('mensagens.enviar');
    return db().pedidos;
  }],
  ['PATCH', '/site/pedidos/:id', ({ params, body }) => {
    const u = exigir('mensagens.enviar');
    const p = db().pedidos.find((x) => x.id === params.id);
    if (!p) throw new ApiError(404, 'Pedido não encontrado.');
    const estado = umDe(body?.estado ?? p.estado, ESTADOS, 'Estado');
    const marcacaoId = body?.marcacaoId ? String(body.marcacaoId) : p.marcacaoId;
    if (marcacaoId && !db().marcacoes.some((m) => m.id === marcacaoId)) throw new ApiError(422, 'Marcação não encontrada.');
    Object.assign(p, {
      estado, marcacaoId,
      notas: body?.notas !== undefined ? String(body.notas).trim().slice(0, 500) || undefined : p.notas,
      tratadoPorId: u.id, tratadoEm: new Date().toISOString(),
    });
    auditar(u.id, 'tratar', 'pedido', p.id, estado);
    guardar();
    return p;
  }],
];
