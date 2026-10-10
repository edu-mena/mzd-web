<?php
// Núcleo da API: configuração, base de dados, sessão, erros e validações.
// A API PHP cumpre o mesmo contrato que o servidor simulado do frontend (src/api/mock), que é a referência das regras.
//
// Dados: MySQL com uma tabela de documentos JSON por coleção (como os objetos do frontend) + auditoria em tabela própria.
// Cada pedido carrega o que precisa, altera os objetos em memória e, no fim, grava só o que mudou (numa transação,
// com um bloqueio global para as escritas: a oficina é pequena e assim não há corridas entre pedidos).

declare(strict_types=1);

const VERSAO_API = '1.0.0';
date_default_timezone_set('Africa/Luanda');

final class ApiErro extends Exception
{
    public function __construct(public int $status, string $mensagem)
    {
        parent::__construct($mensagem);
    }
}

function erro(int $status, string $mensagem): never
{
    throw new ApiErro($status, $mensagem);
}

// ---------- Configuração (fora de public_html) ----------

/** Pasta privada da instalação: config.php, ficheiros, imagens do site, cópias e sessões. */
function pasta_dados(): string
{
    $env = getenv('MZD_DADOS');
    if ($env) return rtrim($env, '/\\');
    $raiz = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
    if ($raiz === '') $raiz = dirname(__DIR__, 2); // CLI: a pasta acima de /api
    return dirname($raiz) . '/mzd-dados';
}

function config(): ?array
{
    static $cfg = false;
    if ($cfg === false) {
        $f = pasta_dados() . '/config.php';
        $cfg = is_file($f) ? require $f : null;
    }
    return $cfg;
}

// ---------- Datas ----------

/** Agora em ISO 8601 UTC com milissegundos (como o toISOString do navegador). */
function agora(): string
{
    return iso(microtime(true));
}

function iso(float|int $ts): string
{
    $d = DateTime::createFromFormat('U.u', sprintf('%.6F', $ts), new DateTimeZone('UTC'));
    return $d->format('Y-m-d\TH:i:s.v\Z');
}

/** Timestamp (segundos) de uma data ISO; null se inválida. */
function ts(?string $iso): ?float
{
    if ($iso === null || $iso === '') return null;
    try {
        $d = new DateTime($iso);
    } catch (Exception) {
        return null;
    }
    return (float) $d->format('U.u');
}

/** "AAAA-MM-DD" no fuso da oficina (Luanda). */
function dia_local(string|float|int|null $v = null): string
{
    $t = $v === null ? microtime(true) : (is_string($v) ? ts($v) : $v);
    return (new DateTime('@' . (int) floor((float) $t)))->setTimezone(new DateTimeZone('Africa/Luanda'))->format('Y-m-d');
}

// ---------- Base de dados ----------

final class Db
{
    public static PDO $pdo;
    public static string $p = 'mzd_';
    private static array $cache = [];
    private static array $completas = [];
    private static array $originais = [];
    private static array $apagados = [];
    private static array $ordem = [];

    public static function ligar(array $cfg): void
    {
        $db = $cfg['db'];
        if (($db['driver'] ?? 'mysql') === 'sqlite') {
            self::$pdo = new PDO('sqlite:' . $db['ficheiro']);
        } else {
            self::$pdo = new PDO(
                "mysql:host={$db['host']};port=" . ($db['porta'] ?? 3306) . ";dbname={$db['nome']};charset=utf8mb4",
                $db['utilizador'],
                $db['senha'],
            );
            self::$pdo->exec("SET time_zone = '+00:00'");
        }
        self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        self::$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        self::$p = $db['prefixo'] ?? 'mzd_';
    }

    public static function mysql(): bool
    {
        return self::$pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    }

    /** Escritas em série: um pedido de cada vez altera dados (evita corridas em numeração, stock e caixa). */
    public static function bloquear(): void
    {
        // O que foi lido antes do bloqueio pode estar desatualizado: volta-se a ler.
        self::esquecer();
        if (self::mysql()) {
            $ok = self::$pdo->query("SELECT GET_LOCK('" . self::$p . "escrita', 20)")->fetchColumn();
            if ((int) $ok !== 1) erro(503, 'O servidor está ocupado. Tente novamente dentro de momentos.');
        }
        self::$pdo->beginTransaction();
    }

    public static function desbloquear(): void
    {
        if (self::$pdo->inTransaction()) self::$pdo->rollBack();
        if (self::mysql()) self::$pdo->query("SELECT RELEASE_LOCK('" . self::$p . "escrita')");
    }

    private static function registar(string $c, string $id, string $json, int $ordem): object
    {
        if (!isset(self::$cache[$c][$id])) {
            self::$cache[$c][$id] = json_decode($json, false, 512, JSON_THROW_ON_ERROR);
            self::$originais[$c][$id] = $json;
            self::$ordem[$c][$id] = $ordem;
        }
        return self::$cache[$c][$id];
    }

    /** Todos os documentos de uma coleção (pela ordem de criação). */
    public static function todos(string $c): array
    {
        if (empty(self::$completas[$c])) {
            $st = self::$pdo->prepare('SELECT id, dados, ordem FROM ' . self::$p . 'documentos WHERE colecao = ? ORDER BY ordem');
            $st->execute([$c]);
            foreach ($st as $r) self::registar($c, $r['id'], $r['dados'], (int) $r['ordem']);
            self::$completas[$c] = true;
        }
        $lista = self::$cache[$c] ?? [];
        uksort($lista, fn($a, $b) => (self::$ordem[$c][$a] ?? 0) <=> (self::$ordem[$c][$b] ?? 0));
        return array_values(array_filter($lista, fn($id) => !isset(self::$apagados[$c][$id]), ARRAY_FILTER_USE_KEY));
    }

    public static function obter(string $c, string $id): ?object
    {
        if (isset(self::$apagados[$c][$id])) return null;
        if (!isset(self::$cache[$c][$id]) && empty(self::$completas[$c])) {
            $st = self::$pdo->prepare('SELECT dados, ordem FROM ' . self::$p . 'documentos WHERE colecao = ? AND id = ?');
            $st->execute([$c, $id]);
            $r = $st->fetch();
            if ($r) self::registar($c, $id, $r['dados'], (int) $r['ordem']);
        }
        return self::$cache[$c][$id] ?? null;
    }

    public static function inserir(string $c, object $o): object
    {
        self::$cache[$c][$o->id] = $o;
        self::$ordem[$c][$o->id] = (int) (microtime(true) * 1000000) + count(self::$cache[$c]);
        unset(self::$apagados[$c][$o->id]);
        return $o;
    }

    public static function apagar(string $c, string $id): void
    {
        self::$apagados[$c][$id] = true;
    }

    /** Documento único (configuração, site, sequências). */
    public static function unico(string $id, mixed $padrao = null): object
    {
        $o = self::obter('sistema', $id);
        if (!$o) {
            $o = is_object($padrao) ? $padrao : (object) [];
            $o->id = $id;
            self::inserir('sistema', $o);
        }
        return $o;
    }

    /** Grava o que mudou desde que foi lido. */
    public static function gravar(): void
    {
        $ins = self::$pdo->prepare('REPLACE INTO ' . self::$p . 'documentos (colecao, id, dados, ordem, atualizado_em) VALUES (?, ?, ?, ?, ?)');
        $del = self::$pdo->prepare('DELETE FROM ' . self::$p . 'documentos WHERE colecao = ? AND id = ?');
        $quando = gmdate('Y-m-d H:i:s');
        foreach (self::$cache as $c => $docs) {
            foreach ($docs as $id => $o) {
                if (isset(self::$apagados[$c][$id])) continue;
                $json = json_texto(limpo($o));
                if ((self::$originais[$c][$id] ?? null) === $json) continue;
                $ins->execute([$c, (string) $id, $json, self::$ordem[$c][$id] ?? 0, $quando]);
                self::$originais[$c][$id] = $json;
            }
        }
        foreach (self::$apagados as $c => $ids) {
            foreach (array_keys($ids) as $id) $del->execute([$c, (string) $id]);
        }
        self::$apagados = [];
    }

    /** Grava já o que foi feito (ex.: tentativas de login falhadas) antes de devolver um erro. */
    public static function confirmarJa(): void
    {
        self::gravar();
        if (self::$pdo->inTransaction()) {
            self::$pdo->commit();
            self::$pdo->beginTransaction();
        }
    }

    public static function esquecer(): void
    {
        self::$cache = self::$completas = self::$originais = self::$apagados = self::$ordem = [];
    }
}

function json_texto(mixed $v): string
{
    return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

/** Campos em que null tem significado (o resto: null = ausente, como o undefined do frontend). */
const NULOS_COM_SIGNIFICADO = ['utilizadorId', 'fecho', 'senhaTemporaria', 'atual', 'anterior', 'respostaClienteHoras'];

/** Cópia sem propriedades nulas (o frontend usa "campo ausente", nunca null). */
function limpo(mixed $v): mixed
{
    if ($v instanceof stdClass) {
        $r = new stdClass();
        foreach (get_object_vars($v) as $k => $x) {
            if ($x === null && !in_array($k, NULOS_COM_SIGNIFICADO, true)) continue;
            $r->$k = limpo($x);
        }
        return $r;
    }
    if (is_array($v)) {
        // Listas ficam listas; mapas associativos passam a objeto.
        if (array_is_list($v)) return array_map('limpo', $v);
        $r = new stdClass();
        foreach ($v as $k => $x) {
            if ($x === null && !in_array((string) $k, NULOS_COM_SIGNIFICADO, true)) continue;
            $r->$k = limpo($x);
        }
        return $r;
    }
    return $v;
}

/** Cópia profunda (para devolver sem expor os objetos guardados a alterações). */
function copia(mixed $v): mixed
{
    return json_decode(json_texto(limpo($v)), false);
}

/** Próximo identificador de uma sequência (ex.: "an12"). */
function novo_id(string $seq, string $prefixo): string
{
    $s = Db::unico('sequencias');
    $s->$seq = ($s->$seq ?? 0) + 1;
    return $prefixo . $s->$seq;
}

function token_aleatorio(int $bytes = 18): string
{
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

// ---------- Validações (as mesmas mensagens do servidor simulado) ----------

function str(mixed $v): string
{
    if ($v === null || is_array($v) || is_object($v)) return '';
    if (is_bool($v)) return $v ? 'true' : 'false';
    return (string) $v;
}

function texto(mixed $v, string $campo, int $min = 1, int $max = 2000): string
{
    $s = trim(str($v));
    $n = mb_strlen($s);
    if ($n < $min) erro(422, "$campo: campo obrigatório" . ($min > 1 ? " (mínimo $min caracteres)" : '') . '.');
    if ($n > $max) erro(422, "$campo: máximo $max caracteres.");
    return $s;
}

/** Texto opcional: aparado e cortado; vazio → null. */
function opcional(mixed $v, int $max): ?string
{
    $s = mb_substr(trim(str($v)), 0, $max);
    return $s === '' ? null : $s;
}

function numero(mixed $v, string $campo, float $min = 0, float $max = PHP_INT_MAX, bool $inteiro = false): int|float
{
    if (is_bool($v)) $v = (int) $v;
    if (is_string($v)) $v = trim($v);
    if (!is_int($v) && !is_float($v) && !(is_string($v) && is_numeric($v))) erro(422, "$campo: valor inválido.");
    $n = $v + 0;
    if (!is_finite((float) $n) || $n < $min || $n > $max || ($inteiro && floor((float) $n) != $n)) erro(422, "$campo: valor inválido.");
    return $inteiro ? (int) $n : $n;
}

function um_de(mixed $v, array $opcoes, string $campo): string
{
    if (!is_string($v) || !in_array($v, $opcoes, true)) erro(422, "$campo: opção inválida.");
    return $v;
}

/** Arredondamento a cêntimos (Math.round(v * 100) / 100). */
function arred(float|int $v): float|int
{
    $r = floor($v * 100 + 0.5) / 100;
    return $r == (int) $r ? (int) $r : $r;
}

/** Arredondamento JS (Math.round): metade para cima. */
function jsround(float|int $v): int
{
    return (int) floor($v + 0.5);
}

/** 224124 → "224 124 Kz" (formato das mensagens). */
function kz(float|int $v): string
{
    return number_format(jsround($v), 0, ',', ' ') . ' Kz';
}

/** Número em texto pt-PT (até 2 casas, sem zeros à direita). */
function num_pt(float|int $v): string
{
    $s = number_format((float) $v, 2, ',', ' ');
    return rtrim(rtrim($s, '0'), ',');
}

function achar(array $lista, callable $f): mixed
{
    foreach ($lista as $x) if ($f($x)) return $x;
    return null;
}

function algum(array $lista, callable $f): bool
{
    foreach ($lista as $x) if ($f($x)) return true;
    return false;
}

function soma(array $lista, callable $f): float|int
{
    $s = 0;
    foreach ($lista as $x) $s += $f($x);
    return $s;
}

function filtrar(array $lista, callable $f): array
{
    return array_values(array_filter($lista, $f));
}

function prop(mixed $o, string $k, mixed $padrao = null): mixed
{
    return is_object($o) && isset($o->$k) ? $o->$k : $padrao;
}

// ---------- Sessão, CSRF e limites ----------

function iniciar_sessao(bool $criar): bool
{
    if (session_status() === PHP_SESSION_ACTIVE) return true;
    if (!$criar && empty($_COOKIE['MZDSESSAO'])) return false;
    $pasta = pasta_dados() . '/sessoes';
    if (!is_dir($pasta)) @mkdir($pasta, 0700, true);
    session_save_path($pasta);
    ini_set('session.gc_maxlifetime', (string) (12 * 3600));
    ini_set('session.use_strict_mode', '1');
    session_name('MZDSESSAO');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => https(), 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
    return true;
}

function https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function sessao_id(): ?string
{
    if (!iniciar_sessao(false)) return null;
    return $_SESSION['uid'] ?? null;
}

function definir_sessao(?string $uid): void
{
    iniciar_sessao(true);
    if ($uid === null) {
        $_SESSION = [];
        session_destroy();
        setcookie('MZDSESSAO', '', ['expires' => 1, 'path' => '/', 'secure' => https(), 'httponly' => true, 'samesite' => 'Lax']);
        return;
    }
    session_regenerate_id(true);
    $_SESSION['uid'] = $uid;
}

/** Cookie XSRF-TOKEN (legível pelo frontend) e verificação "double submit" em todos os pedidos que alteram dados. */
function csrf(string $metodo): void
{
    $atual = $_COOKIE['XSRF-TOKEN'] ?? '';
    if ($atual === '' || strlen($atual) < 20) {
        $atual = bin2hex(random_bytes(20));
        setcookie('XSRF-TOKEN', $atual, ['expires' => 0, 'path' => '/', 'secure' => https(), 'httponly' => false, 'samesite' => 'Lax']);
        $_COOKIE['XSRF-TOKEN'] = $atual;
        if ($metodo !== 'GET') erro(403, 'A sessão de segurança expirou. Recarregue a página e tente novamente.');
    }
    if ($metodo !== 'GET' && !hash_equals($atual, (string) ($_SERVER['HTTP_X_XSRF_TOKEN'] ?? ''))) {
        erro(403, 'Pedido recusado por segurança. Recarregue a página e tente novamente.');
    }
}

function ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0');
}

/** Conta acontecimentos numa janela (segundos); ao passar o máximo devolve 429. */
function limitar(string $chave, int $max, int $janela, string $mensagem): void
{
    $t = time();
    $st = Db::$pdo->prepare('SELECT n, desde FROM ' . Db::$p . 'limites WHERE chave = ?');
    $st->execute([$chave]);
    $r = $st->fetch();
    $n = ($r && $t - (int) $r['desde'] < $janela) ? (int) $r['n'] + 1 : 1;
    $desde = ($r && $n > 1) ? (int) $r['desde'] : $t;
    Db::$pdo->prepare('REPLACE INTO ' . Db::$p . 'limites (chave, n, desde) VALUES (?, ?, ?)')->execute([$chave, $n, $desde]);
    if ($n > $max) {
        Db::confirmarJa();
        erro(429, $mensagem);
    }
}

function limpar_limite(string $chave): void
{
    Db::$pdo->prepare('DELETE FROM ' . Db::$p . 'limites WHERE chave = ?')->execute([$chave]);
}

// ---------- Utilizadores, permissões e auditoria ----------

function publico(object $u): object
{
    $c = copia($u);
    unset($c->senhaHash);
    return $c;
}

function utilizador_atual(): object
{
    $id = sessao_id();
    $u = $id ? Db::obter('utilizadores', $id) : null;
    if (!$u || empty($u->ativo) || !empty($u->semAcesso)) erro(401, 'Sessão expirada. Inicie sessão novamente.');
    return $u;
}

function exigir(string $permissao): object
{
    $u = utilizador_atual();
    if (!pode($u, $permissao)) erro(403, 'Não tem permissão para esta operação.');
    return $u;
}

function auditar(?string $utilizadorId, string $acao, string $entidade, ?string $entidadeId = null, ?string $detalhe = null): void
{
    Db::$pdo->prepare('INSERT INTO ' . Db::$p . 'auditoria (id, data, utilizador_id, acao, entidade, entidade_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([novo_id('auditoria', 'a'), agora(), $utilizadorId, $acao, $entidade, $entidadeId, $detalhe]);
}

function obter_processo(string $id): object
{
    $p = Db::obter('processos', $id);
    if (!$p) erro(404, 'Processo não encontrado.');
    return $p;
}

function exigir_estado(object $p, string ...$estados): void
{
    if (!in_array($p->estado, $estados, true)) erro(422, 'Esta ação não está disponível na etapa atual do processo. Atualize a página.');
}

function registar_historico(object $p, string $autor, string $descricao, string $tipo, ?string $estado = null): void
{
    $h = (object) ['id' => 'h' . count($p->historico), 'data' => agora(), 'autor' => $autor, 'descricao' => $descricao, 'tipo' => $tipo];
    if ($estado) $h->estado = $estado;
    $p->historico[] = $h;
}

function novo_acesso_portal(): object
{
    return (object) ['token' => token_aleatorio(), 'criadoEm' => agora(), 'acessos' => 0];
}

function configuracao(): object
{
    return Db::unico('configuracao');
}
