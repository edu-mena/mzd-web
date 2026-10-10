<?php
// Relatórios por período e alertas do painel. Porte de src/api/mock/relatorios.ts.

declare(strict_types=1);

function dentro(?string $iso, array $i): bool
{
    $t = ts($iso);
    return $t !== null && $t >= $i[0] && $t <= $i[1];
}

function intervalo(string $de, string $ate): array
{
    return [(new DateTime("$de 00:00:00"))->getTimestamp(), (new DateTime("$ate 23:59:59"))->getTimestamp() + 0.999];
}

function data_entrega(object $p): ?string
{
    return $p->entrega->data ?? (achar($p->historico, fn($h) => ($h->estado ?? null) === 'entregue')->data ?? null);
}

function pagamentos_validos(object $p): array
{
    return filtrar(pagamentos_de($p), fn($x) => empty($x->anulado));
}

function linhas_aprovadas(object $p): array
{
    return [...(($p->orcamento->estado ?? null) === 'aprovado' ? [$p->orcamento] : []), ...filtrar($p->orcamentosAdicionais ?? [], fn($a) => $a->estado === 'aprovado')];
}

function um_dec(float|int $n): float|int
{
    $r = floor($n * 10 + 0.5) / 10;
    return $r == (int) $r ? (int) $r : $r;
}

function pct(float|int $parte, float|int $todo): float|int
{
    return $todo ? um_dec($parte / $todo * 100) : 0;
}

function media(array $v): float|int
{
    return $v ? array_sum($v) / count($v) : 0;
}

function mediana(array $v): ?float
{
    if (!$v) return null;
    sort($v);
    $m = intdiv(count($v), 2);
    return count($v) % 2 ? (float) $v[$m] : ($v[$m - 1] + $v[$m]) / 2;
}

function parqueamento_faturado(array $ps, array $i): float|int
{
    $s = 0;
    foreach ($ps as $p) foreach ($p->faturasParqueamento ?? [] as $f) if (dentro($f->data, $i)) $s += $f->valorTotal;
    return $s;
}

function indicadores(array $i): array
{
    $ps = Db::todos('processos');
    $faturas = filtrar($ps, fn($p) => dentro($p->fatura->data ?? null, $i));
    $servicos = soma($faturas, fn($p) => $p->fatura->valorTotal);
    $recebido = 0;
    foreach ($ps as $p) foreach (pagamentos_validos($p) as $x) if (dentro($x->data, $i)) $recebido += $x->valor;
    $entregues = filtrar($ps, fn($p) => dentro(data_entrega($p), $i));
    $noPrazo = count(filtrar($entregues, fn($p) => data_entrega($p) <= $p->prazoEntrega));
    $qualidade = filtrar($ps, fn($p) => dentro($p->checklistQualidade->dataHora ?? null, $i));
    $comRetrabalho = count(filtrar($entregues, fn($p) => ($p->retrabalhos ?? 0) > 0));
    $aprovados = count(filtrar($ps, fn($p) => dentro($p->autorizacao->data ?? null, $i)));
    $recusados = count(filtrar($ps, fn($p) => ($p->orcamento->estado ?? null) === 'recusado' && dentro($p->cancelamento->data ?? null, $i)));
    return [
        'faturado' => $servicos + parqueamento_faturado($ps, $i),
        'recebido' => $recebido,
        'ticketMedio' => $faturas ? jsround($servicos / count($faturas)) : null,
        'entradas' => count(filtrar($ps, fn($p) => dentro($p->criadoEm, $i))),
        'entregas' => count($entregues),
        'cumprimentoPrazo' => $entregues ? pct($noPrazo, count($entregues)) : null,
        'cicloMedioDias' => $entregues ? um_dec(media(array_map(fn($p) => (ts(data_entrega($p)) - ts($p->criadoEm)) / 86400, $entregues))) : null,
        'retrabalhoPct' => $entregues ? pct($comRetrabalho, count($entregues)) : ($qualidade ? pct(count(filtrar($qualidade, fn($p) => !$p->checklistQualidade->aprovado)), count($qualidade)) : null),
        'aprovacaoPct' => ($aprovados + $recusados) ? pct($aprovados, $aprovados + $recusados) : null,
        'novos' => count(filtrar(Db::todos('clientes'), fn($c) => dentro(strlen($c->desde) === 10 ? "{$c->desde}T12:00:00" : $c->desde, $i))),
    ];
}

function calcular_relatorio(string $de, string $ate, object $u): object
{
    $dias = dias_inclusive($de, $ate);
    $anteriorAte = somar_dias_iso($de, -1);
    $anteriorDe = somar_dias_iso($anteriorAte, -($dias - 1));
    $i = intervalo($de, $ate);
    $a = indicadores($i);
    $b = indicadores(intervalo($anteriorDe, $anteriorAte));
    $par = fn($k) => (object) ['atual' => $a[$k], 'anterior' => $b[$k]];
    $valores = pode($u, 'valores.ver');
    $ps = Db::todos('processos');
    $faturados = filtrar($ps, fn($p) => dentro($p->fatura->data ?? null, $i));
    $aprov = [];
    foreach ($faturados as $p) foreach (linhas_aprovadas($p) as $o) $aprov[] = $o;

    $negocio = null;
    if ($valores) {
        $totais = array_map('calcular_totais', $aprov);
        $venda = 0; $custo = 0;
        foreach ($aprov as $o) foreach ($o->pecas as $l) {
            $peca = !empty($l->pecaId) ? Db::obter('pecas', $l->pecaId) : null;
            if (!$peca) continue;
            $venda += $l->quantidade * $l->precoUnitario;
            $custo += $l->quantidade * $peca->precoCusto;
        }
        $fim = new DateTime("$ate 12:00:00");
        $porMes = [];
        for ($k = 0; $k < 12; $k++) {
            $mes = (new DateTime($fim->format('Y-m-01')))->modify('-' . (11 - $k) . ' months')->format('Y-m');
            $fat = 0; $rec = 0;
            foreach ($ps as $p) {
                foreach (faturas_de($p) as $f) if (str_starts_with(dia_local($f->data), $mes)) $fat += $f->valorTotal;
                foreach (pagamentos_validos($p) as $x) if (str_starts_with(dia_local($x->data), $mes)) $rec += $x->valor;
            }
            $porMes[] = (object) ['mes' => $mes, 'faturado' => $fat, 'recebido' => $rec];
        }
        $negocio = (object) [
            'faturado' => $par('faturado'), 'recebido' => $par('recebido'), 'ticketMedio' => $par('ticketMedio'),
            'pecas' => soma($totais, fn($t) => $t->pecas), 'maoObra' => soma($totais, fn($t) => $t->maoObra), 'descontos' => soma($totais, fn($t) => $t->desconto),
            'parqueamento' => parqueamento_faturado($ps, $i),
            'margemPecas' => pode($u, 'pecas.editar') && $venda ? (object) ['venda' => $venda, 'custo' => $custo] : null,
            'porMes' => $porMes,
        ];
    }

    $duracoes = [];
    foreach ($ps as $p) {
        $evs = filtrar($p->historico, fn($h) => !empty($h->estado));
        usort($evs, fn($x, $y) => strcmp($x->data, $y->data));
        for ($k = 0; $k < count($evs) - 1; $k++) {
            $e = $evs[$k]->estado;
            if (!in_array($e, ESTADOS_ORDEM, true) || $e === 'entregue' || !dentro($evs[$k + 1]->data, $i)) continue;
            $duracoes[$e][] = (ts($evs[$k + 1]->data) - ts($evs[$k]->data)) / 3600;
        }
    }
    $tempoPorEtapa = array_map(fn($e) => (object) ['estado' => $e, 'mediaHoras' => um_dec(media($duracoes[$e] ?? [])), 'n' => count($duracoes[$e] ?? [])], array_slice(ESTADOS_ORDEM, 0, 7));
    $respostas = [];
    foreach ($ps as $p) {
        if (empty($p->orcamento->enviadoEm)) continue;
        $recusado = ($p->orcamento->estado ?? null) === 'recusado' && dentro($p->cancelamento->data ?? null, $i);
        if (!dentro($p->autorizacao->data ?? null, $i) && !$recusado) continue;
        $respostas[] = (ts($p->autorizacao->data ?? $p->cancelamento->data) - ts($p->orcamento->enviadoEm)) / 3600;
    }
    $motivos = [];
    foreach ($ps as $p) {
        if (($p->orcamento->estado ?? null) !== 'recusado' || !dentro($p->cancelamento->data ?? null, $i)) continue;
        $m = $p->orcamento->motivoRecusa ?? 'Sem motivo registado';
        $motivos[$m] = ($motivos[$m] ?? 0) + 1;
    }
    arsort($motivos);

    $entregues = filtrar($ps, fn($p) => dentro(data_entrega($p), $i));
    $equipa = [];
    foreach (filtrar(Db::todos('utilizadores'), fn($x) => $x->perfil === 'mecanico') as $m) {
        $seus = filtrar($entregues, fn($p) => ($p->mecanicoId ?? null) === $m->id);
        $horas = 0;
        foreach ($ps as $p) foreach ($p->registosTempo ?? [] as $r) {
            if ($r->mecanicoId === $m->id && dentro($r->inicio, $i)) $horas += ((isset($r->fim) ? ts($r->fim) : microtime(true)) - ts($r->inicio)) / 3600;
        }
        $mao = [];
        foreach ($seus as $p) foreach (linhas_aprovadas($p) as $o) foreach ($o->maoObra as $l) $mao[] = $l;
        $equipa[] = (object) [
            'mecanicoId' => $m->id, 'nome' => $m->nome, 'concluidos' => count($seus), 'horasTrabalhadas' => um_dec($horas),
            'horasFaturadas' => um_dec(soma($mao, fn($l) => $l->horas)), 'retrabalhos' => soma($seus, fn($p) => $p->retrabalhos ?? 0),
            'maoObraFaturada' => $valores ? soma($mao, fn($l) => $l->horas * $l->valorHora) : null,
        ];
    }

    $entradas = filtrar($ps, fn($p) => dentro($p->criadoEm, $i));
    $clientesPeriodo = array_values(array_unique(array_map(fn($p) => $p->clienteId, $entradas)));
    $iniIso = iso($i[0]);
    $recorrentes = count(filtrar($clientesPeriodo, fn($c) => algum($ps, fn($p) => $p->clienteId === $c && $p->criadoEm < $iniIso)));
    $porCliente = [];
    foreach ($entradas as $p) { $porCliente[$p->clienteId] ??= ['processos' => 0, 'faturado' => 0]; $porCliente[$p->clienteId]['processos']++; }
    foreach ($faturados as $p) { $porCliente[$p->clienteId] ??= ['processos' => 0, 'faturado' => 0]; $porCliente[$p->clienteId]['faturado'] += $p->fatura->valorTotal; }
    $top = [];
    foreach ($porCliente as $cid => $x) $top[] = (object) ['clienteId' => $cid, 'nome' => Db::obter('clientes', (string) $cid)->nome ?? '—', 'processos' => $x['processos'], 'faturado' => $valores ? $x['faturado'] : null];
    usort($top, fn($x, $y) => (($y->faturado ?? 0) <=> ($x->faturado ?? 0)) ?: ($y->processos <=> $x->processos));
    $sistemas = [];
    foreach ($ps as $p) {
        if (!dentro($p->diagnostico->concluidoEm ?? null, $i)) continue;
        foreach ($p->diagnostico->itens as $x) if ($x->estado !== 'ok') $sistemas[$x->sistema] = ($sistemas[$x->sistema] ?? 0) + 1;
    }
    arsort($sistemas);
    $pecasMap = [];
    foreach ($aprov as $o) foreach ($o->pecas as $l) {
        $pecasMap[$l->descricao] ??= ['quantidade' => 0, 'valor' => 0];
        $pecasMap[$l->descricao]['quantidade'] += $l->quantidade;
        $pecasMap[$l->descricao]['valor'] += $l->quantidade * $l->precoUnitario;
    }
    uasort($pecasMap, fn($x, $y) => $y['quantidade'] <=> $x['quantidade']);
    $med = mediana($respostas);

    return (object) [
        'periodo' => (object) ['de' => $de, 'ate' => $ate, 'anteriorDe' => $anteriorDe, 'anteriorAte' => $anteriorAte],
        'negocio' => $negocio,
        'operacao' => (object) [
            'entradas' => $par('entradas'), 'entregas' => $par('entregas'), 'cumprimentoPrazo' => $par('cumprimentoPrazo'),
            'cicloMedioDias' => $par('cicloMedioDias'), 'retrabalhoPct' => $par('retrabalhoPct'), 'aprovacaoPct' => $par('aprovacaoPct'),
            'respostaClienteHoras' => $med === null ? null : um_dec($med),
            'tempoPorEtapa' => $tempoPorEtapa,
            'motivosRecusa' => array_map(fn($k, $v) => (object) ['motivo' => (string) $k, 'total' => $v], array_keys($motivos), $motivos),
        ],
        'equipa' => $equipa,
        'clientes' => (object) [
            'novos' => $par('novos'), 'recorrentesPct' => pct($recorrentes, count($clientesPeriodo)), 'top' => array_slice($top, 0, 10),
            'sistemas' => array_map(fn($k, $v) => (object) ['sistema' => (string) $k, 'total' => $v], array_keys($sistemas), $sistemas),
            'pecasTop' => array_slice(array_map(fn($k, $x) => (object) ['descricao' => (string) $k, 'quantidade' => $x['quantidade'], 'valor' => $valores ? $x['valor'] : null], array_keys($pecasMap), $pecasMap), 0, 10),
        ],
    ];
}

function alertas(object $u): array
{
    $agora = time();
    $hoje = dia_local();
    $todos = Db::todos('processos');
    $ativos = filtrar($todos, fn($p) => esta_ativo($p->estado));
    $lista = [];
    $add = function (array $a) use (&$lista) { if ($a['total'] > 0) $lista[] = (object) $a; };
    $plural = fn(int $n, string $s, string $p) => "$n " . ($n === 1 ? $s : $p);

    if (pode($u, 'financeiro.supervisionar')) {
        $n = count(filtrar($ativos, fn($p) => ($p->orcamento->desconto->estado ?? null) === 'pendente'));
        $add(['id' => 'descontos', 'gravidade' => 'aviso', 'titulo' => $plural($n, 'desconto para aprovar', 'descontos para aprovar'), 'texto' => 'O orçamento não segue para o cliente sem a sua decisão.', 'link' => '/faturacao', 'total' => $n]);
    }
    if (pode($u, 'pagamentos.registar')) {
        $dias = [];
        foreach ($todos as $p) foreach (pagamentos_validos($p) as $x) $dias[dia_local($x->data)] = true;
        $dias = array_keys($dias);
        $abertos = filtrar($dias, fn($d) => $d < $hoje && $d >= somar_dias_iso($hoje, -7) && !caixa_fechada($d));
        sort($abertos);
        $n = count($abertos);
        $add(['id' => 'caixa', 'gravidade' => 'critico', 'titulo' => $n === 1 ? 'Caixa de ' . implode('/', array_slice(array_reverse(explode('-', $abertos[0])), 0, 2)) . ' por fechar' : $plural($n, 'dia', 'dias') . ' com a caixa por fechar', 'texto' => 'Feche a caixa com a contagem do numerário.', 'link' => '/faturacao', 'total' => $n]);
        $n = count(filtrar($ativos, fn($p) => $p->estado === 'em_reparacao' && falta_pagamento_aceitacao($p) > 0));
        $add(['id' => 'pagamento-aceitacao', 'gravidade' => 'aviso', 'titulo' => $plural($n, 'orçamento aceite sem o pagamento da aceitação', 'orçamentos aceites sem o pagamento da aceitação'), 'texto' => 'A reparação só começa depois de receber este pagamento.', 'link' => '/processos?estado=em_reparacao', 'total' => $n]);
        $n = count(filtrar($todos, fn($p) => (esta_ativo($p->estado) || $p->estado === 'cancelado') && parqueamento_por_faturar($p)));
        $add(['id' => 'parqueamento', 'gravidade' => 'info', 'titulo' => $plural($n, 'viatura com parqueamento a contar', 'viaturas com parqueamento a contar'), 'texto' => 'Cobrado à parte, antes de a viatura sair.', 'link' => '/processos', 'total' => $n]);
    }
    if (pode($u, 'processos.criar')) {
        $n = count(filtrar($ativos, fn($p) => $p->estado === 'recepcao' && empty($p->fichaRecepcao->assinaturaCliente)));
        $add(['id' => 'fichas', 'gravidade' => 'aviso', 'titulo' => $plural($n, 'ficha de entrada por digitalizar', 'fichas de entrada por digitalizar'), 'texto' => 'O diagnóstico só começa com a ficha assinada pelo cliente.', 'link' => '/processos?estado=recepcao', 'total' => $n]);
    }
    if (pode($u, 'processos.ver')) {
        $n = count(filtrar($ativos, fn($p) => ts($p->prazoEntrega) < $agora));
        $add(['id' => 'atrasos', 'gravidade' => 'critico', 'titulo' => $plural($n, 'viatura com o prazo ultrapassado', 'viaturas com o prazo ultrapassado'), 'texto' => 'A entrega prometida ao cliente já passou.', 'link' => '/processos?filtro=atrasados', 'total' => $n]);
    }
    if (pode($u, 'processos.atribuir')) {
        $n = count(filtrar($ativos, fn($p) => $p->estado === 'recepcao' && empty($p->mecanicoId)));
        $add(['id' => 'sem-mecanico', 'gravidade' => 'aviso', 'titulo' => $plural($n, 'viatura sem mecânico', 'viaturas sem mecânico'), 'texto' => 'Atribua para o diagnóstico começar.', 'link' => '/oficina', 'total' => $n]);
    }
    if (pode($u, 'qualidade.validar')) {
        $n = count(filtrar($ativos, fn($p) => $p->estado === 'controlo_qualidade'));
        $add(['id' => 'qualidade', 'gravidade' => 'info', 'titulo' => $plural($n, 'viatura para controlo de qualidade', 'viaturas para controlo de qualidade'), 'texto' => 'A reparação terminou; falta a verificação final.', 'link' => '/processos?estado=controlo_qualidade', 'total' => $n]);
    }
    if (pode($u, 'aprovacao.registar')) {
        $n = count(filtrar($ativos, fn($p) => $p->estado === 'aguarda_aprovacao' && !empty($p->orcamento->enviadoEm) && $agora - ts($p->orcamento->enviadoEm) > 2 * 86400));
        $add(['id' => 'sem-resposta', 'gravidade' => 'aviso', 'titulo' => $plural($n, 'orçamento sem resposta há mais de 2 dias', 'orçamentos sem resposta há mais de 2 dias'), 'texto' => 'Contacte o cliente; a viatura está parada.', 'link' => '/processos?estado=aguarda_aprovacao', 'total' => $n]);
    }
    if (pode($u, 'pecas.editar')) {
        $n = count(filtrar(Db::todos('pecas'), fn($p) => $p->stock - reservado($p->id) <= $p->stockMinimo));
        $add(['id' => 'stock', 'gravidade' => 'aviso', 'titulo' => $plural($n, 'peça abaixo do mínimo', 'peças abaixo do mínimo'), 'texto' => 'Veja a sugestão de encomenda.', 'link' => '/pecas', 'total' => $n]);
        $n = count(filtrar(Db::todos('encomendas'), fn($e) => $e->estado === 'enviada' && !empty($e->previsaoEntrega) && ts($e->previsaoEntrega) < $agora));
        $add(['id' => 'encomendas', 'gravidade' => 'aviso', 'titulo' => $plural($n, 'encomenda atrasada', 'encomendas atrasadas'), 'texto' => 'Já passou a data prevista de entrega do fornecedor.', 'link' => '/pecas', 'total' => $n]);
    }
    if (pode($u, 'faturacao.ver')) {
        $limite = $agora - 60 * 86400;
        $n = 0;
        foreach ($todos as $p) foreach (faturas_de($p) as $f) if (saldo_em_aberto($f) > 0 && ts($f->data) < $limite) $n++;
        $add(['id' => 'dividas', 'gravidade' => 'aviso', 'titulo' => $plural($n, 'fatura por pagar há mais de 60 dias', 'faturas por pagar há mais de 60 dias'), 'texto' => 'Veja as dívidas por antiguidade.', 'link' => '/faturacao', 'total' => $n]);
    }
    if (pode($u, 'mensagens.enviar')) {
        $n = count(filtrar(Db::todos('pedidos'), fn($p) => $p->estado === 'novo'));
        $add(['id' => 'pedidos-site', 'gravidade' => 'aviso', 'titulo' => $plural($n, 'pedido do site por responder', 'pedidos do site por responder'), 'texto' => 'Ligue ao cliente e marque, se for o caso.', 'link' => '/comunicacoes', 'total' => $n]);
    }
    if (pode($u, 'agenda.gerir')) {
        $n = count(filtrar(Db::todos('marcacoes'), fn($m) => $m->estado === 'agendada' && dia_local($m->data) === $hoje));
        $add(['id' => 'marcacoes', 'gravidade' => 'info', 'titulo' => $plural($n, 'marcação de hoje por confirmar', 'marcações de hoje por confirmar'), 'texto' => 'Ligue ou envie um lembrete.', 'link' => '/agenda', 'total' => $n]);
    }
    $ordem = ['critico' => 0, 'aviso' => 1, 'info' => 2];
    usort($lista, fn($x, $y) => $ordem[$x->gravidade] <=> $ordem[$y->gravidade]);
    return $lista;
}

function rotas_relatorios(): array
{
    return [
        ['GET', '/relatorios', function ($r) {
            $u = exigir('relatorios.ver');
            $de = $r->query['de'] ?? '';
            $ate = $r->query['ate'] ?? '';
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $de) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $ate) || $de > $ate) erro(422, 'Período inválido.');
            if (dias_inclusive($de, $ate) > 3 * 366) erro(422, 'O período máximo é de 3 anos.');
            return calcular_relatorio($de, $ate, $u);
        }],
        ['GET', '/painel/alertas', fn() => alertas(utilizador_atual())],
    ];
}
