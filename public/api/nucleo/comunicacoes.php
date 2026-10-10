<?php
// Comunicações: notificações internas, mensagens, modelos e clientes por avisar. Porte de src/api/mock/comunicacoes.ts.
// Email: enviado pelo PHP (mail() da Hostinger, com o email da oficina como remetente) → 'enviada' ou 'falhou'.
// WhatsApp (fase A): o operador envia pelo seu WhatsApp (wa.me) e o sistema regista 'registada'.

declare(strict_types=1);

const MAX_NOTIFICACOES = 500;

function notificar(array $destino, string $titulo, string $texto, ?string $link = null, ?string $autorId = null): void
{
    $semAcesso = [];
    foreach (Db::todos('utilizadores') as $x) if (!empty($x->semAcesso)) $semAcesso[$x->id] = true;
    $utilizadores = array_values(array_unique(array_filter($destino['utilizadores'] ?? [], fn($x) => $x && $x !== $autorId && !isset($semAcesso[$x]))));
    $perfis = $destino['perfis'] ?? [];
    // A Receção com gestão completa faz o trabalho da receção, da administrativa e do chefe de oficina.
    if (array_intersect($perfis, ['rececionista', 'administrativa', 'chefe_oficina']) && !in_array('rececao', $perfis, true)) $perfis[] = 'rececao';
    if (!$utilizadores && !$perfis) return;
    $n = (object) ['id' => novo_id('notificacao', 'nt'), 'data' => agora(), 'titulo' => $titulo, 'texto' => $texto];
    if ($link) $n->link = $link;
    $n->utilizadores = $utilizadores;
    $n->perfis = array_values($perfis);
    if ($autorId) $n->autorId = $autorId;
    $n->lidaPor = [];
    Db::inserir('notificacoes', $n);
    $todas = Db::todos('notificacoes');
    for ($i = 0; $i < count($todas) - MAX_NOTIFICACOES; $i++) Db::apagar('notificacoes', $todas[$i]->id);
}

function para_mim(object $n, object $u): bool
{
    $perfis = $u->perfil === 'rececao' ? ['rececao', 'rececionista', 'administrativa', 'chefe_oficina'] : [$u->perfil];
    return ($n->autorId ?? null) !== $u->id && (in_array($u->id, $n->utilizadores, true) || array_intersect($perfis, $n->perfis));
}

function resumo_processo(object $p): string
{
    return "{$p->numero} · " . (Db::obter('viaturas', $p->viaturaId)->matricula ?? '');
}

function notificar_mudanca(object $p, string $anterior, ?string $autorId = null): void
{
    $link = "/processos/{$p->id}";
    $ref = resumo_processo($p);
    $balcao = ['rececionista', 'administrativa'];
    $mec = ['utilizadores' => [$p->mecanicoId ?? null], 'perfis' => ['chefe_oficina']];
    switch ($p->estado) {
        case 'orcamentacao':
            notificar(['perfis' => $balcao], 'Diagnóstico concluído', "$ref — preparar o orçamento.", $link, $autorId);
            break;
        case 'em_reparacao':
            if ($anterior === 'controlo_qualidade') {
                notificar($mec, 'Controlo de qualidade reprovado', "$ref voltou à reparação.", $link, $autorId);
            } elseif (falta_pagamento_aceitacao($p) > 0) {
                $onde = ($p->autorizacao->metodo ?? null) === 'portal' ? ' no portal' : '';
                notificar(['perfis' => $balcao], "Orçamento aceite$onde — falta o pagamento", "$ref — receber " . kz(falta_pagamento_aceitacao($p)) . ' para a reparação começar.', $link, $autorId);
            } else {
                notificar($mec, 'Reparação aprovada pelo cliente', "$ref — pode começar a reparação.", $link, $autorId);
            }
            break;
        case 'controlo_qualidade':
            notificar(['perfis' => ['chefe_oficina']], 'Pronta para controlo de qualidade', "$ref — reparação concluída.", $link, $autorId);
            break;
        case 'pronta_entrega':
            notificar(['perfis' => $balcao], 'Viatura pronta', "$ref — avisar o cliente para levantar.", $link, $autorId);
            break;
        case 'cancelado':
            notificar(['utilizadores' => [$p->mecanicoId ?? null]], 'Processo cancelado', $ref, $link, $autorId);
            break;
    }
}

function modelos(): array
{
    $l = Db::todos('modelos');
    if (!$l) {
        foreach (dados_padrao('modelos') as $m) { $m->id = $m->chave; Db::inserir('modelos', $m); }
        $l = Db::todos('modelos');
    }
    return $l;
}

function sem_id(object $o): object
{
    $c = copia($o);
    unset($c->id);
    return $c;
}

/** Envia o email pela conta da oficina. Devolve null se correu bem, ou o erro. */
function enviar_email(string $para, string $assunto, string $texto): ?string
{
    $cfg = config();
    $de = $cfg['email']['remetente'] ?? (configuracao()->empresa->email ?? '');
    $nome = configuracao()->empresa->nome ?? 'MZD';
    if (!$de) return 'O email da oficina não está configurado.';
    $cab = [
        'From' => '=?UTF-8?B?' . base64_encode($nome) . "?= <$de>",
        'Reply-To' => $de,
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => '8bit',
    ];
    $ok = @mail($para, '=?UTF-8?B?' . base64_encode($assunto) . '?=', $texto, $cab, "-f$de");
    return $ok ? null : 'O servidor de email recusou a mensagem.';
}

function validar_mensagem(mixed $b, string $autorId): array
{
    $canal = um_de($b->canal ?? null, ['whatsapp', 'email'], 'Canal');
    $direcao = um_de($b->direcao ?? 'saida', ['saida', 'entrada'], 'Direção');
    $processo = !empty($b->processoId) ? obter_processo(str($b->processoId)) : null;
    $marcacao = !empty($b->marcacaoId) ? Db::obter('marcacoes', str($b->marcacaoId)) : null;
    if (!empty($b->marcacaoId) && !$marcacao) erro(404, 'Marcação não encontrada.');
    $clienteId = $processo->clienteId ?? ($marcacao->clienteId ?? (!empty($b->clienteId) ? str($b->clienteId) : null));
    if (!empty($b->clienteId) && $clienteId !== $b->clienteId) erro(422, 'O cliente não corresponde ao processo ou marcação indicados.');
    $cliente = $clienteId ? Db::obter('clientes', $clienteId) : null;
    if ($clienteId && !$cliente) erro(404, 'Cliente não encontrado.');
    if (!$cliente && !$marcacao) erro(422, 'Indique o cliente, o processo ou a marcação.');
    if ($direcao === 'saida' && $cliente && empty($cliente->consentimentoMensagens)) {
        erro(422, 'Este cliente não autorizou o envio de mensagens. Registe o consentimento na ficha do cliente.');
    }
    $nome = $cliente->nome ?? $marcacao->nome;
    $destino = $canal === 'email' ? ($cliente->email ?? '') : ($cliente->telefone ?? $marcacao->telefone);
    if ($canal === 'email' && !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', $destino)) erro(422, 'O cliente não tem um email válido registado.');
    if ($canal === 'whatsapp' && strlen(so_digitos($destino)) < 9) erro(422, 'O telefone do cliente não é válido para WhatsApp.');
    $modelo = !empty($b->modelo) ? um_de($b->modelo, array_map(fn($m) => $m->chave, modelos()), 'Modelo') : null;
    $m = (object) [
        'id' => novo_id('mensagem', 'msg'), 'data' => agora(), 'canal' => $canal, 'direcao' => $direcao,
        'estado' => $direcao === 'entrada' ? 'recebida' : ($canal === 'whatsapp' ? 'registada' : 'enviada'),
        'clienteId' => $clienteId, 'processoId' => $processo->id ?? null, 'marcacaoId' => $marcacao->id ?? null,
        'nome' => $nome, 'destino' => $destino,
        'assunto' => $canal === 'email' && $direcao === 'saida' ? texto($b->assunto ?? null, 'Assunto', 1, 150) : null,
        'texto' => texto($b->texto ?? null, 'Mensagem', 1, 4000),
        'modelo' => $direcao === 'saida' ? $modelo : null, 'autorId' => $autorId,
    ];
    return [$m, $processo];
}

function entrada_na_etapa(object $p): string
{
    foreach (array_reverse($p->historico) as $h) if (($h->estado ?? null) === $p->estado) return $h->data;
    return $p->criadoEm;
}

function pendentes(bool $comValores): array
{
    $saidas = filtrar(Db::todos('mensagens'), fn($m) => $m->direcao === 'saida' && $m->estado !== 'falhou');
    $avisado = fn(string $desde, callable $f) => algum($saidas, fn($m) => $f($m) && $m->data >= $desde);
    $lista = [];
    $momentos = [
        'recepcao' => ['rececao', 'Confirmar a receção da viatura'],
        'aguarda_aprovacao' => ['orcamento', 'Enviar diagnóstico e orçamento'],
        'pronta_entrega' => ['pronta', 'Avisar que a viatura está pronta'],
    ];
    foreach (filtrar(Db::todos('processos'), fn($p) => esta_ativo($p->estado)) as $p) {
        $c = Db::obter('clientes', $p->clienteId);
        $v = Db::obter('viaturas', $p->viaturaId);
        $contacto = ['clienteId' => $c->id, 'processoId' => $p->id, 'nome' => $c->nome, 'telefone' => $c->telefone, 'email' => $c->email ?? null, 'consentimento' => (bool) ($c->consentimentoMensagens ?? false), 'matricula' => $v->matricula ?? null];
        $mo = $momentos[$p->estado] ?? null;
        if ($mo && !($p->estado === 'pronta_entrega' && !empty($p->avisoLevantamento))) {
            $desde = entrada_na_etapa($p);
            if (!$avisado($desde, fn($m) => ($m->processoId ?? null) === $p->id)) {
                $lista[] = (object) (['id' => "{$mo[0]}-{$p->id}", 'motivo' => $mo[0], 'modelo' => $mo[0], 'titulo' => $mo[1], 'desde' => $desde] + $contacto);
            }
        }
        if ($p->estado === 'em_reparacao' && !empty($p->autorizacao) && falta_pagamento_aceitacao($p) > 0
            && !$avisado($p->autorizacao->data, fn($m) => ($m->processoId ?? null) === $p->id && ($m->modelo ?? null) === 'pagamento')) {
            $lista[] = (object) (['id' => "pagamento-{$p->id}", 'motivo' => 'pagamento', 'modelo' => 'pagamento', 'titulo' => 'Pedir o pagamento da aceitação', 'desde' => $p->autorizacao->data] + $contacto);
        }
        $ad = achar($p->orcamentosAdicionais ?? [], fn($a) => $a->estado === 'enviado');
        if ($ad && !$avisado($ad->criadoEm, fn($m) => ($m->processoId ?? null) === $p->id)) {
            $lista[] = (object) (['id' => "adicional-{$ad->id}", 'motivo' => 'adicional', 'modelo' => 'adicional', 'titulo' => 'Pedir aprovação do trabalho adicional', 'desde' => $ad->criadoEm] + $contacto);
        }
    }

    // Marcações por confirmar até ao fim do próximo dia útil (ao sábado, inclui segunda-feira).
    $hoje = dia_local();
    $amanha = somar_dias_iso($hoje, 1);
    $proximo = $amanha;
    if ((int) (new DateTime("$proximo 12:00"))->format('w') === 0) $proximo = somar_dias_iso($proximo, 1);
    $limite = somar_dias_iso($proximo, 1);
    $agoraIso = agora();
    $dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    foreach (Db::todos('marcacoes') as $m) {
        if ($m->estado !== 'agendada' || $m->data < $agoraIso || dia_local($m->data) >= $limite) continue;
        if ($avisado($m->criadoEm, fn($x) => ($x->marcacaoId ?? null) === $m->id)) continue;
        $dia = dia_local($m->data);
        $quando = $dia === $hoje ? 'hoje' : ($dia === $amanha ? 'amanhã' : $dias[(int) (new DateTime("$dia 12:00"))->format('w')]);
        $hora = (new DateTime('@' . (int) ts($m->data)))->setTimezone(new DateTimeZone('Africa/Luanda'))->format('H:i');
        $c = !empty($m->clienteId) ? Db::obter('clientes', $m->clienteId) : null;
        $lista[] = (object) [
            'id' => "marcacao-{$m->id}", 'motivo' => 'marcacao', 'modelo' => 'marcacao', 'titulo' => "Lembrar a marcação de $quando às $hora",
            'desde' => $m->criadoEm, 'clienteId' => $c->id ?? null, 'marcacaoId' => $m->id, 'nome' => $c->nome ?? $m->nome,
            'telefone' => $c->telefone ?? $m->telefone, 'email' => $c->email ?? null, 'consentimento' => $c ? (bool) ($c->consentimentoMensagens ?? false) : true,
            'matricula' => $m->matricula ?? null,
        ];
    }

    // Faturas por pagar há mais de 30 dias, sem lembrete na última semana.
    $semana = iso(time() - 7 * 86400);
    $por = [];
    foreach (Db::todos('processos') as $p) {
        foreach (faturas_de($p) as $f) {
            $saldo = saldo_em_aberto($f);
            if ($saldo <= 0 || time() - ts($f->data) < 30 * 86400) continue;
            $d = $por[$p->clienteId] ??= (object) ['total' => 0, 'faturas' => [], 'desde' => $f->data];
            $d->total += $saldo;
            $d->faturas[] = $f->numero;
            if ($f->data < $d->desde) $d->desde = $f->data;
        }
    }
    foreach ($por as $clienteId => $d) {
        if ($avisado($semana, fn($m) => ($m->clienteId ?? null) === $clienteId && ($m->modelo ?? null) === 'divida')) continue;
        $c = Db::obter('clientes', $clienteId);
        $n = count($d->faturas);
        $lista[] = (object) [
            'id' => "divida-{$c->id}", 'motivo' => 'divida', 'modelo' => 'divida', 'titulo' => "Lembrar pagamento em atraso ($n fatura" . ($n > 1 ? 's' : '') . ')',
            'desde' => $d->desde, 'clienteId' => $c->id, 'nome' => $c->nome, 'telefone' => $c->telefone, 'email' => $c->email ?? null,
            'consentimento' => (bool) ($c->consentimentoMensagens ?? false),
            'divida' => $comValores ? (object) ['total' => $d->total, 'faturas' => $d->faturas] : null,
        ];
    }
    usort($lista, fn($a, $b) => strcmp($a->desde, $b->desde));
    return $lista;
}

function rotas_comunicacoes(): array
{
    return [
        ['GET', '/modelos', function () {
            $u = utilizador_atual();
            if (!pode($u, 'mensagens.enviar') && !pode($u, 'definicoes.gerir')) erro(403, 'Não tem permissão para esta operação.');
            return array_map('sem_id', modelos());
        }],
        ['PUT', '/modelos/:chave', function ($r) {
            $u = exigir('definicoes.gerir');
            $m = achar(modelos(), fn($x) => $x->chave === $r->params['chave']);
            if (!$m) erro(404, 'Modelo não encontrado.');
            $nome = texto($r->body->nome ?? null, 'Nome', 3, 60);
            $assunto = texto($r->body->assunto ?? null, 'Assunto do email', 3, 150);
            $corpo = texto($r->body->texto ?? null, 'Texto', 5, 1500);
            $desc = variaveis_desconhecidas("$assunto\n$corpo");
            if ($desc) erro(422, 'Variável desconhecida: ' . implode(', ', array_map(fn($v) => '{' . $v . '}', $desc)) . '.');
            $m->nome = $nome; $m->assunto = $assunto; $m->texto = $corpo; $m->atualizadoEm = agora(); $m->atualizadoPorId = $u->id;
            auditar($u->id, 'editar', 'modelo_mensagem', $m->chave);
            return sem_id($m);
        }],
        ['POST', '/modelos/:chave/repor', function ($r) {
            $u = exigir('definicoes.gerir');
            $m = achar(modelos(), fn($x) => $x->chave === $r->params['chave']);
            $padrao = achar(dados_padrao('modelos'), fn($x) => $x->chave === $r->params['chave']);
            if (!$m || !$padrao) erro(404, 'Modelo não encontrado.');
            foreach (array_keys(get_object_vars($m)) as $k) if ($k !== 'id') unset($m->$k);
            foreach ($padrao as $k => $v) $m->$k = $v;
            auditar($u->id, 'repor', 'modelo_mensagem', $padrao->chave);
            return sem_id($m);
        }],

        ['GET', '/mensagens', function ($r) {
            exigir('mensagens.enviar');
            $q = $r->query;
            $l = filtrar(Db::todos('mensagens'), fn($m) => (empty($q['clienteId']) || ($m->clienteId ?? null) === $q['clienteId'])
                && (empty($q['processoId']) || ($m->processoId ?? null) === $q['processoId'])
                && (empty($q['marcacaoId']) || ($m->marcacaoId ?? null) === $q['marcacaoId'])
                && (empty($q['canal']) || $m->canal === $q['canal']));
            usort($l, fn($a, $b) => strcmp($b->data, $a->data));
            return array_slice($l, 0, 500);
        }],
        ['POST', '/mensagens', function ($r) {
            $u = exigir('mensagens.enviar');
            [$m, $processo] = validar_mensagem($r->body, $u->id);
            if ($m->direcao === 'saida' && $m->canal === 'email') {
                $falha = enviar_email($m->destino, $m->assunto, $m->texto);
                if ($falha) { $m->estado = 'falhou'; $m->erro = $falha; }
            }
            Db::inserir('mensagens', $m);
            // A primeira mensagem com a viatura pronta é o aviso: começa a contar o prazo para levantar.
            if ($processo && $processo->estado === 'pronta_entrega' && $m->direcao === 'saida' && $m->estado !== 'falhou' && empty($processo->avisoLevantamento)) {
                $processo->avisoLevantamento = (object) ['data' => $m->data, 'canal' => $m->canal, 'porId' => $u->id];
            }
            if ($processo) {
                $nomeModelo = $m->modelo ? (achar(modelos(), fn($x) => $x->chave === $m->modelo)->nome ?? null) : null;
                registar_historico($processo, $u->nome, $m->direcao === 'entrada'
                    ? 'Resposta do cliente por ' . CANAL_LABEL[$m->canal] . ': "' . mb_substr($m->texto, 0, 120) . (mb_strlen($m->texto) > 120 ? '…' : '') . '"'
                    : 'Mensagem ao cliente por ' . CANAL_LABEL[$m->canal] . ($nomeModelo ? " — $nomeModelo" : ''), 'nota');
            }
            auditar($u->id, $m->direcao === 'entrada' ? 'registar_resposta' : 'enviar_mensagem', 'mensagem', $m->id, "{$m->canal} · {$m->nome}");
            return $m;
        }],
        ['GET', '/comunicacoes/pendentes', function () {
            $u = exigir('mensagens.enviar');
            return pendentes(pode($u, 'valores.ver'));
        }],

        ['GET', '/notificacoes', function () {
            $u = utilizador_atual();
            $l = array_reverse(filtrar(Db::todos('notificacoes'), fn($n) => para_mim($n, $u)));
            return array_map(function ($n) use ($u) {
                $x = (object) ['id' => $n->id, 'data' => $n->data, 'titulo' => $n->titulo, 'texto' => $n->texto];
                if (!empty($n->link)) $x->link = $n->link;
                $x->lida = in_array($u->id, $n->lidaPor, true);
                return $x;
            }, array_slice($l, 0, 50));
        }],
        ['POST', '/notificacoes/lidas', function ($r) {
            $u = utilizador_atual();
            $ids = is_array($r->body->ids ?? null) ? array_map('str', $r->body->ids) : null;
            foreach (Db::todos('notificacoes') as $n) {
                if (para_mim($n, $u) && ($ids === null || in_array($n->id, $ids, true)) && !in_array($u->id, $n->lidaPor, true)) $n->lidaPor[] = $u->id;
            }
            return null;
        }],
    ];
}
