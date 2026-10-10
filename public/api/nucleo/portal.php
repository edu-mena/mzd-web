<?php
// Portal do cliente: acompanhamento e aceitação do orçamento por um link pessoal. Porte de src/api/mock/portal.ts.
// O token é a credencial; limite de pedidos por IP; link expira 30 dias depois de o processo terminar;
// a resposta é só a projeção PortalProcesso (sem custos, notas internas nem nomes da equipa).

declare(strict_types=1);

const DIAS_APOS_FIM = 30;

function por_token(string $token): object
{
    limitar('portal:' . ip(), 60, 60, 'Demasiados pedidos. Aguarde um minuto e tente novamente.');
    $p = strlen($token) >= 16 ? achar(Db::todos('processos'), fn($x) => isset($x->portal) && hash_equals($x->portal->token, $token)) : null;
    if (!$p) erro(404, 'Este link não é válido ou foi substituído por um mais recente. Peça um novo à oficina.');
    $fim = $p->entrega->data ?? ($p->cancelamento->data ?? null);
    if ($fim && time() - ts($fim) > DIAS_APOS_FIM * 86400) erro(410, 'Este link expirou. Para consultar processos antigos, contacte a oficina.');
    return $p;
}

function linhas_portal(object $o): array
{
    $r = [
        'pecas' => array_map(fn($l) => (object) ['descricao' => $l->descricao, 'quantidade' => $l->quantidade, 'precoUnitario' => $l->precoUnitario], $o->pecas),
        'maoObra' => array_map(fn($l) => (object) ['descricao' => $l->descricao, 'horas' => $l->horas, 'valorHora' => $l->valorHora], $o->maoObra),
        'taxaIva' => $o->taxaIva,
    ];
    if (!empty($o->isencaoIva)) $r['isencaoIva'] = $o->isencaoIva;
    return $r;
}

function parqueamento_do_cliente(object $p): ?object
{
    $porFaturar = parqueamento_por_faturar($p);
    $v = valor_parqueamento($porFaturar, $p->orcamento ?? null);
    $abertas = filtrar($p->faturasParqueamento ?? [], fn($f) => saldo_em_aberto($f) > 0);
    $valor = $v->total + soma($abertas, fn($f) => saldo_em_aberto($f));
    if (!$valor) return null;
    $desdes = array_merge(array_map(fn($x) => $x->de, $porFaturar), ...array_map(fn($f) => array_map(fn($x) => $x->de, $f->periodos), $abertas));
    sort($desdes);
    return (object) [
        'valorDia' => $v->valorDia ?: ($abertas[0]->valorDia ?? 0),
        'dias' => $v->dias + soma($abertas, fn($f) => soma($f->periodos, fn($x) => $x->dias)),
        'valor' => $valor, 'desde' => $desdes[0],
    ];
}

function projetar(object $p, string $token): object
{
    $c = Db::obter('clientes', $p->clienteId);
    $v = Db::obter('viaturas', $p->viaturaId);
    $cfg = configuracao();
    $e = $cfg->empresa;
    $idx = fn($x) => array_search($x, ESTADOS_ORDEM, true);
    $visivel = $idx($p->estado) !== false && $idx($p->estado) >= $idx('aguarda_aprovacao') || $p->estado === 'cancelado';
    $etapas = [];
    foreach ($p->historico as $h) if (!empty($h->estado) && $h->estado !== 'cancelado' && !isset($etapas[$h->estado])) $etapas[$h->estado] = $h->data;
    $o = $p->orcamento ?? null;
    $mostrar = $o && $o->estado !== 'rascunho' && $visivel;
    $fim = aceitar_ate($o);
    $tarefas = $p->tarefas ?? [];
    $comValores = $o && $o->estado === 'aprovado';

    $r = (object) [
        'numero' => $p->numero, 'estado' => $p->estado, 'criadoEm' => $p->criadoEm, 'prazoEntrega' => $p->prazoEntrega,
        'aguardaPecas' => !empty($p->aguardaPecas), 'cliente' => (object) ['nome' => $c->nome],
        'viatura' => (object) ['matricula' => $v->matricula, 'marca' => $v->marca, 'modelo' => $v->modelo],
        'oficina' => (object) ['nome' => $e->nome, 'telefone' => $e->telefone, 'email' => $e->email, 'morada' => $e->morada, 'coordenadas' => $cfg->coordenadasPagamento ?? [], 'instrucoesPagamento' => $cfg->instrucoesPagamento ?? null],
        'queixa' => $p->fichaRecepcao->queixaCliente,
        'etapas' => array_map(fn($k) => (object) ['estado' => $k, 'data' => $etapas[$k]], array_keys($etapas)),
        'adicionais' => array_map(fn($a) => (object) (['id' => $a->id, 'justificacao' => $a->justificacao, 'criadoEm' => $a->criadoEm, 'estado' => $a->estado] + linhas_portal($a)), $p->orcamentosAdicionais ?? []),
        'fotos' => array_map(function ($a) use ($token) {
            $x = anexo_publico($a);
            $x->url = "/api/portal/$token/ficheiros/{$a->id}";
            return $x;
        }, filtrar(Db::todos('anexos'), fn($a) => $a->processoId === $p->id && in_array($a->tipo, ['foto', 'video'], true) && empty($a->finalidade))),
    ];
    if (!empty($p->diagnostico->concluidoEm) && $mostrar) {
        $r->diagnostico = (object) [
            'problemas' => array_map(function ($i) {
                $x = (object) ['sistema' => $i->sistema, 'gravidade' => $i->estado];
                if (!empty($i->observacao)) $x->observacao = $i->observacao;
                return $x;
            }, filtrar($p->diagnostico->itens, fn($i) => $i->estado !== 'ok')),
            'parecer' => $p->diagnostico->parecerGeral, 'concluidoEm' => $p->diagnostico->concluidoEm,
        ];
    }
    if ($mostrar) {
        $aceitacao = valor_aceitacao($o);
        $r->orcamento = (object) (linhas_portal($o) + [
            'validadeDias' => $o->validadeDias, 'condicoesPagamento' => $o->condicoesPagamento, 'enviadoEm' => $o->enviadoEm ?? null,
            'validoAte' => $fim ? "{$fim}T12:00:00" : null, 'expirado' => $o->estado === 'enviado' && $fim && dia_local() > $fim, 'estado' => $o->estado,
            'descontoPct' => ($o->desconto->estado ?? null) === 'aprovado' ? $o->desconto->percentagem : null,
            'condicoes' => $o->condicoes, 'pagamentoAceitacao' => $aceitacao,
            'pagamentoLevantamento' => max(0, arred(calcular_totais($o)->total - $aceitacao)),
        ]);
    }
    if (!empty($p->autorizacao)) $r->autorizacao = (object) ['data' => $p->autorizacao->data, 'metodo' => $p->autorizacao->metodo, 'autorizadoPor' => $p->autorizacao->autorizadoPor];
    if ($tarefas && in_array($p->estado, ['em_reparacao', 'controlo_qualidade'], true)) {
        $r->progresso = (object) ['feitas' => count(filtrar($tarefas, fn($t) => !empty($t->feita))), 'total' => count($tarefas)];
    }
    if ($comValores) {
        $r->valores = (object) ['total' => total_faturavel($p), 'pago' => recebido_processo($p), 'aPagar' => em_divida($p), 'fatura' => $p->fatura->numero ?? null];
    }
    if ($p->estado === 'em_reparacao' && falta_pagamento_aceitacao($p) > 0) $r->aguardaPagamentoAceitacao = falta_pagamento_aceitacao($p);
    if ($p->estado === 'pronta_entrega') $r->levantarAte = levantar_ate($p);
    $r->parqueamento = parqueamento_do_cliente($p);
    $r->entregueEm = $p->entrega->data ?? null;
    $r->canceladoEm = $p->cancelamento->data ?? null;
    return $r;
}

function autor_cliente(string $nome): object
{
    return (object) ['id' => null, 'nome' => "$nome (cliente, no portal)"];
}

function exigir_aceitacao(mixed $b): string
{
    $nome = texto($b->nome ?? null, 'O seu nome', 3, 120);
    if (($b->decisao ?? null) === 'aprovado' && ($b->aceito ?? null) !== true) erro(422, 'Confirme que leu e aceita o orçamento.');
    return $nome;
}

function rotas_portal(): array
{
    $balcao = ['rececionista', 'administrativa', 'chefe_oficina'];
    return [
        ['GET', '/portal/:token', function ($r) {
            $p = por_token($r->params['token']);
            $p->portal->ultimoAcesso = agora();
            $p->portal->acessos = ($p->portal->acessos ?? 0) + 1;
            return projetar($p, $r->params['token']);
        }],

        ['POST', '/portal/:token/aprovacao', function ($r) use ($balcao) {
            $p = por_token($r->params['token']);
            if ($p->estado !== 'aguarda_aprovacao') erro(422, 'Este orçamento já não está à espera de aprovação. Atualize a página.');
            $decisao = um_de($r->body->decisao ?? null, ['aprovado', 'recusado'], 'Decisão');
            $nome = exigir_aceitacao($r->body);
            $ref = "{$p->numero} · " . (Db::obter('viaturas', $p->viaturaId)->matricula ?? '');
            if ($decisao === 'recusado') {
                recusar_orcamento($p, autor_cliente($nome), texto($r->body->motivo ?? null, 'Motivo', 3, 300));
                notificar(['perfis' => $balcao], 'Orçamento recusado no portal', "$ref — $nome: {$p->orcamento->motivoRecusa}", "/processos/{$p->id}");
            } else {
                // O aviso à receção (falta o pagamento da aceitação) sai com a mudança de etapa.
                aprovar_orcamento($p, autor_cliente($nome), ['metodo' => 'portal', 'autorizadoPor' => $nome, 'ip' => ip(), 'agente' => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200)]);
            }
            auditar(null, "portal_$decisao", 'processo', $p->id, "$nome · " . ip());
            return projetar($p, $r->params['token']);
        }],

        ['POST', '/portal/:token/adicionais/:aid', function ($r) use ($balcao) {
            $p = por_token($r->params['token']);
            if ($p->estado !== 'em_reparacao') erro(422, 'Este pedido já não está à espera de decisão. Atualize a página.');
            $a = achar($p->orcamentosAdicionais ?? [], fn($x) => $x->id === $r->params['aid']);
            if (!$a) erro(404, 'Pedido não encontrado.');
            if ($a->estado !== 'enviado') erro(422, 'Este pedido já foi decidido. Atualize a página.');
            $decisao = um_de($r->body->decisao ?? null, ['aprovado', 'recusado'], 'Decisão');
            $nome = exigir_aceitacao($r->body);
            decidir_adicional($p, $a, autor_cliente($nome), $decisao, 'portal', $nome);
            notificar(['perfis' => $balcao], "Trabalho adicional $decisao no portal", "{$p->numero} — {$a->justificacao}", "/processos/{$p->id}");
            return projetar($p, $r->params['token']);
        }],

        // Equipa: gerar um link novo (o anterior deixa de funcionar).
        ['POST', '/processos/:id/portal/renovar', function ($r) {
            $u = exigir('mensagens.enviar');
            $p = obter_processo($r->params['id']);
            $p->portal = novo_acesso_portal();
            auditar($u->id, 'renovar_link_portal', 'processo', $p->id);
            return $p->portal;
        }],
    ];
}
