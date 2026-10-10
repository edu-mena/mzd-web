<?php
// Tarefas pela linha de comandos (SSH ou Cron da Hostinger). Bloqueado na web pelo .htaccess.
//   php api/cli.php copia               → cópia de segurança agora (o sistema já faz uma por dia sozinho)
//   php api/cli.php repor <ficheiro>    → repõe a base de dados a partir de uma cópia (.json.gz) — apaga os dados atuais!

declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

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
require __DIR__ . '/nucleo/instalacao.php';

$cfg = config() ?? exit("Sistema por instalar (não encontrei " . pasta_dados() . "/config.php).\n");
Db::ligar($cfg);
$cmd = $argv[1] ?? '';

if ($cmd === 'copia') {
    Db::bloquear();
    $c = criar_copia('automatica');
    Db::gravar();
    Db::$pdo->commit();
    Db::desbloquear();
    echo "Cópia {$c->id} criada (" . round($c->tamanhoBytes / 1024) . " KB).\n";
} elseif ($cmd === 'repor' && !empty($argv[2]) && is_file($argv[2])) {
    echo "Isto apaga os dados atuais e repõe a cópia {$argv[2]}. Escreva SIM para continuar: ";
    if (trim((string) fgets(STDIN)) !== 'SIM') exit("Cancelado.\n");
    criar_tabelas();
    Db::bloquear();
    Db::$pdo->exec('DELETE FROM ' . Db::$p . 'documentos');
    Db::$pdo->exec('DELETE FROM ' . Db::$p . 'auditoria');
    $n = 0;
    foreach (gzfile($argv[2]) as $linha) {
        $x = json_decode($linha, true);
        if (!$x || !in_array($x['t'], ['documentos', 'auditoria'], true)) continue;
        $cols = array_keys($x['r']);
        Db::$pdo->prepare('INSERT INTO ' . Db::$p . $x['t'] . ' (' . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')')->execute(array_values($x['r']));
        $n++;
    }
    Db::$pdo->commit();
    Db::desbloquear();
    echo "Reposição concluída: $n registos.\n";
} else {
    echo "Uso: php cli.php copia | php cli.php repor <ficheiro.json.gz>\n";
}
