<?php
// API da MZD — controlador frontal. Todas as rotas /api/* chegam aqui (ver .htaccess).
// Contrato: src/api/endpoints.ts (frontend). Regras: src/api/mock (implementação de referência).

declare(strict_types=1);

require __DIR__ . '/nucleo/base.php';
require __DIR__ . '/nucleo/regras.php';
require __DIR__ . '/nucleo/cadastros.php';
require __DIR__ . '/nucleo/processos.php';
require __DIR__ . '/nucleo/stock.php';
require __DIR__ . '/nucleo/financeiro.php';
require __DIR__ . '/nucleo/comunicacoes.php';
require __DIR__ . '/nucleo/portal.php';
require __DIR__ . '/nucleo/relatorios.php';
require __DIR__ . '/nucleo/admin.php';

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$pos = strpos($uri, '/api/');
$caminho = $pos === false ? '/' : rtrim(substr($uri, $pos + 4), '/');
if ($caminho === '') $caminho = '/';

function responder(int $status, mixed $dados): never
{
    http_response_code($status);
    if ($status === 204) exit;
    header('Content-Type: application/json; charset=utf-8');
    echo json_texto(limpo($dados));
    exit;
}

function corresponder(string $padrao, string $caminho): ?array
{
    $a = explode('/', $padrao);
    $b = explode('/', $caminho);
    if (count($a) !== count($b)) return null;
    $params = [];
    foreach ($a as $i => $parte) {
        if (str_starts_with($parte, ':')) $params[substr($parte, 1)] = rawurldecode($b[$i]);
        elseif ($parte !== $b[$i]) return null;
    }
    return $params;
}

function registar_erro(Throwable $e): void
{
    @file_put_contents(pasta_dados() . '/erros.log', '[' . date('c') . '] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine() . "\n", FILE_APPEND);
}

$cfg = config();
if (!$cfg) {
    if ($caminho === '/saude') responder(200, ['instalado' => false]);
    responder(503, ['erro' => 'O sistema ainda não foi instalado. Abra /api/instalar.php.']);
}

$escrita = false;
try {
    Db::ligar($cfg);

    // Ficheiros (respostas binárias).
    if ($metodo === 'GET') {
        if ($p = corresponder('/media/site/:nome', $caminho)) {
            $nome = basename($p['nome']);
            $ext = strtolower(pathinfo($nome, PATHINFO_EXTENSION));
            servir_ficheiro(pasta_dados() . "/media/site/$nome", ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][$ext] ?? 'application/octet-stream', true);
        }
        if ($p = corresponder('/ficheiros/:id', $caminho)) {
            exigir('processos.ver');
            servir_anexo($p['id']);
        }
        if ($p = corresponder('/portal/:token/ficheiros/:id', $caminho)) {
            servir_anexo($p['id'], por_token($p['token']));
        }
    }

    csrf($metodo);

    // Com uma palavra-passe temporária, só se pode mudar a palavra-passe ou sair.
    if (!str_starts_with($caminho, '/auth/') && ($id = sessao_id())) {
        $u = Db::obter('utilizadores', $id);
        if ($u && !empty($u->mudarSenha)) erro(403, 'Altere a palavra-passe temporária antes de continuar.');
    }

    // O portal regista cada visita (acessos), por isso também escreve.
    $escrita = $metodo !== 'GET' || (str_starts_with($caminho, '/portal/') && $metodo === 'GET');
    if ($escrita) Db::bloquear();

    if ($metodo === 'POST' && ($p = corresponder('/processos/:id/anexos', $caminho))) {
        $resultado = enviar_anexo($p['id']);
    } elseif ($metodo === 'POST' && $caminho === '/site/imagens') {
        $resultado = enviar_imagem_site();
    } else {
        $bruto = file_get_contents('php://input');
        $corpo = $bruto !== '' && $bruto !== false ? json_decode($bruto, false) : null;
        if ($bruto !== '' && $bruto !== false && json_last_error() !== JSON_ERROR_NONE) erro(400, 'Pedido inválido (JSON).');
        $pedido = (object) ['params' => [], 'query' => $_GET, 'body' => is_object($corpo) ? $corpo : new stdClass()];
        $rota = null;
        foreach ([...rotas_admin(), ...rotas_cadastros(), ...rotas_processos(), ...rotas_stock(), ...rotas_financeiro(), ...rotas_comunicacoes(), ...rotas_portal(), ...rotas_relatorios()] as [$m, $padrao, $fn]) {
            if ($m !== $metodo) continue;
            $params = corresponder($padrao, $caminho);
            if ($params === null) continue;
            $pedido->params = $params;
            $rota = $fn;
            break;
        }
        if (!$rota) erro(404, "Rota inexistente: $metodo $caminho");
        $resultado = $rota($pedido);
    }

    if ($escrita) {
        Db::gravar();
        Db::$pdo->commit();
        Db::desbloquear();
    }
} catch (ApiErro $e) {
    if ($escrita) Db::desbloquear();
    responder($e->status, ['erro' => $e->getMessage()]);
} catch (Throwable $e) {
    if ($escrita) try { Db::desbloquear(); } catch (Throwable) {}
    registar_erro($e);
    responder(500, ['erro' => 'Erro inesperado no servidor. Tente novamente; se persistir, avise o administrador.']);
}

// Responde já e, depois, faz a cópia de segurança diária se ainda não houver.
http_response_code($resultado === null ? 204 : 200);
if ($resultado !== null) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_texto(limpo($resultado));
}
if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
elseif (function_exists('litespeed_finish_request')) litespeed_finish_request();
try {
    Db::esquecer();
    copia_automatica();
} catch (Throwable $e) {
    registar_erro($e);
}
