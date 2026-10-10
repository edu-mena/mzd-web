<?php
// Regras partilhadas com o frontend: permissões (src/auth/permissions.ts), cálculos (src/lib/calculos.ts),
// parqueamento (src/lib/parqueamento.ts), dias úteis (src/lib/datas.ts) e modelos de mensagem (src/lib/mensagens.ts).
// Qualquer alteração a uma regra deve ser feita nos dois lados.

declare(strict_types=1);

const ESTADOS_ORDEM = ['recepcao', 'diagnostico', 'orcamentacao', 'aguarda_aprovacao', 'em_reparacao', 'controlo_qualidade', 'pronta_entrega', 'entregue'];
const ESTADO_LABEL = [
    'recepcao' => 'Receção', 'diagnostico' => 'Em Diagnóstico', 'orcamentacao' => 'Em Orçamentação', 'aguarda_aprovacao' => 'Aguarda Aprovação',
    'em_reparacao' => 'Em Reparação', 'controlo_qualidade' => 'Controlo de Qualidade', 'pronta_entrega' => 'Pronta para Entrega',
    'entregue' => 'Entregue', 'cancelado' => 'Cancelado',
];
const PERFIL_LABEL = [
    'admin' => 'Administrador do Sistema', 'direcao' => 'Direção', 'chefe_oficina' => 'Chefe de Oficina', 'administrativa' => 'Assistente Administrativa',
    'rececionista' => 'Rececionista', 'rececao' => 'Receção (gestão completa)', 'mecanico' => 'Mecânico',
];
const METODO_APROVACAO_LABEL = [
    'presencial' => 'Na oficina, pró-forma assinada', 'whatsapp' => 'Por WhatsApp', 'email' => 'Por email', 'telefone' => 'Por telefone', 'portal' => 'No portal do cliente',
];
const CANAL_LABEL = ['whatsapp' => 'WhatsApp', 'email' => 'Email'];
const CANAL_AVISO_LABEL = ['whatsapp' => 'WhatsApp', 'email' => 'Email', 'telefone' => 'Telefone', 'presencial' => 'Presencialmente'];

function esta_ativo(string $estado): bool
{
    return $estado !== 'entregue' && $estado !== 'cancelado';
}

// ---------- Permissões ----------

const TODAS_PERMISSOES = [
    'painel.ver', 'processos.ver', 'processos.criar', 'processos.cancelar', 'processos.atribuir', 'diagnostico.editar', 'orcamento.editar',
    'aprovacao.registar', 'reparacao.executar', 'qualidade.validar', 'pagamentos.registar', 'financeiro.supervisionar', 'entrega.registar',
    'clientes.ver', 'clientes.editar', 'clientes.fundir', 'viaturas.ver', 'mensagens.enviar', 'agenda.ver', 'agenda.gerir', 'pecas.ver',
    'pecas.editar', 'valores.ver', 'faturacao.ver', 'relatorios.ver', 'equipa.ver', 'definicoes.gerir', 'utilizadores.gerir', 'site.gerir',
    'auditoria.ver', 'sistema.admin',
];

function permissoes_perfil(string $perfil): array
{
    static $mapa = null;
    $mapa ??= [
        'admin' => TODAS_PERMISSOES,
        'direcao' => array_values(array_diff(TODAS_PERMISSOES, ['sistema.admin', 'site.gerir'])),
        'chefe_oficina' => [
            'painel.ver', 'processos.ver', 'processos.criar', 'processos.cancelar', 'processos.atribuir', 'diagnostico.editar', 'orcamento.editar',
            'aprovacao.registar', 'reparacao.executar', 'qualidade.validar', 'entrega.registar', 'clientes.ver', 'clientes.editar', 'viaturas.ver',
            'mensagens.enviar', 'agenda.ver', 'agenda.gerir', 'pecas.ver', 'pecas.editar', 'valores.ver', 'relatorios.ver', 'equipa.ver',
        ],
        'administrativa' => [
            'painel.ver', 'processos.ver', 'processos.criar', 'orcamento.editar', 'aprovacao.registar', 'pagamentos.registar', 'entrega.registar',
            'clientes.ver', 'clientes.editar', 'clientes.fundir', 'viaturas.ver', 'mensagens.enviar', 'agenda.ver', 'agenda.gerir', 'pecas.ver',
            'pecas.editar', 'valores.ver', 'faturacao.ver',
        ],
        'rececionista' => [
            'painel.ver', 'processos.ver', 'processos.criar', 'processos.atribuir', 'orcamento.editar', 'aprovacao.registar', 'entrega.registar',
            'clientes.ver', 'clientes.editar', 'viaturas.ver', 'mensagens.enviar', 'agenda.ver', 'agenda.gerir', 'pecas.ver', 'valores.ver',
        ],
        'rececao' => [
            'painel.ver', 'processos.ver', 'processos.criar', 'processos.cancelar', 'processos.atribuir', 'diagnostico.editar', 'orcamento.editar',
            'aprovacao.registar', 'reparacao.executar', 'qualidade.validar', 'pagamentos.registar', 'entrega.registar', 'clientes.ver',
            'clientes.editar', 'clientes.fundir', 'viaturas.ver', 'mensagens.enviar', 'agenda.ver', 'agenda.gerir', 'pecas.ver', 'pecas.editar',
            'valores.ver', 'faturacao.ver', 'equipa.ver',
        ],
        'mecanico' => ['painel.ver', 'processos.ver', 'diagnostico.editar', 'reparacao.executar', 'viaturas.ver', 'agenda.ver', 'pecas.ver'],
    ];
    return $mapa[$perfil] ?? [];
}

function pode(?object $u, string $permissao): bool
{
    return $u !== null && in_array($permissao, permissoes_perfil($u->perfil), true);
}

const PERMISSAO_ETAPA = [
    'recepcao' => 'processos.atribuir', 'diagnostico' => 'diagnostico.editar', 'orcamentacao' => 'orcamento.editar', 'aguarda_aprovacao' => 'aprovacao.registar',
    'em_reparacao' => 'reparacao.executar', 'controlo_qualidade' => 'qualidade.validar', 'pronta_entrega' => 'entrega.registar',
];

// ---------- Cálculos (src/lib/calculos.ts) ----------

function calcular_totais(?object $o): object
{
    if (!$o) return (object) ['pecas' => 0, 'maoObra' => 0, 'desconto' => 0, 'subtotal' => 0, 'iva' => 0, 'total' => 0];
    $pecas = soma($o->pecas ?? [], fn($i) => $i->quantidade * $i->precoUnitario);
    $mao = soma($o->maoObra ?? [], fn($i) => $i->horas * $i->valorHora);
    $d = $o->desconto ?? null;
    $desconto = $d && $d->estado === 'aprovado' ? arred(($pecas + $mao) * ($d->percentagem / 100)) : 0;
    $subtotal = $pecas + $mao - $desconto;
    $iva = arred($subtotal * ($o->taxaIva / 100));
    return (object) ['pecas' => $pecas, 'maoObra' => $mao, 'desconto' => $desconto, 'subtotal' => $subtotal, 'iva' => $iva, 'total' => arred($subtotal + $iva)];
}

function total_faturavel(object $p): float|int
{
    $adicionais = soma(filtrar($p->orcamentosAdicionais ?? [], fn($a) => $a->estado === 'aprovado'), fn($a) => calcular_totais($a)->total);
    return arred(calcular_totais($p->orcamento ?? null)->total + $adicionais);
}

function valor_pago(?object $f): float|int
{
    return $f ? soma(filtrar($f->pagamentos, fn($x) => empty($x->anulado)), fn($x) => $x->valor) : 0;
}

function saldo_em_aberto(?object $f): float|int
{
    return $f ? max(arred($f->valorTotal - valor_pago($f)), 0) : 0;
}

function fatura_paga(?object $f): bool
{
    return $f !== null && saldo_em_aberto($f) == 0;
}

function recebido_processo(object $p): float|int
{
    return isset($p->fatura) ? valor_pago($p->fatura) : soma(filtrar($p->adiantamentos ?? [], fn($x) => empty($x->anulado)), fn($x) => $x->valor);
}

function em_divida(object $p): float|int
{
    return isset($p->fatura) ? saldo_em_aberto($p->fatura) : max(arred(total_faturavel($p) - recebido_processo($p)), 0);
}

function valor_aceitacao(?object $o): int|float
{
    if (!$o) return 0;
    $t = calcular_totais($o);
    $bruto = $t->pecas + $t->maoObra;
    if ($bruto == 0) return 0;
    $parte = ($t->pecas * $o->condicoes->pecasAceitacaoPct + $t->maoObra * $o->condicoes->maoObraAceitacaoPct) / 100;
    return min($t->total, jsround($parte * ($t->subtotal / $bruto) * (1 + $o->taxaIva / 100)));
}

function texto_condicoes(object $c): string
{
    $partes = fn($pecas, $mao) => implode(' e ', array_filter([$pecas > 0 ? "$pecas% das peças" : null, $mao > 0 ? "$mao% da mão de obra" : null]));
    $aceitacao = $partes($c->pecasAceitacaoPct, $c->maoObraAceitacaoPct);
    $levantamento = $partes(100 - $c->pecasAceitacaoPct, 100 - $c->maoObraAceitacaoPct);
    if ($aceitacao === '') return 'Pagamento total no levantamento da viatura.';
    return "Na aceitação do orçamento: $aceitacao." . ($levantamento !== '' ? " No levantamento da viatura: $levantamento." : '');
}

function falta_pagamento_aceitacao(object $p): float|int
{
    if (empty($p->autorizacao) || !empty($p->dispensaPagamentoAceitacao)) return 0;
    return max(0, arred(valor_aceitacao($p->orcamento ?? null) - recebido_processo($p)));
}

function faturas_de(object $p): array
{
    return [...(isset($p->fatura) ? [$p->fatura] : []), ...($p->faturasParqueamento ?? [])];
}

// ---------- Dias úteis (src/lib/datas.ts) ----------

function somar_dias_iso(string $dia, int $n): string
{
    return (new DateTime("$dia 12:00:00"))->modify(($n >= 0 ? '+' : '') . "$n days")->format('Y-m-d');
}

function dias_inclusive(string $de, string $ate): int
{
    if ($ate < $de) return 0;
    return (int) round(((new DateTime("$ate 12:00:00"))->getTimestamp() - (new DateTime("$de 12:00:00"))->getTimestamp()) / 86400) + 1;
}

function pascoa(int $ano): DateTime
{
    $a = $ano % 19; $b = intdiv($ano, 100); $c = $ano % 100; $d = intdiv($b, 4); $e = $b % 4;
    $f = intdiv($b + 8, 25); $g = intdiv($b - $f + 1, 3); $h = (19 * $a + $b - $d - $g + 15) % 30;
    $i = intdiv($c, 4); $k = $c % 4; $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7; $m = intdiv($a + 11 * $h + 22 * $l, 451);
    $mes = intdiv($h + $l - 7 * $m + 114, 31);
    return new DateTime(sprintf('%04d-%02d-%02d 12:00:00', $ano, $mes, (($h + $l - 7 * $m + 114) % 31) + 1));
}

/** Feriados nacionais de Angola (Lei n.º 11/18 e alterações) — a mesma lista do frontend. */
function eh_feriado(string $dia): bool
{
    if (in_array(substr($dia, 5), ['01-01', '02-04', '03-08', '03-23', '04-04', '05-01', '09-17', '11-02', '11-11', '12-25'], true)) return true;
    $p = pascoa((int) substr($dia, 0, 4));
    return $dia === (clone $p)->modify('-47 days')->format('Y-m-d') || $dia === (clone $p)->modify('-2 days')->format('Y-m-d');
}

function eh_dia_util(string $dia): bool
{
    $s = (int) (new DateTime("$dia 12:00:00"))->format('w');
    return $s !== 0 && $s !== 6 && !eh_feriado($dia);
}

function somar_dias_uteis(string $dia, int $n): string
{
    $d = $dia;
    for ($contados = 0; $contados < $n;) {
        $d = somar_dias_iso($d, 1);
        if (eh_dia_util($d)) $contados++;
    }
    return $d;
}

// ---------- Parqueamento (src/lib/parqueamento.ts) ----------

function aceitar_ate(?object $o): ?string
{
    return !empty($o->enviadoEm) ? somar_dias_iso(dia_local($o->enviadoEm), (int) $o->validadeDias) : null;
}

function levantar_ate(object $p): ?string
{
    return !empty($p->avisoLevantamento) && !empty($p->orcamento)
        ? somar_dias_uteis(dia_local($p->avisoLevantamento->data), (int) $p->orcamento->condicoes->diasUteisLevantamento)
        : null;
}

function periodos_parqueamento(object $p, ?string $hoje = null): array
{
    $hoje ??= dia_local();
    $r = [];
    $periodo = function (string $motivo, ?string $ultimoLivre, ?string $fim) use (&$r) {
        if (!$ultimoLivre || !$fim) return;
        $de = somar_dias_iso($ultimoLivre, 1);
        if ($fim >= $de) $r[] = (object) ['motivo' => $motivo, 'de' => $de, 'ate' => $fim, 'dias' => dias_inclusive($de, $fim)];
    };
    $decisao = $p->autorizacao->data ?? ((($p->cancelamento->estadoAnterior ?? null) === 'aguarda_aprovacao') ? $p->cancelamento->data : null);
    $periodo('orcamento', aceitar_ate($p->orcamento ?? null), $decisao ? dia_local($decisao) : ($p->estado === 'aguarda_aprovacao' ? $hoje : null));
    $periodo('levantamento', levantar_ate($p), isset($p->entrega) ? dia_local($p->entrega->data) : ($p->estado === 'pronta_entrega' ? $hoje : null));
    return $r;
}

function parqueamento_por_faturar(object $p, ?string $hoje = null): array
{
    if (!empty($p->dispensaParqueamento)) return [];
    $faturados = [];
    foreach ($p->faturasParqueamento ?? [] as $f) foreach ($f->periodos as $x) $faturados[] = $x;
    $r = [];
    foreach (periodos_parqueamento($p, $hoje) as $per) {
        $ultimo = '';
        foreach ($faturados as $f) if ($f->motivo === $per->motivo && $f->ate > $ultimo) $ultimo = $f->ate;
        $de = $ultimo >= $per->de ? somar_dias_iso($ultimo, 1) : $per->de;
        if ($de <= $per->ate) $r[] = (object) ['motivo' => $per->motivo, 'de' => $de, 'ate' => $per->ate, 'dias' => dias_inclusive($de, $per->ate)];
    }
    return $r;
}

function valor_parqueamento(array $periodos, ?object $o): object
{
    $dias = soma($periodos, fn($x) => $x->dias);
    $valorDia = $o->condicoes->parqueamentoDia ?? 0;
    $taxa = $o->taxaIva ?? 0;
    $subtotal = $dias * $valorDia;
    $iva = jsround($subtotal * $taxa) / 100;
    return (object) ['dias' => $dias, 'valorDia' => $valorDia, 'taxaIva' => $taxa, 'subtotal' => $subtotal, 'iva' => $iva, 'total' => arred($subtotal + $iva)];
}

// ---------- Modelos de mensagem ----------

const VARIAVEIS_MODELO = [
    'cliente', 'cliente_nome', 'viatura', 'matricula', 'processo', 'prazo', 'problemas', 'total', 'validade', 'aceitar_ate', 'condicoes',
    'pagamento_aceitacao', 'pagamento_falta', 'parqueamento_dia', 'levantar_ate', 'adicional_motivo', 'adicional_total', 'saldo', 'divida_total',
    'faturas', 'data_marcacao', 'hora_marcacao', 'oficina', 'telefone_oficina', 'coordenadas', 'iban', 'link',
];

function variaveis_desconhecidas(string $texto): array
{
    preg_match_all('/\{([a-z_]+)\}/', $texto, $m);
    return array_values(array_unique(array_filter($m[1], fn($c) => !in_array($c, VARIAVEIS_MODELO, true))));
}

function dados_padrao(string $nome): mixed
{
    return json_decode((string) file_get_contents(__DIR__ . "/../dados/$nome.json"), false);
}
