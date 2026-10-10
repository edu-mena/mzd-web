<?php
// Ciclo do processo (receção → entrega). Porte de src/api/mock/processos.ts: as mesmas validações e transições.

declare(strict_types=1);

const METODOS_APROVACAO = ['presencial', 'email', 'whatsapp', 'telefone', 'portal'];
const FORMAS_PAGAMENTO = ['numerario', 'transferencia', 'tpa', 'multicaixa'];

/** Processo com cliente, viatura e mecânico; sem valores para quem não os pode ver. */
function detalhar(object $p, object $u): object
{
    $d = copia($p);
    $d->cliente = copia(Db::obter('clientes', $p->clienteId));
    $d->viatura = copia(Db::obter('viaturas', $p->viaturaId));
    $mec = !empty($p->mecanicoId) ? Db::obter('utilizadores', $p->mecanicoId) : null;
    if ($mec) $d->mecanico = publico($mec);
    $d->aguardaPagamento = $p->estado === 'em_reparacao' && falta_pagamento_aceitacao($p) > 0;
    // O link do portal é uma credencial do cliente: só o vê quem lhe envia mensagens.
    if (!pode($u, 'mensagens.enviar')) unset($d->portal);
    if (!pode($u, 'valores.ver')) {
        $semPrecos = function ($o) {
            foreach ($o->pecas ?? [] as $i) $i->precoUnitario = 0;
            foreach ($o->maoObra ?? [] as $i) $i->valorHora = 0;
        };
        if (isset($d->orcamento)) $semPrecos($d->orcamento);
        foreach ($d->orcamentosAdicionais ?? [] as $a) $semPrecos($a);
        if (isset($d->autorizacao)) $d->autorizacao->valorTotal = 0;
        unset($d->adiantamentos, $d->fatura, $d->faturasParqueamento);
    }
    return $d;
}

function validar_linhas_pecas(mixed $linhas): array
{
    if (!is_array($linhas)) return [];
    $r = [];
    foreach (array_values($linhas) as $i => $l) {
        $n = $i + 1;
        $x = new stdClass();
        if (!empty($l->pecaId)) $x->pecaId = str($l->pecaId);
        $x->descricao = texto($l->descricao ?? null, "Peça $n: descrição", 2, 200);
        $x->quantidade = numero($l->quantidade ?? null, "Peça $n: quantidade", 1, 999, true);
        $x->precoUnitario = numero($l->precoUnitario ?? null, "Peça $n: preço", 0);
        $r[] = $x;
    }
    return $r;
}

function validar_linhas_mao_obra(mixed $linhas): array
{
    if (!is_array($linhas)) return [];
    $r = [];
    foreach (array_values($linhas) as $i => $l) {
        $n = $i + 1;
        $r[] = (object) [
            'descricao' => texto($l->descricao ?? null, "Mão de obra $n: descrição", 2, 200),
            'horas' => numero($l->horas ?? null, "Mão de obra $n: horas", 0.25, 500),
            'valorHora' => numero($l->valorHora ?? null, "Mão de obra $n: valor/hora", 1),
        ];
    }
    return $r;
}

function gerar_tarefas(array $pecas, array $maoObra, ?string $adicionalId = null): array
{
    $r = [];
    foreach ($maoObra as $m) {
        $t = (object) ['id' => novo_id('tarefa', 't'), 'descricao' => $m->descricao, 'origem' => 'mao_obra', 'feita' => false];
        if ($adicionalId) $t->adicionalId = $adicionalId;
        $r[] = $t;
    }
    foreach ($pecas as $p) {
        $t = (object) ['id' => novo_id('tarefa', 't'), 'descricao' => 'Montar ' . $p->descricao . ($p->quantidade > 1 ? " (×{$p->quantidade})" : ''), 'origem' => 'peca'];
        // Peças do catálogo ficam reservadas e dão baixa no stock quando a tarefa é feita.
        if (!empty($p->pecaId)) $t->pecaId = $p->pecaId;
        $t->quantidade = $p->quantidade;
        if ($adicionalId) $t->adicionalId = $adicionalId;
        $t->feita = false;
        $r[] = $t;
    }
    return $r;
}

/** Confirma que um anexo existe, pertence ao processo e tem a finalidade indicada. */
function anexo_valido(object $p, mixed $id, string $finalidade, string $mensagem): string
{
    $a = is_string($id) ? Db::obter('anexos', $id) : null;
    if (!$a || $a->processoId !== $p->id || ($a->finalidade ?? null) !== $finalidade) erro(422, $mensagem);
    return $a->id;
}

function cronometro_ativo(object $p): ?object
{
    return achar($p->registosTempo ?? [], fn($r) => empty($r->fim));
}

function exigir_mecanico_do_processo(object $p, object $u): void
{
    if ($u->perfil === 'mecanico' && ($p->mecanicoId ?? null) !== $u->id) erro(403, 'Este processo está atribuído a outro mecânico.');
}

function exigir_pagamento_aceitacao(object $p): void
{
    $falta = falta_pagamento_aceitacao($p);
    if ($p->estado === 'em_reparacao' && $falta > 0) {
        erro(422, 'A reparação só começa depois do pagamento da aceitação (faltam ' . kz($falta) . '). A Direção pode dispensá-lo.');
    }
}

function numero_fatura(): string
{
    return 'FT-' . date('Y') . '-' . novo_id('fatura', '');
}

function emitir_fatura(object $p): void
{
    $cfg = configuracao();
    $p->fatura = (object) ['numero' => numero_fatura(), 'data' => agora(), 'valorTotal' => total_faturavel($p), 'pagamentos' => array_values($p->adiantamentos ?? [])];
    $p->adiantamentos = [];
    $p->garantias = [
        (object) ['item' => 'Peças instaladas', 'tipo' => 'peca', 'prazoMeses' => $cfg->garantiaPecasMeses],
        (object) ['item' => 'Mão de obra', 'tipo' => 'mao_obra', 'prazoMeses' => $cfg->garantiaMaoObraMeses],
    ];
}

/** Autor: utilizador da equipa ou o cliente no portal (id nulo). */
function autor(object $u): object
{
    return (object) ['id' => $u->id, 'nome' => $u->nome];
}

function mudar_estado(object $p, object $autor, string $proximo, ?string $descricao = null): void
{
    $anterior = $p->estado;
    $p->estado = $proximo;
    registar_historico($p, $autor->nome, $descricao ?? 'Processo avançou para "' . ESTADO_LABEL[$proximo] . '"', 'estado', $proximo);
    auditar($autor->id, 'mudar_estado', 'processo', $p->id, $proximo);
    notificar_mudanca($p, $anterior, $autor->id);
}

function aprovar_orcamento(object $p, object $autor, array $autorizacao): void
{
    $a = (object) $autorizacao;
    $a->valorTotal = calcular_totais($p->orcamento)->total;
    $a->data = agora();
    $p->autorizacao = $a;
    $p->orcamento->estado = 'aprovado';
    $p->tarefas = gerar_tarefas($p->orcamento->pecas, $p->orcamento->maoObra);
    mudar_estado($p, $autor, 'em_reparacao', 'Aprovado pelo cliente (' . mb_strtolower(METODO_APROVACAO_LABEL[$a->metodo]) . ') — reparação iniciada');
    verificar_faltas($p, $autor->nome);
}

function recusar_orcamento(object $p, object $autor, string $motivo): void
{
    $p->orcamento->estado = 'recusado';
    $p->orcamento->motivoRecusa = $motivo;
    $p->cancelamento = (object) ['motivo' => "Orçamento recusado: $motivo", 'data' => agora(), 'autorId' => $autor->id, 'estadoAnterior' => 'aguarda_aprovacao'];
    $p->estado = 'cancelado';
    registar_historico($p, $autor->nome, "Orçamento recusado pelo cliente ($motivo). Processo cancelado.", 'cancelamento', 'cancelado');
    auditar($autor->id, 'recusa_cliente', 'processo', $p->id, $motivo);
    notificar_mudanca($p, 'aguarda_aprovacao', $autor->id);
}

function decidir_adicional(object $p, object $a, object $autor, string $decisao, string $metodo, string $autorizadoPor): void
{
    $a->estado = $decisao;
    $a->decisao = (object) ['metodo' => $metodo, 'data' => agora(), 'autorizadoPor' => $autorizadoPor];
    if ($decisao === 'aprovado') {
        $p->tarefas = [...($p->tarefas ?? []), ...gerar_tarefas($a->pecas, $a->maoObra, $a->id)];
        verificar_faltas($p, $autor->nome);
    }
    registar_historico($p, $autor->nome, "Trabalho adicional $decisao pelo cliente", $decisao === 'aprovado' ? 'nota' : 'rejeicao');
    auditar($autor->id, "adicional_$decisao", 'processo', $p->id, $metodo);
    notificar(['utilizadores' => [$p->mecanicoId ?? null]], "Trabalho adicional $decisao", "{$p->numero} — {$a->justificacao}", "/processos/{$p->id}", $autor->id);
}

function pendente_entrega(object $p): ?string
{
    if (!fatura_paga($p->fatura ?? null)) return 'A fatura tem de estar totalmente paga antes da entrega.';
    if (parqueamento_por_faturar($p)) return 'Há parqueamento por faturar. Fature-o (ou peça à Direção para o dispensar) antes da entrega.';
    if (algum($p->faturasParqueamento ?? [], fn($f) => !fatura_paga($f))) return 'A fatura de parqueamento tem de estar paga antes da entrega.';
    return null;
}

function bloqueio_avanco(object $p): ?string
{
    switch ($p->estado) {
        case 'recepcao':
            if (empty($p->fichaRecepcao->assinaturaCliente)) return 'Carregue a ficha de entrada preenchida e assinada pelo cliente antes de iniciar o diagnóstico.';
            return !empty($p->mecanicoId) ? null : 'Atribua um mecânico antes de iniciar o diagnóstico.';
        case 'diagnostico':
            return !empty($p->diagnostico->concluidoEm) ? null : 'O diagnóstico tem de estar concluído antes de passar à orçamentação.';
        case 'orcamentacao':
            if (empty($p->orcamento) || count($p->orcamento->pecas) + count($p->orcamento->maoObra) === 0) return 'O orçamento tem de ter pelo menos uma linha antes de ser enviado ao cliente.';
            $d = $p->orcamento->desconto ?? null;
            if ($d && $d->estado === 'pendente') return "O desconto de {$d->percentagem}% aguarda aprovação da Direção.";
            if ($d && $d->estado === 'recusado') return 'O desconto foi recusado pela Direção — retire-o ou ajuste-o no orçamento.';
            return null;
        case 'aguarda_aprovacao':
            return !empty($p->autorizacao) ? null : 'É necessário registar a aprovação do cliente (diagnóstico e orçamento) antes de iniciar a reparação.';
        case 'em_reparacao':
            $falta = falta_pagamento_aceitacao($p);
            if ($falta > 0) return 'A reparação aguarda o pagamento da aceitação (faltam ' . kz($falta) . ').';
            if (!empty($p->aguardaPecas)) return 'A reparação está parada à espera de peças.';
            $pendentes = count(filtrar($p->tarefas ?? [], fn($t) => empty($t->feita)));
            if ($pendentes) return "Ainda há $pendentes tarefa(s) de reparação por concluir.";
            if (cronometro_ativo($p)) return 'Há um cronómetro de trabalho a contar. Pare-o antes de concluir a reparação.';
            if (algum($p->orcamentosAdicionais ?? [], fn($a) => $a->estado === 'enviado')) return 'Há um trabalho adicional à espera da decisão do cliente.';
            return null;
        case 'controlo_qualidade':
            return !empty($p->checklistQualidade->aprovado) ? null : 'O controlo de qualidade tem de estar aprovado antes de a viatura ficar pronta.';
        case 'pronta_entrega':
            return pendente_entrega($p) ?? 'Registe a entrega (quilometragem, combustível e assinatura do cliente).';
        default:
            return 'Este processo já não pode avançar.';
    }
}

function exigir_etapa(object $p, object $u): void
{
    $perm = PERMISSAO_ETAPA[$p->estado] ?? null;
    if (!$perm || !pode($u, $perm)) erro(403, 'O seu perfil não pode concluir a etapa "' . ESTADO_LABEL[$p->estado] . '".');
}

/** `$emDivida`: o máximo que se pode pagar (saldo da fatura escolhida, ou o que falta do total aprovado). */
function validar_pagamento(mixed $dados, object $u, float|int $emDivida): object
{
    $forma = um_de($dados->forma ?? null, FORMAS_PAGAMENTO, 'Forma de pagamento');
    $valor = numero($dados->valor ?? null, 'Valor', 1);
    if ($valor > $emDivida + 0.01) erro(422, 'O valor excede o montante em dívida (' . number_format(jsround($emDivida), 0, ',', ' ') . ' Kz).');
    $referencia = opcional($dados->referencia ?? null, 60);
    if (($forma === 'transferencia' || $forma === 'multicaixa') && !$referencia) erro(422, 'Indique a referência da transferência / Multicaixa.');
    exigir_caixa_aberta();
    $pg = (object) ['id' => novo_id('pagamento', 'pg'), 'numeroRecibo' => proximo_recibo(), 'data' => agora(), 'valor' => $valor, 'forma' => $forma];
    if ($referencia) $pg->referencia = $referencia;
    $pg->registadoPorId = $u->id;
    return $pg;
}

function rotas_processos(): array
{
    return [
        ['GET', '/processos', function ($r) {
            $u = exigir('processos.ver');
            $c = $r->query['clienteId'] ?? null;
            $v = $r->query['viaturaId'] ?? null;
            Db::todos('clientes'); Db::todos('viaturas'); Db::todos('utilizadores');
            return array_map(fn($p) => detalhar($p, $u), filtrar(Db::todos('processos'), fn($p) => (!$c || $p->clienteId === $c) && (!$v || $p->viaturaId === $v)));
        }],

        ['GET', '/processos/:id', fn($r) => detalhar(obter_processo($r->params['id']), exigir('processos.ver'))],

        // Receção: só a queixa e o prazo; o estado de entrada vem na ficha em papel.
        ['POST', '/processos', function ($r) {
            $u = exigir('processos.criar');
            $b = $r->body;
            $marcacao = validar_marcacao_para_rececao($b->marcacaoId ?? null);
            $cliente = null; $dadosCliente = null;
            if (!empty($b->clienteId)) {
                $cliente = Db::obter('clientes', str($b->clienteId));
                if (!$cliente) erro(422, 'Cliente não encontrado.');
            } else {
                $dadosCliente = validar_cliente($b->novoCliente ?? null);
            }
            $queixa = texto($b->ficha->queixaCliente ?? null, 'Queixa do cliente', 5, 1000);
            $viatura = null; $dadosViatura = null;
            if (!empty($b->viaturaId)) {
                $viatura = Db::obter('viaturas', str($b->viaturaId));
                if (!$viatura) erro(422, 'Viatura não encontrada.');
                if (!$cliente || $viatura->clienteId !== $cliente->id) erro(422, 'A viatura selecionada pertence a outro cliente.');
                $emCurso = achar(Db::todos('processos'), fn($p) => $p->viaturaId === $viatura->id && esta_ativo($p->estado));
                if ($emCurso) erro(422, "Esta viatura já tem um processo em curso ({$emCurso->numero}).");
            } else {
                $dadosViatura = validar_viatura($b->novaViatura ?? null);
            }
            $prazo = ts(str($b->prazoEntrega ?? ''));
            if ($prazo === null || $prazo < time() - 86400) erro(422, 'Indique um prazo de entrega válido (hoje ou depois).');

            if ($dadosCliente) {
                $cliente = criar_cliente($dadosCliente);
                auditar($u->id, 'criar', 'cliente', $cliente->id, $cliente->nome);
            }
            if ($dadosViatura) {
                $viatura = criar_viatura($dadosViatura, $cliente->id, 0);
                auditar($u->id, 'criar', 'viatura', $viatura->id, $viatura->matricula);
            }
            $seq = novo_id('processo', '');
            $agora = agora();
            $p = (object) [
                'id' => "proc$seq", 'numero' => 'OS-' . date('Y') . "-$seq", 'clienteId' => $cliente->id, 'viaturaId' => $viatura->id,
                'estado' => 'recepcao', 'criadoEm' => $agora, 'prazoEntrega' => iso($prazo), 'atendenteId' => $u->id, 'urgente' => !empty($b->urgente),
                'fichaRecepcao' => (object) ['queixaCliente' => $queixa, 'dataHora' => $agora, 'assinaturaCliente' => false, 'atendenteId' => $u->id],
                'portal' => novo_acesso_portal(), 'historico' => [],
            ];
            registar_historico($p, $u->nome, $marcacao ? 'Processo aberto na receção (cliente com marcação)' : 'Processo aberto na receção', 'estado', 'recepcao');
            if ($marcacao) {
                $marcacao->estado = 'chegou';
                $marcacao->processoId = $p->id;
                $marcacao->clienteId ??= $cliente->id;
                $marcacao->viaturaId ??= $viatura->id;
            }
            Db::inserir('processos', $p);
            auditar($u->id, 'criar', 'processo', $p->id, $p->numero);
            return detalhar($p, $u);
        }],

        // Ficha de entrada em papel, assinada e digitalizada pela receção.
        ['PUT', '/processos/:id/ficha-entrada', function ($r) {
            $u = exigir('processos.criar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'recepcao', 'diagnostico');
            $ids = is_array($r->body->digitalizacaoIds ?? null) ? $r->body->digitalizacaoIds : [];
            if (!$ids) erro(422, 'Junte a ficha digitalizada (fotografia ou PDF de cada página).');
            if (count($ids) > 10) erro(422, 'Máximo de 10 páginas.');
            $digitalizacaoIds = array_map(fn($id) => anexo_valido($p, $id, 'ficha_entrada', 'Página da ficha não encontrada. Volte a enviá-la.'), $ids);
            $anterior = 0;
            foreach (Db::todos('processos') as $x) {
                if ($x->viaturaId !== $p->viaturaId || $x->id === $p->id) continue;
                $anterior = max($anterior, $x->fichaRecepcao->km ?? 0, $x->entrega->km ?? 0);
            }
            $km = numero($r->body->km ?? null, 'Quilometragem', 0, 2000000, true);
            if ($km < $anterior) erro(422, 'A quilometragem não pode ser inferior à última registada (' . number_format($anterior, 0, ',', ' ') . ' km).');
            $comb = $r->body->combustivel ?? null;
            $combustivel = $comb === null ? null : numero($comb, 'Combustível', 0, 100);
            $corrigir = !empty($p->fichaRecepcao->assinaturaCliente);
            $f = $p->fichaRecepcao;
            $f->km = $km;
            if ($combustivel === null) unset($f->combustivel); else $f->combustivel = $combustivel;
            $f->pertences = opcional($r->body->pertences ?? null, 500) ?? 'Nenhum';
            $f->assinaturaCliente = true;
            $f->digitalizacaoIds = $digitalizacaoIds;
            $f->digitalizadaEm = agora();
            $f->digitalizadaPorId = $u->id;
            $viatura = Db::obter('viaturas', $p->viaturaId);
            if ($viatura && $km > $viatura->km) $viatura->km = $km;
            registar_historico($p, $u->nome, ($corrigir ? 'Ficha de entrada substituída' : 'Ficha de entrada assinada e digitalizada') . ' (' . count($digitalizacaoIds) . ' página(s), ' . number_format($km, 0, ',', ' ') . ' km)', 'documento');
            auditar($u->id, 'ficha_entrada', 'processo', $p->id, "$km km");
            return detalhar($p, $u);
        }],

        ['PATCH', '/processos/:id/mecanico', function ($r) {
            $u = exigir('processos.atribuir');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'recepcao', 'diagnostico', 'orcamentacao', 'aguarda_aprovacao', 'em_reparacao');
            $mec = Db::obter('utilizadores', str($r->body->mecanicoId ?? ''));
            if (!$mec || $mec->perfil !== 'mecanico' || empty($mec->ativo)) erro(422, 'Selecione um mecânico ativo.');
            $ativo = cronometro_ativo($p);
            if ($ativo && $ativo->mecanicoId !== $mec->id) {
                $nome = Db::obter('utilizadores', $ativo->mecanicoId)->nome ?? '';
                erro(422, "$nome tem o cronómetro a contar neste processo. Peça-lhe para parar antes de reatribuir.");
            }
            $mudou = ($p->mecanicoId ?? null) !== $mec->id;
            $p->mecanicoId = $mec->id;
            registar_historico($p, $u->nome, "Mecânico atribuído: {$mec->nome}", 'nota');
            if ($mudou) notificar(['utilizadores' => [$mec->id]], 'Viatura atribuída a si', "{$p->numero} — {$p->fichaRecepcao->queixaCliente}", "/processos/{$p->id}", $u->id);
            auditar($u->id, 'atribuir_mecanico', 'processo', $p->id, $mec->nome);
            return detalhar($p, $u);
        }],

        ['POST', '/processos/:id/avancar', function ($r) {
            $u = exigir('processos.ver');
            $p = obter_processo($r->params['id']);
            if (!esta_ativo($p->estado)) erro(422, 'Este processo já está encerrado.');
            exigir_etapa($p, $u);
            $bloqueio = bloqueio_avanco($p);
            if ($bloqueio) erro(422, $bloqueio);
            $proximo = ESTADOS_ORDEM[array_search($p->estado, ESTADOS_ORDEM, true) + 1];
            if ($proximo === 'aguarda_aprovacao' && !empty($p->orcamento)) {
                $p->orcamento->estado = 'enviado';
                $p->orcamento->enviadoEm = agora();
            }
            mudar_estado($p, autor($u), $proximo);
            return detalhar($p, $u);
        }],

        ['PUT', '/processos/:id/diagnostico', function ($r) {
            $u = exigir('diagnostico.editar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'diagnostico');
            exigir_mecanico_do_processo($p, $u);
            $b = $r->body;
            $concluir = !empty($b->concluir);
            $itens = [];
            foreach ((is_array($b->itens ?? null) ? $b->itens : []) as $i) {
                $x = (object) [
                    'sistema' => texto($i->sistema ?? null, 'Sistema', 2, 60),
                    'estado' => um_de($i->estado ?? null, ['ok', 'atencao', 'critico'], 'Estado de ' . str($i->sistema ?? '')),
                ];
                $obs = opcional($i->observacao ?? null, 500);
                if ($obs) $x->observacao = $obs;
                $itens[] = $x;
            }
            $parecer = mb_substr(trim(str($b->parecerGeral ?? '')), 0, 2000);
            if ($concluir) {
                if (!$itens) erro(422, 'Avalie pelo menos um sistema da viatura.');
                $semNota = achar($itens, fn($i) => $i->estado !== 'ok' && empty($i->observacao));
                if ($semNota) erro(422, "Descreva o problema encontrado em \"{$semNota->sistema}\".");
                if (mb_strlen($parecer) < 10) erro(422, 'Escreva o parecer técnico geral (mínimo 10 caracteres).');
            }
            $p->diagnostico = (object) [
                'itens' => $itens, 'parecerGeral' => $parecer,
                'recomendacao' => um_de($b->recomendacao ?? 'reparar', ['reparar', 'substituir', 'ambos'], 'Recomendação'),
                'urgencia' => um_de($b->urgencia ?? 'medio', ['baixo', 'medio', 'alto', 'seguranca'], 'Urgência'),
                'mecanicoId' => $p->mecanicoId ?? $u->id,
            ];
            if ($concluir) {
                $p->diagnostico->concluidoEm = agora();
                mudar_estado($p, autor($u), 'orcamentacao', 'Diagnóstico concluído — processo passou para orçamentação');
            }
            return detalhar($p, $u);
        }],

        ['PUT', '/processos/:id/orcamento', function ($r) {
            $u = exigir('orcamento.editar');
            if (!pode($u, 'valores.ver')) erro(403, 'Não tem permissão para ver valores.');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'orcamentacao');
            $cfg = configuracao();
            $b = $r->body;
            $desconto = avaliar_desconto($b->desconto ?? null, $p->orcamento->desconto ?? null, $u);
            $isencao = !empty($b->semIva) ? texto(str($b->motivoIsencaoIva ?? '') !== '' ? $b->motivoIsencaoIva : $cfg->motivoIsencaoIva, 'Motivo da isenção de IVA', 3, 200) : null;
            $antes = $p->orcamento->isencaoIva ?? null;
            if ($isencao !== $antes && ($isencao || $antes)) {
                registar_historico($p, $u->nome, $isencao ? "Orçamento sem IVA ($isencao)" : "Orçamento com IVA ({$cfg->taxaIva}%)", 'nota');
            }
            $o = (object) [
                'pecas' => validar_linhas_pecas($b->pecas ?? null), 'maoObra' => validar_linhas_mao_obra($b->maoObra ?? null),
                'taxaIva' => $isencao ? 0 : $cfg->taxaIva,
            ];
            if ($isencao) $o->isencaoIva = $isencao;
            $o->validadeDias = $cfg->validadeOrcamentoDias;
            $o->condicoes = copia($cfg->condicoes);
            $o->condicoesPagamento = texto_condicoes($cfg->condicoes);
            $o->estado = 'rascunho';
            if ($desconto) $o->desconto = $desconto;
            $p->orcamento = $o;
            if ($desconto && $desconto->estado === 'pendente') {
                registar_historico($p, $u->nome, "Pedido de desconto de {$desconto->percentagem}% enviado à Direção ({$desconto->motivo})", 'nota');
                notificar(['perfis' => ['direcao']], 'Desconto para aprovar', "{$p->numero} — {$desconto->percentagem}%: {$desconto->motivo}", "/processos/{$p->id}", $u->id);
            }
            auditar($u->id, 'guardar_orcamento', 'processo', $p->id, (string) calcular_totais($o)->total);
            return detalhar($p, $u);
        }],

        // Decisão do cliente sobre diagnóstico + orçamento.
        ['POST', '/processos/:id/aprovacao', function ($r) {
            $u = exigir('aprovacao.registar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'aguarda_aprovacao');
            $b = $r->body;
            $decisao = um_de($b->decisao ?? null, ['aprovado', 'recusado'], 'Decisão');
            if ($decisao === 'recusado') {
                recusar_orcamento($p, autor($u), texto($b->motivoRecusa ?? null, 'Motivo da recusa', 3, 300));
                return detalhar($p, $u);
            }
            $metodo = um_de($b->metodo ?? null, METODOS_APROVACAO, 'Método de aprovação');
            if ($metodo === 'portal') erro(422, 'A aprovação no portal é feita pelo próprio cliente.');
            $comprovativo = $metodo === 'telefone' ? null : anexo_valido($p, $b->comprovativoAnexoId ?? null, 'comprovativo_aprovacao', $metodo === 'presencial'
                ? 'Junte a pró-forma assinada pelo cliente (fotografia ou digitalização).'
                : 'Anexe o comprovativo (captura da conversa ou do email) da aprovação.');
            $autorizadoPor = texto($b->autorizadoPor ?? null, 'Nome de quem autorizou', 3, 120);
            if (!empty($b->adiantamento) && (float) ($b->adiantamento->valor ?? 0) > 0) {
                if (!pode($u, 'pagamentos.registar')) erro(403, 'Não tem permissão para registar pagamentos.');
                $p->adiantamentos = [...($p->adiantamentos ?? []), validar_pagamento($b->adiantamento, $u, total_faturavel($p) - recebido_processo($p))];
            }
            $aut = ['metodo' => $metodo, 'autorizadoPor' => $autorizadoPor];
            if ($comprovativo) $aut['comprovativoAnexoId'] = $comprovativo;
            $aut['registadoPorId'] = $u->id;
            aprovar_orcamento($p, autor($u), $aut);
            return detalhar($p, $u);
        }],

        ['PATCH', '/processos/:id/tarefas/:tid', function ($r) {
            $u = exigir('reparacao.executar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'em_reparacao');
            exigir_mecanico_do_processo($p, $u);
            $t = achar($p->tarefas ?? [], fn($x) => $x->id === $r->params['tid']);
            if (!$t) erro(404, 'Tarefa não encontrada.');
            $feita = !empty($r->body->feita);
            if ($feita === (bool) $t->feita) return detalhar($p, $u);
            if ($feita) exigir_pagamento_aceitacao($p);
            if (!empty($t->pecaId)) {
                $peca = obter_peca($t->pecaId);
                $q = $t->quantidade ?? 1;
                if ($feita) movimentar($peca, -$q, 'saida', $u, ['processoId' => $p->id, 'motivo' => "Montada em {$p->numero}"]);
                else movimentar($peca, $q, 'devolucao', $u, ['processoId' => $p->id, 'motivo' => "Tarefa desmarcada em {$p->numero}"]);
            }
            $t->feita = $feita;
            if ($feita) { $t->feitaPorId = $u->id; $t->feitaEm = agora(); } else { unset($t->feitaPorId, $t->feitaEm); }
            return detalhar($p, $u);
        }],

        ['PATCH', '/processos/:id/pecas', function ($r) {
            $u = exigir('reparacao.executar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'em_reparacao');
            $aguarda = !empty($r->body->aguardaPecas);
            $nota = $aguarda ? texto($r->body->nota ?? null, 'Peças em falta', 3, 300) : null;
            $p->aguardaPecas = $aguarda;
            if ($nota) $p->notaPecas = $nota; else unset($p->notaPecas);
            registar_historico($p, $u->nome, $aguarda ? "Reparação parada à espera de peças: $nota" : 'Peças recebidas — reparação retomada', 'nota');
            if ($aguarda) notificar(['perfis' => ['administrativa']], 'Peças em falta', "{$p->numero} — $nota", "/processos/{$p->id}", $u->id);
            return detalhar($p, $u);
        }],

        ['POST', '/processos/:id/tempo', function ($r) {
            $u = exigir('reparacao.executar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'em_reparacao');
            exigir_mecanico_do_processo($p, $u);
            $acao = um_de($r->body->acao ?? null, ['iniciar', 'parar'], 'Ação');
            $tecnico = $u->perfil === 'mecanico' ? $u->id : ($p->mecanicoId ?? null);
            if (!$tecnico) erro(422, 'Atribua um técnico ao processo primeiro.');
            if ($acao === 'iniciar') {
                exigir_pagamento_aceitacao($p);
                $outro = achar(Db::todos('processos'), fn($x) => algum($x->registosTempo ?? [], fn($t) => empty($t->fim) && $t->mecanicoId === $tecnico));
                if ($outro) erro(422, "Já há um cronómetro ativo para este técnico em {$outro->numero}. Pare-o primeiro.");
                $reg = (object) ['id' => novo_id('tempo', 'r'), 'mecanicoId' => $tecnico, 'inicio' => agora()];
                if ($tecnico !== $u->id) $reg->registadoPorId = $u->id;
                $p->registosTempo = [...($p->registosTempo ?? []), $reg];
            } else {
                $ativo = achar($p->registosTempo ?? [], fn($t) => empty($t->fim) && $t->mecanicoId === $tecnico);
                if (!$ativo) erro(422, 'Não tem nenhum cronómetro ativo neste processo.');
                $ativo->fim = agora();
            }
            return detalhar($p, $u);
        }],

        ['POST', '/processos/:id/tempo/manual', function ($r) {
            $u = exigir('reparacao.executar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'em_reparacao', 'controlo_qualidade');
            exigir_mecanico_do_processo($p, $u);
            exigir_pagamento_aceitacao($p);
            $tec = Db::obter('utilizadores', str($r->body->mecanicoId ?? ($p->mecanicoId ?? '')));
            if (!$tec || $tec->perfil !== 'mecanico' || empty($tec->ativo)) erro(422, 'Escolha o técnico que fez o trabalho.');
            if ($u->perfil === 'mecanico' && $tec->id !== $u->id) erro(403, 'Só pode registar as suas próprias horas.');
            $horas = numero($r->body->horas ?? null, 'Horas', 0.25, 24);
            $fim = !empty($r->body->data) ? ts(str($r->body->data)) : microtime(true);
            if ($fim === null || $fim > time() + 60) erro(422, 'Data inválida.');
            if ($fim < ts($p->criadoEm)) erro(422, 'A data é anterior à entrada da viatura.');
            $nota = opcional($r->body->nota ?? null, 200);
            $reg = (object) ['id' => novo_id('tempo', 'r'), 'mecanicoId' => $tec->id, 'inicio' => iso($fim - $horas * 3600), 'fim' => iso($fim)];
            if ($u->id !== $tec->id) $reg->registadoPorId = $u->id;
            if ($nota) $reg->nota = $nota;
            $p->registosTempo = [...($p->registosTempo ?? []), $reg];
            registar_historico($p, $u->nome, num_pt($horas) . " h de trabalho registadas para {$tec->nome}" . ($nota ? " ($nota)" : ''), 'nota');
            auditar($u->id, 'registar_horas', 'processo', $p->id, "{$tec->nome} · $horas h");
            return detalhar($p, $u);
        }],

        ['POST', '/processos/:id/adicionais', function ($r) {
            $u = exigir('orcamento.editar');
            if (!pode($u, 'valores.ver')) erro(403, 'Não tem permissão para ver valores.');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'em_reparacao');
            $pecas = validar_linhas_pecas($r->body->pecas ?? null);
            $mao = validar_linhas_mao_obra($r->body->maoObra ?? null);
            if (count($pecas) + count($mao) === 0) erro(422, 'Adicione pelo menos uma linha ao trabalho adicional.');
            $a = (object) [
                'id' => novo_id('adicional', 'ad'), 'justificacao' => texto($r->body->justificacao ?? null, 'Justificação', 10, 1000),
                'pecas' => $pecas, 'maoObra' => $mao, 'taxaIva' => $p->orcamento->taxaIva ?? configuracao()->taxaIva,
            ];
            if (!empty($p->orcamento->isencaoIva)) $a->isencaoIva = $p->orcamento->isencaoIva;
            $a->criadoEm = agora();
            $a->criadoPorId = $u->id;
            $a->estado = 'enviado';
            $p->orcamentosAdicionais = [...($p->orcamentosAdicionais ?? []), $a];
            registar_historico($p, $u->nome, "Trabalho adicional proposto ao cliente: {$a->justificacao}", 'nota');
            notificar(['perfis' => ['rececionista', 'administrativa']], 'Trabalho adicional para aprovar', "{$p->numero} — pedir a decisão ao cliente.", "/processos/{$p->id}", $u->id);
            auditar($u->id, 'criar_adicional', 'processo', $p->id, (string) calcular_totais($a)->total);
            return detalhar($p, $u);
        }],

        ['POST', '/processos/:id/adicionais/:aid/decisao', function ($r) {
            $u = exigir('aprovacao.registar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'em_reparacao');
            $a = achar($p->orcamentosAdicionais ?? [], fn($x) => $x->id === $r->params['aid']);
            if (!$a) erro(404, 'Trabalho adicional não encontrado.');
            if ($a->estado !== 'enviado') erro(422, 'Este trabalho adicional já foi decidido.');
            $decisao = um_de($r->body->decisao ?? null, ['aprovado', 'recusado'], 'Decisão');
            $metodo = um_de($r->body->metodo ?? null, ['presencial', 'email', 'whatsapp', 'telefone'], 'Método');
            decidir_adicional($p, $a, autor($u), $decisao, $metodo, texto($r->body->autorizadoPor ?? null, 'Nome de quem decidiu', 3, 120));
            return detalhar($p, $u);
        }],

        ['PUT', '/processos/:id/qualidade', function ($r) {
            $u = exigir('qualidade.validar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'controlo_qualidade');
            $itens = [];
            foreach ((is_array($r->body->itens ?? null) ? $r->body->itens : []) as $i) {
                if (!is_bool($i->conforme ?? null)) erro(422, 'Indique se "' . str($i->item ?? '') . '" está conforme.');
                $x = (object) ['item' => texto($i->item ?? null, 'Item', 2, 100), 'conforme' => $i->conforme];
                $nota = opcional($i->nota ?? null, 300);
                if ($nota) $x->nota = $nota;
                $itens[] = $x;
            }
            if (!$itens) erro(422, 'A checklist não tem itens.');
            $falhas = filtrar($itens, fn($i) => !$i->conforme);
            if (algum($falhas, fn($i) => empty($i->nota))) erro(422, 'Descreva o problema em cada item não conforme.');
            $aprovado = count($falhas) === 0;
            $p->checklistQualidade = (object) ['itens' => $itens, 'responsavelId' => $u->id, 'dataHora' => agora(), 'aprovado' => $aprovado];
            $obs = opcional($r->body->observacoes ?? null, 1000);
            if ($obs) $p->checklistQualidade->observacoes = $obs;
            if ($aprovado) {
                emitir_fatura($p);
                mudar_estado($p, autor($u), 'pronta_entrega', "Controlo de qualidade aprovado — fatura {$p->fatura->numero} emitida");
            } else {
                $p->retrabalhos = ($p->retrabalhos ?? 0) + 1;
                foreach ($falhas as $f) $p->tarefas[] = (object) ['id' => novo_id('tarefa', 't'), 'descricao' => "Corrigir: {$f->item} — {$f->nota}", 'origem' => 'mao_obra', 'feita' => false];
                $p->estado = 'em_reparacao';
                registar_historico($p, $u->nome, 'Reprovado no controlo de qualidade (' . implode(', ', array_map(fn($f) => $f->item, $falhas)) . ') — voltou à reparação', 'rejeicao', 'em_reparacao');
                auditar($u->id, 'reprovar_qualidade', 'processo', $p->id);
                notificar_mudanca($p, 'controlo_qualidade', $u->id);
            }
            return detalhar($p, $u);
        }],

        // Pagamento de uma fatura (`fatura` = nº; por omissão a do serviço) ou, antes dela, adiantamento.
        ['POST', '/processos/:id/pagamentos', function ($r) {
            $u = exigir('pagamentos.registar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'em_reparacao', 'controlo_qualidade', 'pronta_entrega', 'cancelado');
            $num = str($r->body->fatura ?? '');
            $parq = $num !== '' ? achar($p->faturasParqueamento ?? [], fn($f) => $f->numero === $num) : null;
            if ($num !== '' && !$parq && $num !== ($p->fatura->numero ?? null)) erro(404, 'Fatura não encontrada neste processo.');
            if (!$parq && $p->estado === 'cancelado') erro(422, 'Este processo está cancelado: só se pagam faturas de parqueamento.');
            $alvo = $parq ?? ($p->fatura ?? null);
            $pg = validar_pagamento($r->body, $u, $alvo ? saldo_em_aberto($alvo) : total_faturavel($p) - recebido_processo($p));
            $aguardava = $p->estado === 'em_reparacao' && falta_pagamento_aceitacao($p) > 0;
            if ($alvo) $alvo->pagamentos[] = $pg;
            else $p->adiantamentos = [...($p->adiantamentos ?? []), $pg];
            if ($aguardava && falta_pagamento_aceitacao($p) == 0) {
                notificar(['utilizadores' => [$p->mecanicoId ?? null], 'perfis' => ['chefe_oficina']], 'Reparação pode começar', "{$p->numero} — pagamento da aceitação recebido.", "/processos/{$p->id}", $u->id);
            }
            registar_historico($p, $u->nome, 'Pagamento registado: ' . num_pt($pg->valor) . " Kz ({$pg->forma})" . ($parq ? " — parqueamento {$parq->numero}" : ''), 'nota');
            auditar($u->id, 'pagamento', 'processo', $p->id, (string) $pg->valor);
            return detalhar($p, $u);
        }],

        ['POST', '/processos/:id/pagamento-aceitacao/dispensar', function ($r) {
            $u = exigir('financeiro.supervisionar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'em_reparacao');
            if (falta_pagamento_aceitacao($p) == 0) erro(422, 'Não há pagamento da aceitação em falta.');
            $p->dispensaPagamentoAceitacao = (object) ['motivo' => texto($r->body->motivo ?? null, 'Motivo', 5, 200), 'data' => agora(), 'porId' => $u->id];
            registar_historico($p, $u->nome, "Reparação autorizada sem o pagamento da aceitação ({$p->dispensaPagamentoAceitacao->motivo})", 'nota');
            auditar($u->id, 'dispensar_pagamento_aceitacao', 'processo', $p->id, $p->dispensaPagamentoAceitacao->motivo);
            notificar(['utilizadores' => [$p->mecanicoId ?? null], 'perfis' => ['chefe_oficina']], 'Reparação pode começar', "{$p->numero} — autorizada pela Direção.", "/processos/{$p->id}", $u->id);
            return detalhar($p, $u);
        }],

        ['POST', '/processos/:id/aviso-levantamento', function ($r) {
            $u = exigir('mensagens.enviar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'pronta_entrega');
            if (!empty($p->avisoLevantamento)) erro(422, 'O cliente já foi avisado de que a viatura está pronta.');
            $canal = um_de($r->body->canal ?? null, ['telefone', 'presencial'], 'Como avisou');
            $p->avisoLevantamento = (object) ['data' => agora(), 'canal' => $canal, 'porId' => $u->id];
            registar_historico($p, $u->nome, 'Cliente avisado de que a viatura está pronta (' . mb_strtolower(CANAL_AVISO_LABEL[$canal]) . ')', 'nota');
            auditar($u->id, 'aviso_levantamento', 'processo', $p->id, $canal);
            return detalhar($p, $u);
        }],

        ['POST', '/processos/:id/parqueamento/faturar', function ($r) {
            $u = exigir('pagamentos.registar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'em_reparacao', 'controlo_qualidade', 'pronta_entrega', 'cancelado');
            $periodos = parqueamento_por_faturar($p);
            if (!$periodos || empty($p->orcamento)) erro(422, 'Não há parqueamento por faturar.');
            $v = valor_parqueamento($periodos, $p->orcamento);
            $f = (object) ['numero' => numero_fatura(), 'data' => agora(), 'valorTotal' => $v->total, 'pagamentos' => [], 'periodos' => $periodos, 'valorDia' => $v->valorDia, 'taxaIva' => $v->taxaIva];
            if (!empty($p->orcamento->isencaoIva)) $f->isencaoIva = $p->orcamento->isencaoIva;
            $p->faturasParqueamento = [...($p->faturasParqueamento ?? []), $f];
            registar_historico($p, $u->nome, "Fatura de parqueamento {$f->numero} emitida ({$v->dias} dia(s))", 'documento');
            auditar($u->id, 'faturar_parqueamento', 'processo', $p->id, "{$f->numero} · {$v->total}");
            return detalhar($p, $u);
        }],

        ['POST', '/processos/:id/parqueamento/dispensar', function ($r) {
            $u = exigir('financeiro.supervisionar');
            $p = obter_processo($r->params['id']);
            if ($p->estado === 'entregue') erro(422, 'A viatura já foi entregue.');
            if (!empty($p->dispensaParqueamento)) erro(422, 'O parqueamento deste processo já foi dispensado.');
            $dias = soma(parqueamento_por_faturar($p), fn($x) => $x->dias);
            if (!$dias) erro(422, 'Não há parqueamento por faturar.');
            $p->dispensaParqueamento = (object) ['motivo' => texto($r->body->motivo ?? null, 'Motivo', 5, 200), 'data' => agora(), 'porId' => $u->id];
            registar_historico($p, $u->nome, "Parqueamento dispensado pela Direção ($dias dia(s); {$p->dispensaParqueamento->motivo})", 'nota');
            auditar($u->id, 'dispensar_parqueamento', 'processo', $p->id, "$dias dias · {$p->dispensaParqueamento->motivo}");
            return detalhar($p, $u);
        }],

        ['POST', '/processos/:id/entrega', function ($r) {
            $u = exigir('entrega.registar');
            $p = obter_processo($r->params['id']);
            exigir_estado($p, 'pronta_entrega');
            $pendente = pendente_entrega($p);
            if ($pendente) erro(422, $pendente);
            $kmEntrada = $p->fichaRecepcao->km ?? 0;
            $km = numero($r->body->km ?? null, 'Quilometragem na entrega', $kmEntrada, $kmEntrada + 2000, true);
            $ass = anexo_valido($p, $r->body->assinaturaAnexoId ?? null, 'assinatura_entrega', 'Recolha a assinatura do cliente na entrega.');
            $p->entrega = (object) ['data' => agora(), 'km' => $km, 'combustivel' => numero($r->body->combustivel ?? null, 'Combustível', 0, 100)];
            $obs = opcional($r->body->observacoes ?? null, 1000);
            if ($obs) $p->entrega->observacoes = $obs;
            $p->entrega->assinaturaAnexoId = $ass;
            $p->entrega->entreguePorId = $u->id;
            $v = Db::obter('viaturas', $p->viaturaId);
            if ($v && $km > $v->km) $v->km = $km;
            mudar_estado($p, autor($u), 'entregue', 'Viatura entregue ao cliente');
            return detalhar($p, $u);
        }],

        ['GET', '/processos/:id/anexos', function ($r) {
            exigir('processos.ver');
            obter_processo($r->params['id']);
            return array_map('anexo_publico', filtrar(Db::todos('anexos'), fn($a) => $a->processoId === $r->params['id']));
        }],

        ['POST', '/processos/:id/cancelar', function ($r) {
            $u = exigir('processos.cancelar');
            $p = obter_processo($r->params['id']);
            $motivo = trim(str($r->body->motivo ?? ''));
            if (!esta_ativo($p->estado)) erro(422, 'Este processo já está encerrado.');
            if (mb_strlen($motivo) < 5) erro(422, 'Indique o motivo do cancelamento (mínimo 5 caracteres).');
            if (recebido_processo($p) > 0) erro(422, 'Este processo tem pagamentos registados. Trate primeiro da devolução com a administração.');
            $anterior = $p->estado;
            $p->cancelamento = (object) ['motivo' => $motivo, 'data' => agora(), 'autorId' => $u->id, 'estadoAnterior' => $anterior];
            $p->estado = 'cancelado';
            registar_historico($p, $u->nome, "Processo cancelado: $motivo", 'cancelamento', 'cancelado');
            auditar($u->id, 'cancelar', 'processo', $p->id, $motivo);
            notificar_mudanca($p, $anterior, $u->id);
            return detalhar($p, $u);
        }],
    ];
}
