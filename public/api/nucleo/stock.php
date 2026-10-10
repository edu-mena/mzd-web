<?php
// Stock, fornecedores e encomendas. Porte de src/api/mock/stock.ts.

declare(strict_types=1);

function obter_peca(string $id): object
{
    return Db::obter('pecas', $id) ?? erro(404, 'Peça não encontrada.');
}

/** Unidades reservadas: tarefas de montagem por fazer em processos em reparação ou controlo de qualidade. */
function reservado(string $pecaId): int
{
    static $mapa = null;
    if ($mapa === null || isset($GLOBALS['__stock_mudou'])) {
        unset($GLOBALS['__stock_mudou']);
        $mapa = [];
        foreach (Db::todos('processos') as $p) {
            if (!in_array($p->estado, ['em_reparacao', 'controlo_qualidade'], true)) continue;
            foreach ($p->tarefas ?? [] as $t) {
                if (!empty($t->pecaId) && empty($t->feita)) $mapa[$t->pecaId] = ($mapa[$t->pecaId] ?? 0) + ($t->quantidade ?? 1);
            }
        }
    }
    return $mapa[$pecaId] ?? 0;
}

function encomendado(string $pecaId): int
{
    $s = 0;
    foreach (Db::todos('encomendas') as $e) {
        if ($e->estado !== 'enviada') continue;
        foreach ($e->linhas as $l) if ($l->pecaId === $pecaId) $s += $l->quantidade;
    }
    return $s;
}

function resumo_peca(object $p, object $u): object
{
    $r = reservado($p->id);
    $x = copia($p);
    $x->precoCusto = pode($u, 'pecas.editar') ? $p->precoCusto : 0;
    $x->precoBase = pode($u, 'valores.ver') ? $p->precoBase : 0;
    $x->fornecedor = Db::obter('fornecedores', $p->fornecedorId)->nome ?? '—';
    $x->reservado = $r;
    $x->disponivel = $p->stock - $r;
    $x->encomendado = encomendado($p->id);
    return $x;
}

/** Altera o stock e regista o movimento. O stock físico nunca fica negativo. */
function movimentar(object $peca, int $quantidade, string $tipo, object $u, array $extra = []): void
{
    $novo = $peca->stock + $quantidade;
    if ($novo < 0) erro(422, "Só há {$peca->stock} em stock de \"{$peca->nome}\". Registe primeiro a receção da encomenda.");
    $peca->stock = $novo;
    $m = (object) ['id' => novo_id('movimento', 'mv'), 'pecaId' => $peca->id, 'tipo' => $tipo, 'quantidade' => $quantidade, 'stockApos' => $novo, 'data' => agora(), 'utilizadorId' => $u->id];
    foreach ($extra as $k => $v) if ($v !== null) $m->$k = $v;
    Db::inserir('movimentos', $m);
    $GLOBALS['__stock_mudou'] = true;
}

function faltas_do_processo(object $p): array
{
    $precisa = [];
    foreach ($p->tarefas ?? [] as $t) if (!empty($t->pecaId) && empty($t->feita)) $precisa[$t->pecaId] = true;
    $r = [];
    foreach (array_keys($precisa) as $id) {
        $peca = Db::obter('pecas', $id);
        if (!$peca) continue;
        $falta = max(0, -($peca->stock - reservado($id)));
        if ($falta > 0) $r[] = (object) ['peca' => $peca, 'falta' => $falta];
    }
    return $r;
}

/** Depois de aprovar trabalho: se faltarem peças, o processo fica "à espera de peças" com a lista. */
function verificar_faltas(object $p, string $autor): void
{
    $GLOBALS['__stock_mudou'] = true;
    $faltas = faltas_do_processo($p);
    if (!$faltas) return;
    $p->aguardaPecas = true;
    $p->notaPecas = 'Sem stock: ' . implode(', ', array_map(fn($f) => "{$f->peca->nome} (falta {$f->falta})", $faltas));
    registar_historico($p, $autor, "Aprovado sem stock suficiente — {$p->notaPecas}. É preciso encomendar.", 'nota');
}

function obter_fornecedor(string $id): object
{
    return Db::obter('fornecedores', $id) ?? erro(422, 'Fornecedor não encontrado.');
}

function obter_encomenda(string $id): object
{
    return Db::obter('encomendas', $id) ?? erro(404, 'Encomenda não encontrada.');
}

function validar_peca(mixed $b, ?string $ignorarId = null): object
{
    $ref = mb_strtoupper(texto($b->referencia ?? null, 'Referência', 2, 40));
    if (algum(Db::todos('pecas'), fn($p) => $p->id !== $ignorarId && mb_strtoupper($p->referencia) === $ref)) erro(422, 'Já existe uma peça com esta referência.');
    $nome = texto($b->nome ?? null, 'Nome', 3, 120);
    if (algum(Db::todos('pecas'), fn($p) => $p->id !== $ignorarId && mb_strtolower($p->nome) === mb_strtolower($nome))) erro(422, 'Já existe uma peça com este nome no catálogo.');
    $custo = numero($b->precoCusto ?? null, 'Preço de custo', 0);
    $venda = numero($b->precoBase ?? null, 'Preço de venda', 1);
    if ($venda < $custo) erro(422, 'O preço de venda é inferior ao custo — a peça seria vendida com prejuízo.');
    return (object) [
        'referencia' => $ref, 'nome' => $nome, 'categoria' => texto($b->categoria ?? null, 'Categoria', 2, 60),
        'fornecedorId' => obter_fornecedor(str($b->fornecedorId ?? ''))->id, 'precoCusto' => $custo, 'precoBase' => $venda,
        'stockMinimo' => numero($b->stockMinimo ?? null, 'Stock mínimo', 0, 100000, true),
        'localizacao' => opcional($b->localizacao ?? null, 30),
    ];
}

function validar_linhas_encomenda(mixed $linhas): array
{
    if (!is_array($linhas) || !$linhas) erro(422, 'A encomenda tem de ter pelo menos uma peça.');
    $r = [];
    foreach (array_values($linhas) as $i => $l) {
        $n = $i + 1;
        $r[] = (object) [
            'pecaId' => obter_peca(str($l->pecaId ?? ''))->id,
            'quantidade' => numero($l->quantidade ?? null, "Linha $n: quantidade", 1, 10000, true),
            'precoCusto' => numero($l->precoCusto ?? null, "Linha $n: custo", 0),
        ];
    }
    return $r;
}

function dados_fornecedor(object $f, mixed $b): void
{
    foreach (['telefone', 'email', 'nif'] as $k) {
        $v = opcional($b->$k ?? null, 120);
        if ($v === null) unset($f->$k); else $f->$k = $v;
    }
}

function rotas_stock(): array
{
    return [
        ['GET', '/pecas', function () {
            $u = exigir('pecas.ver');
            Db::todos('fornecedores');
            return array_map(fn($p) => resumo_peca($p, $u), Db::todos('pecas'));
        }],
        ['POST', '/pecas', function ($r) {
            $u = exigir('pecas.editar');
            $dados = validar_peca($r->body);
            $stock = numero($r->body->stock ?? 0, 'Stock inicial', 0, 100000, true);
            $p = (object) ['id' => novo_id('peca', 'p')];
            atribuir($p, $dados);
            $p->stock = 0;
            Db::inserir('pecas', $p);
            if ($stock > 0) movimentar($p, $stock, 'acerto', $u, ['motivo' => 'Stock inicial ao criar a peça']);
            auditar($u->id, 'criar', 'peca', $p->id, $p->nome);
            return resumo_peca($p, $u);
        }],
        ['PUT', '/pecas/:id', function ($r) {
            $u = exigir('pecas.editar');
            $p = obter_peca($r->params['id']);
            $antes = $p->precoBase;
            atribuir($p, validar_peca($r->body, $p->id));
            auditar($u->id, 'editar', 'peca', $p->id, $antes != $p->precoBase ? "preço de venda $antes → {$p->precoBase}" : null);
            return resumo_peca($p, $u);
        }],
        ['POST', '/pecas/:id/acerto', function ($r) {
            $u = exigir('pecas.editar');
            $p = obter_peca($r->params['id']);
            $contado = numero($r->body->stockContado ?? null, 'Stock contado', 0, 100000, true);
            $motivo = texto($r->body->motivo ?? null, 'Motivo', 5, 200);
            $dif = $contado - $p->stock;
            if ($dif === 0) erro(422, 'O stock contado é igual ao registado — não há nada a acertar.');
            movimentar($p, $dif, 'acerto', $u, ['motivo' => $motivo]);
            auditar($u->id, 'acerto_stock', 'peca', $p->id, ($dif > 0 ? '+' : '') . "$dif: $motivo");
            return resumo_peca($p, $u);
        }],
        ['GET', '/movimentos', function ($r) {
            exigir('pecas.editar');
            $pecaId = $r->query['pecaId'] ?? null;
            $l = filtrar(Db::todos('movimentos'), fn($m) => !$pecaId || $m->pecaId === $pecaId);
            usort($l, fn($a, $b) => strcmp($b->data, $a->data));
            return array_slice($l, 0, 500);
        }],

        ['GET', '/fornecedores', function () {
            exigir('pecas.ver');
            return Db::todos('fornecedores');
        }],
        ['POST', '/fornecedores', function ($r) {
            $u = exigir('pecas.editar');
            $nome = texto($r->body->nome ?? null, 'Nome', 2, 120);
            if (algum(Db::todos('fornecedores'), fn($f) => mb_strtolower($f->nome) === mb_strtolower($nome))) erro(422, 'Já existe um fornecedor com este nome.');
            $f = (object) ['id' => novo_id('fornecedor', 'f'), 'nome' => $nome];
            dados_fornecedor($f, $r->body);
            $f->prazoEntregaDias = numero($r->body->prazoEntregaDias ?? 2, 'Prazo de entrega', 0, 120, true);
            $f->ativo = true;
            Db::inserir('fornecedores', $f);
            auditar($u->id, 'criar', 'fornecedor', $f->id, $f->nome);
            return $f;
        }],
        ['PUT', '/fornecedores/:id', function ($r) {
            $u = exigir('pecas.editar');
            $f = obter_fornecedor($r->params['id']);
            $f->nome = texto($r->body->nome ?? null, 'Nome', 2, 120);
            dados_fornecedor($f, $r->body);
            $f->prazoEntregaDias = numero($r->body->prazoEntregaDias ?? null, 'Prazo de entrega', 0, 120, true);
            $f->ativo = ($r->body->ativo ?? true) !== false;
            auditar($u->id, 'editar', 'fornecedor', $f->id);
            return $f;
        }],

        ['GET', '/encomendas', function () {
            exigir('pecas.editar');
            $l = Db::todos('encomendas');
            usort($l, fn($a, $b) => strcmp($b->criadoEm, $a->criadoEm));
            return $l;
        }],
        ['GET', '/encomendas/sugestao', function () {
            exigir('pecas.editar');
            $grupos = [];
            foreach (Db::todos('pecas') as $p) {
                $disp = $p->stock - reservado($p->id);
                $proj = $disp + encomendado($p->id);
                if ($proj >= $p->stockMinimo) continue;
                $q = max(1, $p->stockMinimo * 2 - $proj);
                $grupos[$p->fornecedorId] ??= (object) ['linhas' => [], 'motivos' => []];
                $grupos[$p->fornecedorId]->linhas[] = (object) ['pecaId' => $p->id, 'quantidade' => $q, 'precoCusto' => $p->precoCusto];
                $grupos[$p->fornecedorId]->motivos[] = $disp < 0 ? "{$p->nome}: faltam " . -$disp . ' para processos aprovados' : "{$p->nome}: abaixo do mínimo ($proj/{$p->stockMinimo})";
            }
            $r = [];
            foreach ($grupos as $fid => $g) {
                $ids = array_map(fn($l) => $l->pecaId, $g->linhas);
                $r[] = (object) [
                    'fornecedorId' => $fid, 'linhas' => $g->linhas, 'motivos' => $g->motivos,
                    'processosIds' => array_map(fn($p) => $p->id, filtrar(Db::todos('processos'), fn($p) => !empty($p->aguardaPecas)
                        && algum($p->tarefas ?? [], fn($t) => empty($t->feita) && in_array($t->pecaId ?? null, $ids, true)))),
                ];
            }
            return $r;
        }],
        ['POST', '/encomendas', function ($r) {
            $u = exigir('pecas.editar');
            $f = obter_fornecedor(str($r->body->fornecedorId ?? ''));
            $seq = novo_id('encomenda', '');
            $e = (object) [
                'id' => "e$seq", 'numero' => 'ENC-' . date('Y') . '-' . str_pad($seq, 3, '0', STR_PAD_LEFT), 'fornecedorId' => $f->id,
                'estado' => 'rascunho', 'linhas' => validar_linhas_encomenda($r->body->linhas ?? null),
                'processosIds' => array_values(array_filter(is_array($r->body->processosIds ?? null) ? $r->body->processosIds : [], fn($id) => is_string($id) && Db::obter('processos', $id))),
            ];
            $notas = opcional($r->body->notas ?? null, 500);
            if ($notas) $e->notas = $notas;
            $e->criadoEm = agora();
            $e->criadoPorId = $u->id;
            Db::inserir('encomendas', $e);
            auditar($u->id, 'criar', 'encomenda', $e->id, $e->numero);
            return $e;
        }],
        ['PUT', '/encomendas/:id', function ($r) {
            $u = exigir('pecas.editar');
            $e = obter_encomenda($r->params['id']);
            if ($e->estado !== 'rascunho') erro(422, 'Só é possível alterar encomendas em rascunho.');
            $e->linhas = validar_linhas_encomenda($r->body->linhas ?? null);
            $notas = opcional($r->body->notas ?? null, 500);
            if ($notas) $e->notas = $notas; else unset($e->notas);
            auditar($u->id, 'editar', 'encomenda', $e->id);
            return $e;
        }],
        ['POST', '/encomendas/:id/enviar', function ($r) {
            $u = exigir('pecas.editar');
            $e = obter_encomenda($r->params['id']);
            if ($e->estado !== 'rascunho') erro(422, 'Esta encomenda já foi enviada.');
            $f = obter_fornecedor($e->fornecedorId);
            $e->estado = 'enviada';
            $e->enviadaEm = agora();
            $e->previsaoEntrega = iso(microtime(true) + $f->prazoEntregaDias * 86400);
            auditar($u->id, 'enviar', 'encomenda', $e->id, $e->numero);
            return $e;
        }],
        ['POST', '/encomendas/:id/cancelar', function ($r) {
            $u = exigir('pecas.editar');
            $e = obter_encomenda($r->params['id']);
            if (in_array($e->estado, ['recebida', 'cancelada'], true)) erro(422, 'Esta encomenda já está encerrada.');
            $e->estado = 'cancelada';
            auditar($u->id, 'cancelar', 'encomenda', $e->id, $e->numero);
            return $e;
        }],
        ['POST', '/encomendas/:id/receber', function ($r) {
            $u = exigir('pecas.editar');
            $e = obter_encomenda($r->params['id']);
            if ($e->estado !== 'enviada') erro(422, 'Só é possível receber encomendas enviadas.');
            $recebidas = [];
            foreach (is_array($r->body->linhas ?? null) ? $r->body->linhas : [] as $l) $recebidas[str($l->pecaId ?? '')] = $l->quantidadeRecebida ?? null;
            $dif = 0;
            foreach ($e->linhas as $l) {
                $q = numero($recebidas[$l->pecaId] ?? $l->quantidade, 'Quantidade recebida', 0, 100000, true);
                $l->quantidadeRecebida = $q;
                if ($q !== $l->quantidade) $dif++;
                if ($q === 0) continue;
                $p = obter_peca($l->pecaId);
                $total = $p->stock + $q;
                $p->precoCusto = jsround(($p->stock * $p->precoCusto + $q * $l->precoCusto) / $total);
                movimentar($p, $q, 'entrada', $u, ['encomendaId' => $e->id, 'motivo' => "Receção {$e->numero}"]);
            }
            $e->estado = 'recebida';
            $e->recebidaEm = agora();
            $desbloqueados = [];
            foreach (Db::todos('processos') as $p) {
                if (empty($p->aguardaPecas) || $p->estado !== 'em_reparacao') continue;
                $precisa = algum($p->tarefas ?? [], fn($t) => empty($t->feita) && algum($e->linhas, fn($l) => $l->pecaId === ($t->pecaId ?? null))) || in_array($p->id, $e->processosIds, true);
                if ($precisa && !faltas_do_processo($p)) {
                    $p->aguardaPecas = false;
                    unset($p->notaPecas);
                    registar_historico($p, $u->nome, "Peças recebidas ({$e->numero}) — reparação desbloqueada", 'nota');
                    notificar(['utilizadores' => [$p->mecanicoId ?? null], 'perfis' => ['chefe_oficina']], 'Peças chegaram', "{$p->numero} — a reparação pode continuar.", "/processos/{$p->id}", $u->id);
                    $desbloqueados[] = $p->numero;
                }
            }
            auditar($u->id, 'receber', 'encomenda', $e->id, $e->numero . ($dif ? " · $dif linha(s) com diferenças" : '') . ($desbloqueados ? ' · desbloqueou ' . implode(', ', $desbloqueados) : ''));
            return (object) ['encomenda' => $e, 'desbloqueados' => $desbloqueados];
        }],
    ];
}
