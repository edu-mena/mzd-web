<?php
// Criação das tabelas e dos dados iniciais (usado por instalar.php e por cli.php).

declare(strict_types=1);

function criar_tabelas(): void
{
    $p = Db::$p;
    if (Db::mysql()) {
        $opc = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
        Db::$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}documentos (
            colecao VARCHAR(30) NOT NULL, id VARCHAR(64) NOT NULL, dados LONGTEXT NOT NULL, ordem BIGINT NOT NULL DEFAULT 0,
            atualizado_em DATETIME NOT NULL, PRIMARY KEY (colecao, id), KEY ordem (colecao, ordem)) $opc");
        Db::$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}auditoria (
            seq BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, id VARCHAR(30) NOT NULL, data VARCHAR(30) NOT NULL, utilizador_id VARCHAR(30) NULL,
            acao VARCHAR(60) NOT NULL, entidade VARCHAR(40) NOT NULL, entidade_id VARCHAR(64) NULL, detalhe TEXT NULL,
            KEY data (data), KEY utilizador (utilizador_id), KEY entidade (entidade)) $opc");
        Db::$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}limites (chave VARCHAR(160) NOT NULL PRIMARY KEY, n INT NOT NULL, desde INT NOT NULL) $opc");
    } else {
        Db::$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}documentos (colecao TEXT NOT NULL, id TEXT NOT NULL, dados TEXT NOT NULL, ordem INTEGER NOT NULL DEFAULT 0, atualizado_em TEXT NOT NULL, PRIMARY KEY (colecao, id))");
        Db::$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}auditoria (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, data TEXT NOT NULL, utilizador_id TEXT NULL, acao TEXT NOT NULL, entidade TEXT NOT NULL, entidade_id TEXT NULL, detalhe TEXT NULL)");
        Db::$pdo->exec("CREATE TABLE IF NOT EXISTS {$p}limites (chave TEXT NOT NULL PRIMARY KEY, n INTEGER NOT NULL, desde INTEGER NOT NULL)");
    }
}

/**
 * Dados iniciais: definições, modelos de mensagem, conteúdo do site e as contas indicadas.
 * Devolve [email => senha temporária] (mostradas uma única vez).
 */
function dados_iniciais(array $empresa, array $contas): array
{
    if (Db::obter('sistema', 'configuracao')) erro(422, 'A base de dados já tem uma instalação.');
    Db::unico('configuracao', (object) [
        'empresa' => (object) $empresa,
        'coordenadasPagamento' => [],
        'instrucoesPagamento' => 'Indique o nº do processo no descritivo da transferência e envie o comprovativo por WhatsApp.',
        'taxaIva' => 14, 'motivoIsencaoIva' => 'Isento de IVA', 'valorHora' => 8500, 'validadeOrcamentoDias' => 10,
        'condicoes' => (object) ['pecasAceitacaoPct' => 100, 'maoObraAceitacaoPct' => 60, 'parqueamentoDia' => 3600, 'diasUteisLevantamento' => 5],
        'garantiaPecasMeses' => 6, 'garantiaMaoObraMeses' => 3, 'capacidadeDiaria' => 6, 'descontoMaximoPct' => 5,
    ]);
    // Numeração a partir de 1000 (processos) e 2000 (faturas), como na demonstração.
    Db::unico('sequencias', (object) ['processo' => 1000, 'fatura' => 2000]);
    modelos();
    conteudo_site();
    $senhas = [];
    foreach ($contas as $c) {
        $u = (object) ['id' => novo_id('utilizador', 'u'), 'nome' => $c['nome'], 'email' => mb_strtolower($c['email']), 'perfil' => $c['perfil']];
        $u->avatarIniciais = iniciais($c['nome']);
        $u->ativo = true;
        $senha = senha_temporaria();
        $u->senhaHash = password_hash($senha, PASSWORD_DEFAULT);
        $u->mudarSenha = true;
        $u->criadoEm = agora();
        Db::inserir('utilizadores', $u);
        auditar(null, 'criar', 'utilizador', $u->id, "{$u->nome} · " . PERFIL_LABEL[$u->perfil] . ' (instalação)');
        $senhas[$u->email] = $senha;
    }
    Db::gravar();
    return $senhas;
}
