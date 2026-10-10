<?php
// Clientes, viaturas e agenda. Porte de src/api/mock/clientes.ts e agenda.ts.

declare(strict_types=1);

function so_digitos(string $s): string
{
    return preg_replace('/\D/', '', $s);
}

/** Compara telefones pelos últimos 9 dígitos (com ou sem o indicativo +244). */
function mesmo_telefone(string $a, string $b): bool
{
    return substr(so_digitos($a), -9) === substr(so_digitos($b), -9);
}

/** Maiúsculas, sem espaços; LD8877CD → LD-88-77-CD. */
function normalizar_matricula(string $m): string
{
    $limpa = preg_replace('/[^A-Z0-9-]/', '', preg_replace('/\s+/', '', mb_strtoupper($m)));
    return preg_match('/^([A-Z]{2,3})(\d{2})(\d{2})([A-Z]{2})$/', $limpa, $x) ? "$x[1]-$x[2]-$x[3]-$x[4]" : $limpa;
}

function chave_matricula(string $m): string
{
    return preg_replace('/[^A-Z0-9]/', '', mb_strtoupper($m));
}

function normalizar_nome(string $n): string
{
    $s = class_exists('Normalizer') ? Normalizer::normalize($n, Normalizer::FORM_D) : $n;
    return trim(preg_replace('/\s+/', ' ', mb_strtolower(preg_replace('/\p{Mn}/u', '', $s))));
}

const EMAIL_SIMPLES = '/^\S+@\S+\.\S+$/';

function validar_cliente(mixed $n, ?string $ignorarId = null): object
{
    $telefone = texto($n->telefone ?? null, 'Telefone', 9, 20);
    if (strlen(so_digitos($telefone)) < 9) erro(422, 'Telefone: indique pelo menos 9 dígitos.');
    $outro = achar(Db::todos('clientes'), fn($c) => $c->id !== $ignorarId && mesmo_telefone($c->telefone, $telefone));
    if ($outro) erro(422, "Já existe um cliente com este telefone ({$outro->nome}).");
    $email = !empty($n->email) ? texto($n->email, 'Email', 5, 120) : null;
    if ($email && !preg_match(EMAIL_SIMPLES, $email)) erro(422, 'Email inválido.');
    $nif = !empty($n->nif) ? mb_strtoupper(texto($n->nif, 'NIF', 5, 20)) : null;
    if ($nif) {
        $comNif = achar(Db::todos('clientes'), fn($c) => $c->id !== $ignorarId && mb_strtoupper($c->nif ?? '') === $nif);
        if ($comNif) erro(422, "Já existe um cliente com este NIF ({$comNif->nome}).");
    }
    return (object) [
        'nome' => texto($n->nome ?? null, 'Nome', 3, 120), 'telefone' => $telefone, 'email' => $email, 'nif' => $nif,
        'morada' => !empty($n->morada) ? texto($n->morada, 'Morada', 2, 200) : null,
        'consentimentoMensagens' => !empty($n->consentimentoMensagens),
    ];
}

function validar_viatura(mixed $v, ?string $ignorarId = null): object
{
    $matricula = normalizar_matricula(texto($v->matricula ?? null, 'Matrícula', 4, 40));
    if (strlen(str_replace('-', '', $matricula)) < 5 || strlen($matricula) > 15) erro(422, 'Matrícula inválida.');
    if (achar(Db::todos('viaturas'), fn($x) => $x->id !== $ignorarId && chave_matricula($x->matricula) === chave_matricula($matricula))) {
        erro(422, 'Já existe uma viatura com esta matrícula.');
    }
    return (object) [
        'matricula' => $matricula,
        'marca' => texto($v->marca ?? null, 'Marca', 2, 40),
        'modelo' => texto($v->modelo ?? null, 'Modelo', 1, 60),
        'ano' => numero($v->ano ?? null, 'Ano', 1950, (int) date('Y') + 1, true),
        'cor' => texto($v->cor ?? null, 'Cor', 2, 30),
        'chassi' => !empty($v->chassi) ? mb_strtoupper(texto($v->chassi, 'Chassi', 5, 30)) : '',
    ];
}

function criar_cliente(object $dados): object
{
    $c = (object) ['id' => novo_id('cliente', 'c'), 'desde' => gmdate('Y-m-d')];
    foreach ($dados as $k => $v) $c->$k = $v;
    return Db::inserir('clientes', $c);
}

function criar_viatura(object $dados, string $clienteId, int $km): object
{
    $v = (object) ['id' => novo_id('viatura', 'v'), 'clienteId' => $clienteId, 'km' => $km];
    foreach ($dados as $k => $x) $v->$k = $x;
    return Db::inserir('viaturas', $v);
}

function resumo_cliente(object $c): object
{
    $r = copia($c);
    $r->nViaturas = count(filtrar(Db::todos('viaturas'), fn($v) => $v->clienteId === $c->id));
    $r->nProcessos = count(filtrar(Db::todos('processos'), fn($p) => $p->clienteId === $c->id));
    return $r;
}

function resumo_viatura(object $v): object
{
    $c = Db::obter('clientes', $v->clienteId);
    $r = copia($v);
    $r->cliente = (object) ['id' => $c->id, 'nome' => $c->nome, 'telefone' => $c->telefone];
    $r->nServicos = count(filtrar(Db::todos('processos'), fn($p) => $p->viaturaId === $v->id));
    return $r;
}

function obter_cliente(string $id): object
{
    return Db::obter('clientes', $id) ?? erro(404, 'Cliente não encontrado.');
}

function obter_viatura(string $id): object
{
    return Db::obter('viaturas', $id) ?? erro(404, 'Viatura não encontrada.');
}

function atribuir(object $alvo, object $dados): void
{
    foreach ($dados as $k => $v) {
        if ($v === null) unset($alvo->$k); else $alvo->$k = $v;
    }
}

// ---------- Agenda ----------

const TIPOS_MARCACAO = ['revisao', 'diagnostico', 'reparacao', 'outro'];
const MARCACAO_ABERTA = ['agendada', 'confirmada'];
const TRANSICOES_MARCACAO = [
    'agendada' => ['confirmada', 'cancelada', 'faltou'],
    'confirmada' => ['agendada', 'cancelada', 'faltou'],
    'faltou' => ['agendada'],
    'cancelada' => ['agendada'],
];

function ocupacao_dia(string $dia, ?string $ignorarId = null): int
{
    return count(filtrar(Db::todos('marcacoes'), fn($m) => $m->id !== $ignorarId && dia_local($m->data) === $dia && $m->estado !== 'cancelada' && $m->estado !== 'faltou'));
}

function obter_marcacao(string $id): object
{
    return Db::obter('marcacoes', $id) ?? erro(404, 'Marcação não encontrada.');
}

function validar_marcacao(mixed $b, ?string $ignorarId = null): object
{
    $t = ts(str($b->data ?? ''));
    if ($t === null) erro(422, 'Indique a data e a hora.');
    if (!$ignorarId && $t < time() - 3600) erro(422, 'Não é possível marcar no passado.');
    $local = (new DateTime('@' . (int) $t))->setTimezone(new DateTimeZone('Africa/Luanda'));
    $semana = (int) $local->format('w');
    if ($semana === 0) erro(422, 'A oficina está fechada ao domingo.');
    $minutos = (int) $local->format('G') * 60 + (int) $local->format('i');
    $fecho = $semana === 6 ? 13 * 60 : 18 * 60;
    if ($minutos < 7 * 60 + 30 || $minutos > $fecho) {
        erro(422, $semana === 6 ? 'Ao sábado as entradas são entre as 07:30 e as 13:00.' : 'As entradas são entre as 07:30 e as 18:00.');
    }
    $r = new stdClass();
    $r->data = iso($t);
    $r->tipo = um_de($b->tipo ?? null, TIPOS_MARCACAO, 'Tipo de serviço');
    if (!empty($b->viaturaId)) {
        $v = Db::obter('viaturas', str($b->viaturaId));
        if (!$v) erro(422, 'Viatura não encontrada.');
        $c = Db::obter('clientes', $v->clienteId);
        $r->clienteId = $c->id;
        $r->viaturaId = $v->id;
        $r->nome = $c->nome;
        $r->telefone = $c->telefone;
        $r->matricula = $v->matricula;
        $outra = achar(Db::todos('marcacoes'), fn($m) => $m->id !== $ignorarId && ($m->viaturaId ?? null) === $v->id && in_array($m->estado, MARCACAO_ABERTA, true));
        if ($outra) erro(422, 'Esta viatura já tem uma marcação em aberto (' . (new DateTime('@' . (int) ts($outra->data)))->setTimezone(new DateTimeZone('Africa/Luanda'))->format('d/m/Y H:i') . ').');
    } else {
        $r->clienteId = null;
        $r->viaturaId = null;
        $r->nome = texto($b->nome ?? null, 'Nome', 3, 120);
        $r->telefone = texto($b->telefone ?? null, 'Telefone', 9, 20);
        if (strlen(so_digitos($r->telefone)) < 9) erro(422, 'Telefone: indique pelo menos 9 dígitos.');
        $r->matricula = !empty($b->matricula) ? (normalizar_matricula(str($b->matricula)) ?: null) : null;
    }
    $ocupadas = ocupacao_dia(dia_local($t), $ignorarId);
    $capacidade = configuracao()->capacidadeDiaria;
    if ($ocupadas >= $capacidade && empty($b->forcar)) erro(409, "O dia já tem $ocupadas marcações para uma capacidade de $capacidade.");
    $r->notas = opcional($b->notas ?? null, 500);
    return $r;
}

/** Usado pela receção: a marcação passa a "chegou" e fica ligada ao processo aberto. */
function validar_marcacao_para_rececao(mixed $id): ?object
{
    if (!$id) return null;
    $m = obter_marcacao(str($id));
    if (!in_array($m->estado, MARCACAO_ABERTA, true)) erro(422, 'Esta marcação já não está em aberto.');
    return $m;
}

function rotas_cadastros(): array
{
    return [
        ['GET', '/clientes', function () {
            exigir('clientes.ver');
            return array_map('resumo_cliente', Db::todos('clientes'));
        }],
        ['GET', '/clientes/duplicados', function () {
            exigir('clientes.fundir');
            $lista = Db::todos('clientes');
            $pares = [];
            for ($i = 0; $i < count($lista); $i++) {
                for ($j = $i + 1; $j < count($lista); $j++) {
                    [$a, $b] = [$lista[$i], $lista[$j]];
                    $motivo = mesmo_telefone($a->telefone, $b->telefone) ? 'Mesmo telefone'
                        : (!empty($a->nif) && !empty($b->nif) && mb_strtoupper($a->nif) === mb_strtoupper($b->nif) ? 'Mesmo NIF'
                        : (normalizar_nome($a->nome) === normalizar_nome($b->nome) ? 'Mesmo nome' : null));
                    if ($motivo) $pares[] = (object) ['motivo' => $motivo, 'clientes' => [resumo_cliente($a), resumo_cliente($b)]];
                }
            }
            return $pares;
        }],
        ['GET', '/clientes/:id', function ($r) {
            exigir('clientes.ver');
            return obter_cliente($r->params['id']);
        }],
        ['POST', '/clientes', function ($r) {
            $u = exigir('clientes.editar');
            $c = criar_cliente(validar_cliente($r->body));
            auditar($u->id, 'criar', 'cliente', $c->id, $c->nome);
            return $c;
        }],
        ['PUT', '/clientes/:id', function ($r) {
            $u = exigir('clientes.editar');
            $c = obter_cliente($r->params['id']);
            $dados = validar_cliente($r->body, $c->id);
            $mudou = $dados->consentimentoMensagens !== (bool) ($c->consentimentoMensagens ?? false);
            atribuir($c, $dados);
            auditar($u->id, 'editar', 'cliente', $c->id, $mudou ? 'consentimento: ' . ($dados->consentimentoMensagens ? 'sim' : 'não') : null);
            return $c;
        }],
        ['POST', '/clientes/:id/fundir', function ($r) {
            $u = exigir('clientes.fundir');
            $destino = obter_cliente($r->params['id']);
            $origem = obter_cliente(str($r->body->origemId ?? ''));
            if ($origem->id === $destino->id) erro(422, 'Escolha dois clientes diferentes.');
            $nv = 0; $np = 0;
            foreach (Db::todos('viaturas') as $v) if ($v->clienteId === $origem->id) { $v->clienteId = $destino->id; $nv++; }
            foreach (Db::todos('processos') as $p) if ($p->clienteId === $origem->id) { $p->clienteId = $destino->id; $np++; }
            foreach (Db::todos('marcacoes') as $m) if (($m->clienteId ?? null) === $origem->id) $m->clienteId = $destino->id;
            foreach (Db::todos('mensagens') as $m) if (($m->clienteId ?? null) === $origem->id) $m->clienteId = $destino->id;
            foreach (['email', 'nif', 'morada'] as $k) if (empty($destino->$k) && !empty($origem->$k)) $destino->$k = $origem->$k;
            if ($origem->desde < $destino->desde) $destino->desde = $origem->desde;
            Db::apagar('clientes', $origem->id);
            auditar($u->id, 'fundir', 'cliente', $destino->id, "{$origem->nome} ({$origem->id}) → {$destino->nome}: $nv viatura(s), $np processo(s)");
            return $destino;
        }],

        ['GET', '/viaturas', function ($r) {
            exigir('viaturas.ver');
            $c = $r->query['clienteId'] ?? null;
            Db::todos('clientes');
            return array_map('resumo_viatura', filtrar(Db::todos('viaturas'), fn($v) => !$c || $v->clienteId === $c));
        }],
        ['GET', '/viaturas/:id', function ($r) {
            exigir('viaturas.ver');
            return resumo_viatura(obter_viatura($r->params['id']));
        }],
        ['POST', '/viaturas', function ($r) {
            $u = exigir('clientes.editar');
            $dono = obter_cliente(str($r->body->clienteId ?? ''));
            $dados = validar_viatura($r->body);
            $km = numero($r->body->km ?? 0, 'Quilometragem', 0, 2000000, true);
            $v = criar_viatura($dados, $dono->id, $km);
            auditar($u->id, 'criar', 'viatura', $v->id, $v->matricula);
            return resumo_viatura($v);
        }],
        ['PUT', '/viaturas/:id', function ($r) {
            $u = exigir('clientes.editar');
            $v = obter_viatura($r->params['id']);
            atribuir($v, validar_viatura($r->body, $v->id));
            auditar($u->id, 'editar', 'viatura', $v->id, $v->matricula);
            return resumo_viatura($v);
        }],
        ['PATCH', '/viaturas/:id/proprietario', function ($r) {
            $u = exigir('clientes.editar');
            $v = obter_viatura($r->params['id']);
            $novo = obter_cliente(str($r->body->clienteId ?? ''));
            if ($novo->id === $v->clienteId) erro(422, 'A viatura já pertence a este cliente.');
            $emCurso = achar(Db::todos('processos'), fn($p) => $p->viaturaId === $v->id && esta_ativo($p->estado));
            if ($emCurso) erro(422, "Não é possível transferir com um processo em curso ({$emCurso->numero}).");
            $anterior = $v->clienteId;
            $v->clienteId = $novo->id;
            auditar($u->id, 'transferir', 'viatura', $v->id, "$anterior → {$novo->id}");
            return resumo_viatura($v);
        }],

        ['GET', '/marcacoes', function ($r) {
            exigir('agenda.ver');
            $de = $r->query['de'] ?? null;
            $ate = $r->query['ate'] ?? null;
            $l = filtrar(Db::todos('marcacoes'), fn($m) => (!$de || dia_local($m->data) >= $de) && (!$ate || dia_local($m->data) <= $ate));
            usort($l, fn($a, $b) => strcmp($a->data, $b->data));
            return $l;
        }],
        ['GET', '/marcacoes/:id', function ($r) {
            exigir('agenda.ver');
            return obter_marcacao($r->params['id']);
        }],
        ['POST', '/marcacoes', function ($r) {
            $u = exigir('agenda.gerir');
            $m = (object) ['id' => novo_id('marcacao', 'm')];
            atribuir($m, validar_marcacao($r->body));
            $m->estado = 'agendada';
            $m->criadoPorId = $u->id;
            $m->criadoEm = agora();
            Db::inserir('marcacoes', $m);
            auditar($u->id, 'criar', 'marcacao', $m->id, "{$m->nome} · {$m->data}" . (!empty($r->body->forcar) ? ' (acima da capacidade)' : ''));
            return $m;
        }],
        ['PUT', '/marcacoes/:id', function ($r) {
            $u = exigir('agenda.gerir');
            $m = obter_marcacao($r->params['id']);
            if (!in_array($m->estado, MARCACAO_ABERTA, true)) erro(422, 'Só é possível alterar marcações agendadas ou confirmadas.');
            atribuir($m, validar_marcacao($r->body, $m->id));
            auditar($u->id, 'editar', 'marcacao', $m->id);
            return $m;
        }],
        ['PATCH', '/marcacoes/:id/estado', function ($r) {
            $u = exigir('agenda.gerir');
            $m = obter_marcacao($r->params['id']);
            $novo = um_de($r->body->estado ?? null, ['agendada', 'confirmada', 'faltou', 'cancelada'], 'Estado');
            if (!in_array($novo, TRANSICOES_MARCACAO[$m->estado] ?? [], true)) erro(422, "Não é possível passar de \"{$m->estado}\" para \"$novo\".");
            if ($novo === 'faltou' && ts($m->data) > time()) erro(422, 'Só pode marcar falta depois da hora marcada.');
            if ($novo === 'agendada' && in_array($m->estado, ['cancelada', 'faltou'], true) && ts($m->data) < time()) erro(422, 'A data já passou. Crie uma nova marcação.');
            $m->estado = $novo;
            auditar($u->id, 'estado_marcacao', 'marcacao', $m->id, $novo);
            return $m;
        }],
    ];
}
