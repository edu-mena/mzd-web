<?php
// Financeiro: recibos, anulações, descontos, caixa, dívidas e conta corrente. Porte de src/api/mock/financeiro.ts.

declare(strict_types=1);

function caixa_fechada(string $dia): bool
{
    return algum(Db::todos('fechos'), fn($f) => $f->dia === $dia);
}

function exigir_caixa_aberta(?string $dia = null): void
{
    $hoje = dia_local();
    $dia ??= $hoje;
    if (caixa_fechada($dia)) {
        erro(422, $dia === $hoje
            ? 'A caixa de hoje já foi fechada. Peça à Direção para a reabrir antes de registar este pagamento.'
            : 'A caixa desse dia já foi fechada. Só a Direção a pode reabrir.');
    }
}

function proximo_recibo(): string
{
    return 'RC-' . date('Y') . '-' . str_pad(novo_id('recibo', ''), 4, '0', STR_PAD_LEFT);
}

/** Desconto pedido no orçamento: até ao limite aplica-se logo; acima fica pendente (exceto para a Direção). */
function avaliar_desconto(mixed $b, ?object $atual, object $u): ?object
{
    $pct = (float) ($b->percentagem ?? 0);
    if (!$pct) return null;
    $percentagem = numero($b->percentagem, 'Desconto (%)', 0.5, 50);
    $motivo = texto($b->motivo ?? null, 'Motivo do desconto', 5, 200);
    if ($atual && $atual->percentagem == $percentagem && $atual->estado !== 'recusado') {
        $c = copia($atual);
        $c->motivo = $motivo;
        return $c;
    }
    $agora = agora();
    $limite = configuracao()->descontoMaximoPct;
    $auto = $percentagem <= $limite || pode($u, 'financeiro.supervisionar');
    $d = (object) ['percentagem' => $percentagem, 'motivo' => $motivo, 'estado' => $auto ? 'aprovado' : 'pendente', 'pedidoPorId' => $u->id, 'pedidoEm' => $agora];
    if ($auto) {
        $d->decididoPorId = $u->id;
        $d->decididoEm = $agora;
        $d->motivoDecisao = $percentagem <= $limite ? "Dentro do limite de $limite%" : 'Aplicado pela Direção';
    }
    return $d;
}

/** Pagamentos de um processo: das faturas (serviço e parqueamento) e adiantamentos. */
function pagamentos_de(object $p): array
{
    $r = [];
    foreach (faturas_de($p) as $f) foreach ($f->pagamentos as $pg) $r[] = $pg;
    foreach ($p->adiantamentos ?? [] as $pg) $r[] = $pg;
    return $r;
}

function todos_pagamentos(): array
{
    $r = [];
    foreach (Db::todos('processos') as $p) foreach (pagamentos_de($p) as $pg) $r[] = [$pg, $p];
    return $r;
}

function totais_forma(): object
{
    return (object) ['numerario' => 0, 'transferencia' => 0, 'tpa' => 0, 'multicaixa' => 0];
}

function rotas_financeiro(): array
{
    return [
        ['POST', '/processos/:id/desconto', function ($r) {
            $u = exigir('financeiro.supervisionar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'orcamentacao');
            $d = $p->orcamento->desconto ?? null;
            if (!$d || $d->estado !== 'pendente') erro(422, 'Não há nenhum desconto pendente neste processo.');
            $decisao = um_de($r->body->decisao ?? null, ['aprovado', 'recusado'], 'Decisão');
            $motivo = $decisao === 'recusado' ? texto($r->body->motivo ?? null, 'Motivo da recusa', 3, 200) : opcional($r->body->motivo ?? null, 200);
            $d->estado = $decisao;
            $d->decididoPorId = $u->id;
            $d->decididoEm = agora();
            if ($motivo) $d->motivoDecisao = $motivo; else unset($d->motivoDecisao);
            registar_historico($p, $u->nome, "Desconto de {$d->percentagem}% $decisao pela Direção" . ($motivo ? " ($motivo)" : ''), $decisao === 'recusado' ? 'rejeicao' : 'nota');
            auditar($u->id, "desconto_$decisao", 'processo', $p->id, "{$d->percentagem}%");
            notificar(['utilizadores' => [$d->pedidoPorId]], "Desconto $decisao", "{$p->numero} — {$d->percentagem}%" . ($motivo ? ": $motivo" : ''), "/processos/{$p->id}", $u->id);
            return (object) ['id' => $p->id];
        }],

        ['POST', '/processos/:id/pagamentos/:pid/anular', function ($r) {
            $u = exigir('pagamentos.registar');
            $p = obter_processo($r->params['id']);
            if ($p->estado === 'entregue') erro(422, 'A viatura já foi entregue — não é possível anular pagamentos deste processo.');
            $pg = achar(pagamentos_de($p), fn($x) => $x->id === $r->params['pid']);
            if (!$pg) erro(404, 'Pagamento não encontrado.');
            if (!empty($pg->anulado)) erro(422, 'Este pagamento já está anulado.');
            $dia = dia_local($pg->data);
            if ($dia !== dia_local() && !pode($u, 'financeiro.supervisionar')) erro(422, 'Só é possível anular pagamentos do próprio dia. Para dias anteriores, fale com a Direção.');
            exigir_caixa_aberta($dia);
            $pg->anulado = (object) ['motivo' => texto($r->body->motivo ?? null, 'Motivo da anulação', 5, 200), 'data' => agora(), 'porId' => $u->id];
            registar_historico($p, $u->nome, "Recibo {$pg->numeroRecibo} anulado ({$pg->anulado->motivo})", 'rejeicao');
            auditar($u->id, 'anular_pagamento', 'processo', $p->id, "{$pg->numeroRecibo} · {$pg->valor} · {$pg->anulado->motivo}");
            return (object) ['id' => $p->id];
        }],

        ['GET', '/caixa', function ($r) {
            exigir('faturacao.ver');
            $dia = $r->query['dia'] ?? dia_local();
            $doDia = filtrar(todos_pagamentos(), fn($x) => dia_local($x[0]->data) === $dia);
            $totais = totais_forma();
            foreach ($doDia as [$pg]) if (empty($pg->anulado)) $totais->{$pg->forma} += $pg->valor;
            usort($doDia, fn($a, $b) => strcmp($a[0]->data, $b[0]->data));
            Db::todos('clientes'); Db::todos('viaturas');
            return (object) [
                'dia' => $dia, 'totais' => $totais,
                'fecho' => achar(Db::todos('fechos'), fn($f) => $f->dia === $dia),
                'pagamentos' => array_map(function ($x) {
                    [$pg, $p] = $x;
                    $c = Db::obter('clientes', $p->clienteId);
                    $o = copia($pg);
                    $o->processoId = $p->id;
                    $o->processoNumero = $p->numero;
                    $o->processoEstado = $p->estado;
                    $o->cliente = $c->nome ?? '—';
                    if (!empty($c->nif)) $o->clienteNif = $c->nif;
                    $o->matricula = Db::obter('viaturas', $p->viaturaId)->matricula ?? null;
                    $f = achar(faturas_de($p), fn($f) => algum($f->pagamentos, fn($y) => $y->id === $pg->id));
                    if ($f) $o->faturaNumero = $f->numero;
                    return $o;
                }, $doDia),
            ];
        }],
        ['GET', '/caixa/fechos', function () {
            exigir('faturacao.ver');
            $l = Db::todos('fechos');
            usort($l, fn($a, $b) => strcmp($b->dia, $a->dia));
            return array_slice($l, 0, 60);
        }],
        ['POST', '/caixa/fechar', function ($r) {
            $u = exigir('pagamentos.registar');
            $dia = str($r->body->dia ?? '');
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dia)) erro(422, 'Dia inválido.');
            if ($dia > dia_local()) erro(422, 'Não é possível fechar a caixa de um dia futuro.');
            if (caixa_fechada($dia)) erro(422, 'A caixa deste dia já está fechada.');
            $doDia = filtrar(todos_pagamentos(), fn($x) => dia_local($x[0]->data) === $dia && empty($x[0]->anulado));
            $totais = totais_forma();
            foreach ($doDia as [$pg]) $totais->{$pg->forma} += $pg->valor;
            $contado = numero($r->body->numerarioContado ?? null, 'Numerário contado', 0);
            $dif = arred($contado - $totais->numerario);
            $notas = opcional($r->body->notas ?? null, 500);
            if ($dif != 0 && (!$notas || mb_strlen($notas) < 5)) erro(422, 'Há diferença no numerário — explique-a nas notas antes de fechar.');
            $f = (object) ['id' => novo_id('fecho', 'fc'), 'dia' => $dia, 'totais' => $totais, 'numerarioContado' => $contado, 'diferenca' => $dif, 'nRecibos' => count($doDia)];
            if ($notas) $f->notas = $notas;
            $f->fechadoPorId = $u->id;
            $f->fechadoEm = agora();
            Db::inserir('fechos', $f);
            auditar($u->id, 'fechar_caixa', 'caixa', $dia, $dif ? "diferença $dif" : null);
            return $f;
        }],
        ['POST', '/caixa/reabrir', function ($r) {
            $u = exigir('financeiro.supervisionar');
            $dia = str($r->body->dia ?? '');
            if (!caixa_fechada($dia)) erro(422, 'A caixa deste dia não está fechada.');
            $motivo = texto($r->body->motivo ?? null, 'Motivo da reabertura', 5, 200);
            foreach (Db::todos('fechos') as $f) if ($f->dia === $dia) Db::apagar('fechos', $f->id);
            auditar($u->id, 'reabrir_caixa', 'caixa', $dia, $motivo);
            return (object) ['dia' => $dia];
        }],

        ['GET', '/financeiro/dividas', function () {
            exigir('faturacao.ver');
            $agora = time();
            $por = [];
            foreach (Db::todos('processos') as $p) {
                foreach (faturas_de($p) as $f) {
                    $saldo = saldo_em_aberto($f);
                    if ($saldo <= 0) continue;
                    $c = Db::obter('clientes', $p->clienteId);
                    $dias = (int) floor(($agora - ts($f->data)) / 86400);
                    $d = $por[$c->id] ??= (object) [
                        'cliente' => (object) ['id' => $c->id, 'nome' => $c->nome, 'telefone' => $c->telefone, 'consentimentoMensagens' => (bool) ($c->consentimentoMensagens ?? false)],
                        'total' => 0, 'escaloes' => [0, 0, 0, 0], 'faturas' => [],
                    ];
                    $d->total += $saldo;
                    $d->escaloes[$dias <= 30 ? 0 : ($dias <= 60 ? 1 : ($dias <= 90 ? 2 : 3))] += $saldo;
                    $d->faturas[] = (object) ['processoId' => $p->id, 'processoNumero' => $p->numero, 'numero' => $f->numero, 'data' => $f->data, 'dias' => $dias, 'saldo' => $saldo];
                }
            }
            $l = array_values($por);
            usort($l, fn($a, $b) => $b->total <=> $a->total);
            return $l;
        }],

        ['GET', '/clientes/:id/conta-corrente', function ($r) {
            exigir('valores.ver');
            $movs = [];
            foreach (filtrar(Db::todos('processos'), fn($p) => $p->clienteId === $r->params['id']) as $p) {
                foreach (faturas_de($p) as $f) $movs[] = (object) ['data' => $f->data, 'tipo' => 'fatura', 'documento' => $f->numero, 'processoId' => $p->id, 'processoNumero' => $p->numero, 'debito' => $f->valorTotal, 'credito' => 0];
                foreach (pagamentos_de($p) as $pg) {
                    $movs[] = (object) ['data' => $pg->data, 'tipo' => 'pagamento', 'documento' => $pg->numeroRecibo, 'processoId' => $p->id, 'processoNumero' => $p->numero, 'debito' => 0, 'credito' => $pg->valor];
                    if (!empty($pg->anulado)) $movs[] = (object) ['data' => $pg->anulado->data, 'tipo' => 'anulacao', 'documento' => "Anulação {$pg->numeroRecibo}", 'processoId' => $p->id, 'processoNumero' => $p->numero, 'debito' => $pg->valor, 'credito' => 0];
                }
            }
            usort($movs, fn($a, $b) => strcmp($a->data, $b->data));
            $saldo = 0;
            foreach ($movs as $m) { $saldo = arred($saldo + $m->debito - $m->credito); $m->saldo = $saldo; }
            return $movs;
        }],
    ];
}
