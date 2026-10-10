<?php
// Instalação (uma única vez): liga à base de dados MySQL criada no hPanel, cria as tabelas e as contas iniciais e
// guarda a configuração numa pasta fora de public_html. Depois disto esta página deixa de funcionar.
// Só aceita bases de dados neste servidor (localhost): quem não tem as credenciais do hPanel não consegue instalar.

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
require __DIR__ . '/nucleo/instalacao.php';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

$h = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
$v = fn($k, $d = '') => $_POST[$k] ?? $d;
$dados = pasta_dados();
$erro = null;
$senhas = null;
$perfis = ['admin' => 'Administrador do sistema', 'direcao' => 'Direção', 'rececao' => 'Receção (gestão completa)'];

if (config()) {
    http_response_code(403);
    echo '<!doctype html><meta name="viewport" content="width=device-width"><title>MZD</title><body style="font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem">'
        . '<h1>O sistema já está instalado</h1><p>Esta página já não faz nada. Entre em <a href="/login">/login</a>.</p>';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $host = trim($v('host', 'localhost'));
        if (!in_array($host, ['localhost', '127.0.0.1'], true)) throw new RuntimeException('A base de dados tem de estar neste servidor (localhost).');
        $cfg = ['db' => ['driver' => 'mysql', 'host' => $host, 'porta' => 3306, 'nome' => trim($v('nome')), 'utilizador' => trim($v('utilizador')), 'senha' => $v('senha'), 'prefixo' => 'mzd_']];
        $empresa = ['nome' => trim($v('empresa_nome')), 'nif' => trim($v('empresa_nif')), 'morada' => trim($v('empresa_morada')), 'telefone' => trim($v('empresa_telefone')), 'email' => mb_strtolower(trim($v('empresa_email')))];
        foreach ($empresa as $k => $x) if ($x === '') throw new RuntimeException('Preencha todos os dados da empresa.');
        if (!preg_match(EMAIL_VALIDO, $empresa['email'])) throw new RuntimeException('O email da empresa não é válido.');
        $contas = [];
        foreach ($v('contas', []) as $c) {
            $nome = trim($c['nome'] ?? '');
            $email = mb_strtolower(trim($c['email'] ?? ''));
            if ($nome === '' && $email === '') continue;
            if (mb_strlen($nome) < 3 || !preg_match(EMAIL_VALIDO, $email) || !isset($perfis[$c['perfil'] ?? ''])) throw new RuntimeException("Conta incompleta: indique nome, email válido e perfil ($email).");
            $contas[] = ['nome' => $nome, 'email' => $email, 'perfil' => $c['perfil']];
        }
        if (!array_filter($contas, fn($c) => $c['perfil'] === 'admin')) throw new RuntimeException('Crie pelo menos uma conta de administrador do sistema.');
        if (count(array_unique(array_column($contas, 'email'))) !== count($contas)) throw new RuntimeException('Há emails repetidos nas contas.');

        if (!is_dir($dados) && !@mkdir($dados, 0700, true)) throw new RuntimeException("Não foi possível criar a pasta de dados ($dados).");
        $raiz = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? '')) ?: '';
        if ($raiz !== '' && str_starts_with((string) realpath($dados), $raiz)) throw new RuntimeException('A pasta de dados não pode ficar dentro de public_html.');
        Db::ligar($cfg);
        criar_tabelas();
        Db::$pdo->beginTransaction();
        $senhas = dados_iniciais($empresa, $contas);
        Db::$pdo->commit();
        $cfg['email'] = ['remetente' => $empresa['email']];
        $conteudo = "<?php\n// Configuração da MZD (gerada pela instalação). Não partilhar.\nreturn " . var_export($cfg, true) . ";\n";
        if (file_put_contents("$dados/config.php", $conteudo) === false) throw new RuntimeException('Não foi possível gravar a configuração.');
        @chmod("$dados/config.php", 0600);
        @file_put_contents("$dados/.htaccess", "Require all denied\n");
    } catch (Throwable $e) {
        if (isset(Db::$pdo) && Db::$pdo->inTransaction()) Db::$pdo->rollBack();
        $erro = $e instanceof PDOException ? 'Não foi possível ligar à base de dados: confirme o nome, o utilizador e a palavra-passe criados no hPanel.' : $e->getMessage();
        $senhas = null;
    }
}
?><!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Instalação · MZD</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f4f2ec;color:#141414;max-width:46rem;margin:0 auto;padding:2rem 1rem 4rem}
  h1{font-size:1.6rem;margin:0 0 .25rem} h2{font-size:1.05rem;margin:2rem 0 .5rem} p.n{color:#5f5d57;margin-top:0}
  label{display:block;font-size:.85rem;font-weight:600;margin:.75rem 0 .25rem} input,select{width:100%;box-sizing:border-box;padding:.6rem;border:1px solid #c9c6bd;border-radius:6px;font:inherit;background:#fff}
  .g{display:grid;grid-template-columns:1fr 1fr;gap:0 1rem} .c{display:grid;grid-template-columns:1.2fr 1.4fr 1fr;gap:.5rem;margin-bottom:.5rem}
  button{margin-top:1.5rem;background:#141414;color:#fff;border:0;border-radius:6px;padding:.8rem 1.4rem;font:inherit;font-weight:600;cursor:pointer}
  .erro{background:#fde8e8;border-left:3px solid #c00;padding:.75rem 1rem} .ok{background:#e7f4ea;border-left:3px solid #1a7f37;padding:.75rem 1rem}
  table{border-collapse:collapse;width:100%;margin-top:.75rem} td,th{border-bottom:1px solid #ddd;padding:.5rem;text-align:left} code{font-size:1rem}
</style>
</head>
<body>
<h1>Instalação do sistema MZD</h1>
<?php if ($senhas): ?>
  <p class="ok"><strong>Instalação concluída.</strong> Guarde já as palavras-passe temporárias: não voltam a aparecer. Cada pessoa muda a sua no primeiro acesso.</p>
  <table><tr><th>Conta</th><th>Palavra-passe temporária</th></tr>
  <?php foreach ($senhas as $email => $s): ?><tr><td><?= $h($email) ?></td><td><code><?= $h($s) ?></code></td></tr><?php endforeach; ?>
  </table>
  <p>Depois, em <strong>Definições</strong>, a Direção preenche as coordenadas de pagamento (IBAN) e confirma as condições.</p>
  <p><a href="/login">Entrar no sistema →</a></p>
<?php else: ?>
  <p class="n">Crie primeiro a base de dados MySQL no hPanel (Bases de dados → MySQL) e use aqui o nome, o utilizador e a palavra-passe.
  Os dados ficam em <code><?= $h($dados) ?></code>, fora do site público.</p>
  <?php if ($erro): ?><p class="erro"><?= $h($erro) ?></p><?php endif; ?>
  <form method="post" autocomplete="off">
    <h2>Base de dados</h2>
    <div class="g">
      <div><label>Servidor</label><input name="host" value="<?= $h($v('host', 'localhost')) ?>"></div>
      <div><label>Nome da base de dados</label><input name="nome" required value="<?= $h($v('nome')) ?>" placeholder="u123456789_mzd"></div>
      <div><label>Utilizador</label><input name="utilizador" required value="<?= $h($v('utilizador')) ?>"></div>
      <div><label>Palavra-passe</label><input name="senha" type="password" required></div>
    </div>
    <h2>Empresa</h2>
    <div class="g">
      <div><label>Nome comercial</label><input name="empresa_nome" required value="<?= $h($v('empresa_nome', 'MZD Carros e Motores')) ?>"></div>
      <div><label>NIF</label><input name="empresa_nif" required value="<?= $h($v('empresa_nif')) ?>"></div>
      <div><label>Morada</label><input name="empresa_morada" required value="<?= $h($v('empresa_morada', 'Luanda, Angola')) ?>"></div>
      <div><label>Telefone</label><input name="empresa_telefone" required value="<?= $h($v('empresa_telefone', '+244 ')) ?>"></div>
      <div><label>Email da oficina (envia os emails aos clientes)</label><input name="empresa_email" type="email" required value="<?= $h($v('empresa_email')) ?>"></div>
    </div>
    <h2>Contas iniciais</h2>
    <p class="n">Os técnicos e as restantes contas criam-se depois em Administração → Utilizadores.</p>
    <?php $pre = $v('contas', [['perfil' => 'admin'], ['perfil' => 'admin'], ['perfil' => 'direcao'], ['perfil' => 'rececao']]);
    for ($i = 0; $i < 5; $i++): $c = $pre[$i] ?? ['perfil' => 'rececao']; ?>
      <div class="c">
        <input name="contas[<?= $i ?>][nome]" placeholder="Nome" value="<?= $h($c['nome'] ?? '') ?>" aria-label="Nome">
        <input name="contas[<?= $i ?>][email]" type="email" placeholder="email@exemplo.com" value="<?= $h($c['email'] ?? '') ?>" aria-label="Email">
        <select name="contas[<?= $i ?>][perfil]" aria-label="Perfil"><?php foreach ($perfis as $k => $l): ?><option value="<?= $k ?>"<?= ($c['perfil'] ?? '') === $k ? ' selected' : '' ?>><?= $h($l) ?></option><?php endforeach; ?></select>
      </div>
    <?php endfor; ?>
    <button type="submit">Instalar</button>
  </form>
<?php endif; ?>
</body>
</html>
