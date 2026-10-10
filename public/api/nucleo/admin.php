<?php
// Autenticação, utilizadores, auditoria, sistema (cópias de segurança), definições, site público e ficheiros.
// Porte de src/api/mock/server.ts, administracao.ts e site.ts.

declare(strict_types=1);

const MAX_COPIAS = 30;
const LIMITES_FICHEIRO = ['foto' => 10 * 1024 * 1024, 'video' => 60 * 1024 * 1024, 'documento' => 10 * 1024 * 1024, 'assinatura' => 1024 * 1024];
const FINALIDADES = ['ficha_entrada', 'comprovativo_aprovacao', 'assinatura_entrega'];
const EMAIL_VALIDO = '/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/';

// ---------- Palavras-passe (src/lib/senha.ts) ----------

function erro_senha(string $senha, object $u): ?string
{
    $s = mb_strtolower($senha);
    $local = mb_strtolower(explode('@', $u->email ?? '')[0] ?? '');
    $sem = fn($x) => preg_replace('/\p{Mn}/u', '', class_exists('Normalizer') ? Normalizer::normalize($x, Normalizer::FORM_D) : $x);
    $nomes = array_filter(preg_split('/\s+/', mb_strtolower($sem($u->nome ?? ''))), fn($n) => mb_strlen($n) >= 3);
    $semAcentos = $sem($s);
    $regras = [
        [mb_strlen($senha) >= 10, 'Pelo menos 10 caracteres'],
        [preg_match('/[a-zA-Z]/', $senha) && preg_match('/\d/', $senha), 'Letras e números'],
        [!($local && str_contains($s, $local)) && !algum($nomes, fn($n) => str_contains($semAcentos, $n)), 'Sem o seu nome nem o email'],
        [!algum(['mzd2026', 'password', '123456', 'qwerty', 'oficina'], fn($f) => str_contains($s, $f)), 'Nada óbvio (ex.: "mzd2026")'],
    ];
    foreach ($regras as [$ok, $t]) if (!$ok) return 'Palavra-passe fraca: ' . mb_strtolower($t) . '.';
    return null;
}

/** Senha temporária legível (sem 0/O nem 1/l), com letras e números. */
function senha_temporaria(): string
{
    $letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    $numeros = '23456789';
    $s = '';
    for ($i = 0; $i < 12; $i++) {
        $b = random_int(0, 255);
        $s .= $i % 4 === 3 ? $numeros[$b % 8] : $letras[$b % strlen($letras)];
        if ($i === 3 || $i === 7) $s .= '-';
    }
    return $s;
}

function iniciais(string $nome): string
{
    $p = preg_split('/\s+/', trim($nome));
    return mb_strtoupper(mb_substr($p[0] ?? '', 0, 1) . (count($p) > 1 ? mb_substr(end($p), 0, 1) : ''));
}

function obter_utilizador(string $id): object
{
    return Db::obter('utilizadores', $id) ?? erro(404, 'Utilizador não encontrado.');
}

function admins_ativos(): array
{
    return filtrar(Db::todos('utilizadores'), fn($x) => $x->perfil === 'admin' && !empty($x->ativo));
}

function exigir_sobre(object $u, string $perfilAlvo): void
{
    if ($perfilAlvo === 'admin' && !pode($u, 'sistema.admin')) erro(403, 'Só o administrador do sistema pode gerir contas de administrador.');
}

function validar_utilizador(mixed $b, ?string $ignorarId = null): object
{
    $nome = texto($b->nome ?? null, 'Nome', 3, 80);
    $perfil = um_de($b->perfil ?? null, array_keys(PERFIL_LABEL), 'Perfil');
    $semAcesso = ($b->semAcesso ?? null) === true;
    if ($semAcesso && $perfil !== 'mecanico') erro(422, 'Só técnicos (mecânicos) podem existir sem acesso ao sistema.');
    $bruto = mb_strtolower(trim(str($b->email ?? '')));
    $email = $semAcesso && $bruto === '' ? '' : texto($bruto, 'Email', 5, 120);
    if ($email && !preg_match(EMAIL_VALIDO, $email)) erro(422, 'Email inválido.');
    if ($email && algum(Db::todos('utilizadores'), fn($x) => $x->id !== $ignorarId && mb_strtolower($x->email ?? '') === $email)) erro(409, 'Já existe uma conta com este email.');
    return (object) ['nome' => $nome, 'email' => $email, 'telefone' => opcional($b->telefone ?? null, 20), 'perfil' => $perfil, 'semAcesso' => $semAcesso ?: null];
}

// ---------- Cópias de segurança ----------
// Todos os dias (no primeiro pedido depois das 03:00, ou pelo Cron com `php api/cli.php copia`) e quando o administrador pede.
// Base de dados em JSON comprimido, fora de public_html, guardada 30 dias. Reposição por SSH: `php api/cli.php repor <ficheiro>`.

function pasta_copias(): string
{
    $d = pasta_dados() . '/copias';
    if (!is_dir($d)) @mkdir($d, 0700, true);
    return $d;
}

function criar_copia(string $tipo, ?string $porId = null): object
{
    $id = 'cp' . date('YmdHis') . substr(bin2hex(random_bytes(2)), 0, 4);
    $f = pasta_copias() . "/$id.json.gz";
    $gz = gzopen($f, 'wb6');
    foreach (['documentos', 'auditoria'] as $t) {
        $st = Db::$pdo->query('SELECT * FROM ' . Db::$p . $t);
        while ($r = $st->fetch()) gzwrite($gz, json_texto(['t' => $t, 'r' => $r]) . "\n");
    }
    gzclose($gz);
    $ficheiros = count(Db::todos('anexos'));
    $c = (object) ['id' => $id, 'data' => agora(), 'tipo' => $tipo, 'tamanhoBytes' => filesize($f), 'ficheiros' => $ficheiros];
    if ($porId) $c->criadoPorId = $porId;
    Db::inserir('copias', $c);
    $todas = Db::todos('copias');
    usort($todas, fn($a, $b) => strcmp($b->data, $a->data));
    foreach (array_slice($todas, MAX_COPIAS) as $velha) {
        @unlink(pasta_copias() . "/{$velha->id}.json.gz");
        Db::apagar('copias', $velha->id);
    }
    return $c;
}

/** Cópia automática diária (chamada depois de responder). */
function copia_automatica(): void
{
    $hoje = dia_local();
    if ((int) date('G') < 3) return;
    $ultima = Db::unico('ultima_copia_automatica');
    if (($ultima->dia ?? '') === $hoje) return;
    Db::bloquear();
    try {
        Db::esquecer();
        $ultima = Db::unico('ultima_copia_automatica');
        if (($ultima->dia ?? '') !== $hoje) {
            $ultima->dia = $hoje;
            criar_copia('automatica');
            Db::gravar();
            Db::$pdo->commit();
        }
    } finally {
        Db::desbloquear();
    }
}

// ---------- Site ----------

function validar_imagem_site(mixed $v, string $campo): object
{
    $url = texto($v->url ?? null, "$campo: imagem", 1, 300);
    if (!preg_match('#^(/imagens/site/|/api/media/site/)#', $url)) erro(422, "$campo: imagem inválida.");
    return (object) ['url' => $url, 'alt' => texto($v->alt ?? null, "$campo: descrição da imagem", 3, 160), 'credito' => opcional($v->credito ?? null, 200)];
}

function lista_site(mixed $v, string $campo, int $max, callable $f): array
{
    if (!is_array($v)) erro(422, "$campo: lista inválida.");
    if (count($v) > $max) erro(422, "$campo: máximo $max.");
    return array_map($f, $v, array_keys($v));
}

function ident(mixed $x, int $i): string
{
    return mb_substr(trim(str($x->id ?? '')), 0, 40) ?: 'i' . base_convert((string) time(), 10, 36) . $i;
}

function validar_conteudo_site(mixed $b): object
{
    $email = texto($b->contactos->email ?? null, 'Email', 5, 120);
    if (!preg_match(EMAIL_VALIDO, $email)) erro(422, 'Email inválido.');
    $mapa = trim(str($b->contactos->mapaUrl ?? ''));
    if ($mapa && !preg_match('#^https://(www\.)?(google\.[a-z.]+/maps|maps\.app\.goo\.gl|goo\.gl/maps)#', $mapa)) erro(422, 'Ligação do mapa: use um endereço do Google Maps.');
    return (object) [
        'hero' => (object) ['titulo' => texto($b->hero->titulo ?? null, 'Título principal', 5, 80), 'subtitulo' => texto($b->hero->subtitulo ?? null, 'Subtítulo', 10, 300), 'imagem' => validar_imagem_site($b->hero->imagem ?? null, 'Imagem principal')],
        'destaques' => lista_site($b->destaques ?? null, 'Destaques', 4, fn($x) => (object) ['titulo' => texto($x->titulo ?? null, 'Destaque', 3, 50), 'texto' => texto($x->texto ?? null, 'Texto do destaque', 5, 200)]),
        'marcas' => array_values(array_unique(lista_site($b->marcas ?? [], 'Marcas', 40, fn($x) => texto($x, 'Marca', 2, 30)))),
        'modelos' => lista_site($b->modelos ?? null, 'Modelos', 12, fn($x, $i) => (object) ['id' => ident($x, $i), 'nome' => texto($x->nome ?? null, 'Modelo', 2, 40), 'descricao' => texto($x->descricao ?? null, 'Descrição de ' . str($x->nome ?? 'modelo'), 5, 240), 'imagem' => validar_imagem_site($x->imagem ?? null, 'Modelo ' . str($x->nome ?? ($i + 1)))]),
        'servicos' => lista_site($b->servicos ?? null, 'Serviços', 12, fn($x, $i) => (object) ['id' => ident($x, $i), 'titulo' => texto($x->titulo ?? null, 'Serviço', 3, 50), 'descricao' => texto($x->descricao ?? null, 'Descrição de ' . str($x->titulo ?? 'serviço'), 5, 240), 'imagem' => validar_imagem_site($x->imagem ?? null, 'Serviço ' . str($x->titulo ?? ($i + 1)))]),
        'galeria' => lista_site($b->galeria ?? null, 'Galeria', 24, fn($x, $i) => (object) (['id' => ident($x, $i)] + (array) validar_imagem_site($x, 'Galeria ' . ($i + 1)))),
        'testemunhos' => lista_site($b->testemunhos ?? null, 'Testemunhos', 12, fn($x, $i) => (object) ['id' => ident($x, $i), 'nome' => texto($x->nome ?? null, 'Nome no testemunho', 2, 60), 'viatura' => opcional($x->viatura ?? null, 60), 'texto' => texto($x->texto ?? null, 'Testemunho', 10, 400)]),
        'contactos' => (object) [
            'telefone' => texto($b->contactos->telefone ?? null, 'Telefone', 9, 30), 'whatsapp' => texto($b->contactos->whatsapp ?? null, 'WhatsApp', 9, 30),
            'email' => $email, 'morada' => texto($b->contactos->morada ?? null, 'Morada', 3, 200), 'horario' => texto($b->contactos->horario ?? null, 'Horário', 3, 120),
            'mapaUrl' => $mapa ?: null,
        ],
        'seo' => (object) ['titulo' => texto($b->seo->titulo ?? null, 'Título para o Google', 10, 70), 'descricao' => texto($b->seo->descricao ?? null, 'Descrição para o Google', 30, 170)],
    ];
}

function conteudo_site(): object
{
    $s = Db::obter('sistema', 'site');
    if (!$s) {
        $s = dados_padrao('site');
        $s->id = 'site';
        Db::inserir('sistema', $s);
    }
    return $s;
}

// ---------- Definições ----------

function validar_configuracao(mixed $b): object
{
    $contas = [];
    foreach (is_array($b->coordenadasPagamento ?? null) ? $b->coordenadasPagamento : [] as $i => $c) {
        $n = $i + 1;
        $iban = mb_strtoupper(texto($c->iban ?? null, "Conta $n: IBAN", 10, 40));
        if (!preg_match('/^AO\d{2}(\s?\d){21}$/', $iban)) erro(422, "Conta $n: IBAN inválido (AO + 23 algarismos).");
        $contas[] = (object) [
            'id' => mb_substr(str($c->id ?? ''), 0, 40) ?: 'cb' . base_convert((string) time(), 10, 36) . $i,
            'banco' => texto($c->banco ?? null, "Conta $n: banco", 2, 80), 'titular' => texto($c->titular ?? null, "Conta $n: titular", 3, 120),
            'iban' => $iban, 'conta' => opcional($c->conta ?? null, 40),
        ];
    }
    if (count($contas) > 5) erro(422, 'Máximo de 5 contas.');
    $email = texto($b->empresa->email ?? null, 'Email', 5, 120);
    if (!preg_match(EMAIL_VALIDO, $email)) erro(422, 'Email inválido.');
    return (object) [
        'empresa' => (object) [
            'nome' => texto($b->empresa->nome ?? null, 'Nome comercial', 2, 120), 'nif' => texto($b->empresa->nif ?? null, 'NIF', 5, 30),
            'morada' => texto($b->empresa->morada ?? null, 'Morada', 2, 200), 'telefone' => texto($b->empresa->telefone ?? null, 'Telefone', 6, 30), 'email' => $email,
        ],
        'coordenadasPagamento' => $contas,
        'instrucoesPagamento' => opcional($b->instrucoesPagamento ?? null, 300),
        'taxaIva' => numero($b->taxaIva ?? null, 'Taxa de IVA', 0, 100),
        'motivoIsencaoIva' => texto($b->motivoIsencaoIva ?? null, 'Motivo da isenção de IVA', 3, 200),
        'valorHora' => numero($b->valorHora ?? null, 'Mão de obra (Kz/hora)', 1),
        'validadeOrcamentoDias' => numero($b->validadeOrcamentoDias ?? null, 'Validade do orçamento', 1, 90, true),
        'condicoes' => (object) [
            'pecasAceitacaoPct' => numero($b->condicoes->pecasAceitacaoPct ?? null, 'Peças pagas na aceitação (%)', 0, 100),
            'maoObraAceitacaoPct' => numero($b->condicoes->maoObraAceitacaoPct ?? null, 'Mão de obra paga na aceitação (%)', 0, 100),
            'parqueamentoDia' => numero($b->condicoes->parqueamentoDia ?? null, 'Parqueamento por dia', 0),
            'diasUteisLevantamento' => numero($b->condicoes->diasUteisLevantamento ?? null, 'Dias úteis para levantar', 0, 60, true),
        ],
        'garantiaPecasMeses' => numero($b->garantiaPecasMeses ?? null, 'Garantia de peças', 0, 120, true),
        'garantiaMaoObraMeses' => numero($b->garantiaMaoObraMeses ?? null, 'Garantia de mão de obra', 0, 120, true),
        'capacidadeDiaria' => numero($b->capacidadeDiaria ?? null, 'Capacidade diária', 1, 100, true),
        'descontoMaximoPct' => numero($b->descontoMaximoPct ?? null, 'Desconto sem aprovação', 0, 100),
    ];
}

function sem_id_config(): object
{
    $c = copia(configuracao());
    unset($c->id);
    return $c;
}

// ---------- Ficheiros ----------

function pasta_ficheiros(string $sub): string
{
    $d = pasta_dados() . "/$sub";
    if (!is_dir($d)) @mkdir($d, 0700, true);
    return $d;
}

/** Re-codifica fotografias (retira metadados e conteúdo escondido). Devolve [bytes, mime]. */
function recodificar_imagem(string $caminho, string $mime): ?array
{
    if (!function_exists('imagecreatefromstring') || $mime === 'image/gif') return null;
    $img = @imagecreatefromstring((string) file_get_contents($caminho));
    if (!$img) return null;
    ob_start();
    if ($mime === 'image/png') { imagesavealpha($img, true); imagepng($img, null, 6); $m = 'image/png'; }
    else { imagejpeg($img, null, 85); $m = 'image/jpeg'; }
    imagedestroy($img);
    return [ob_get_clean(), $m];
}

const EXTENSOES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'application/pdf' => 'pdf', 'video/mp4' => 'mp4', 'video/quicktime' => 'mov', 'video/webm' => 'webm', 'video/3gpp' => '3gp'];

function servir_ficheiro(string $caminho, string $mime, bool $publico = false): never
{
    if (!is_file($caminho)) { http_response_code(404); exit; }
    header("Content-Type: $mime");
    header('Content-Length: ' . filesize($caminho));
    header('X-Content-Type-Options: nosniff');
    header($publico ? 'Cache-Control: public, max-age=31536000, immutable' : 'Cache-Control: private, max-age=86400');
    if ($mime === 'application/pdf') header('Content-Disposition: inline');
    readfile($caminho);
    exit;
}

function enviar_anexo(string $processoId): object
{
    $u = exigir('processos.ver');
    $p = obter_processo($processoId);
    if (!esta_ativo($p->estado)) erro(422, 'Não é possível juntar ficheiros a um processo encerrado.');
    $f = $_FILES['ficheiro'] ?? null;
    if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !$f['size']) {
        erro(422, in_array($f['error'] ?? 0, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 'Ficheiro demasiado grande para o servidor.' : 'Nenhum ficheiro recebido.');
    }
    $tipo = str($_POST['tipo'] ?? '');
    if (!isset(LIMITES_FICHEIRO[$tipo])) erro(422, 'Tipo de ficheiro inválido.');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: '';
    $valido = in_array($tipo, ['foto', 'assinatura'], true) ? str_starts_with($mime, 'image/')
        : ($tipo === 'video' ? str_starts_with($mime, 'video/') : ($mime === 'application/pdf' || str_starts_with($mime, 'image/')));
    if (!$valido || !isset(EXTENSOES[$mime])) erro(422, 'O formato do ficheiro não corresponde ao tipo indicado.');
    if ($f['size'] > LIMITES_FICHEIRO[$tipo]) erro(422, 'Ficheiro demasiado grande (máximo ' . intdiv(LIMITES_FICHEIRO[$tipo], 1024 * 1024) . ' MB).');
    $finalidade = str($_POST['finalidade'] ?? '');
    if ($finalidade !== '' && !in_array($finalidade, FINALIDADES, true)) erro(422, 'Finalidade inválida.');

    $id = novo_id('anexo', 'an');
    $dados = str_starts_with($mime, 'image/') ? recodificar_imagem($f['tmp_name'], $mime) : null;
    if ($dados) $mime = $dados[1];
    $destino = pasta_ficheiros("ficheiros/{$p->id}") . "/$id." . EXTENSOES[$mime];
    if ($dados) file_put_contents($destino, $dados[0]);
    elseif (!move_uploaded_file($f['tmp_name'], $destino)) erro(500, 'Não foi possível guardar o ficheiro.');
    $a = (object) ['id' => $id, 'processoId' => $p->id, 'tipo' => $tipo, 'etapa' => $p->estado];
    if ($finalidade !== '') $a->finalidade = $finalidade;
    $legenda = opcional($_POST['legenda'] ?? null, 200);
    if ($legenda) $a->legenda = $legenda;
    $a->nome = mb_substr(basename(str($f['name'] ?? '')) ?: "$tipo-$id", 0, 120);
    $a->url = "/api/ficheiros/$id";
    $a->tamanhoBytes = filesize($destino);
    $a->criadoEm = agora();
    $a->autorId = $u->id;
    $a->mime = $mime;
    $a->caminho = "ficheiros/{$p->id}/" . basename($destino);
    Db::inserir('anexos', $a);
    auditar($u->id, 'anexar', 'processo', $p->id, $tipo . ($finalidade !== '' ? " ($finalidade)" : ''));
    return anexo_publico($a);
}

function enviar_imagem_site(): object
{
    $u = exigir('site.gerir');
    $f = $_FILES['ficheiro'] ?? null;
    if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !$f['size']) erro(422, 'Nenhum ficheiro recebido.');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: '';
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) erro(422, 'Só são aceites imagens.');
    if ($f['size'] > 5 * 1024 * 1024) erro(422, 'Imagem demasiado grande (máximo 5 MB).');
    $dados = recodificar_imagem($f['tmp_name'], $mime);
    $mime = $dados[1] ?? $mime;
    $nome = novo_id('anexo', 'site') . '.' . EXTENSOES[$mime];
    $destino = pasta_ficheiros('media/site') . "/$nome";
    if ($dados) file_put_contents($destino, $dados[0]); else move_uploaded_file($f['tmp_name'], $destino);
    auditar($u->id, 'enviar_imagem', 'site', $nome);
    return (object) ['url' => "/api/media/site/$nome", 'alt' => mb_substr(str($_POST['alt'] ?? ''), 0, 160)];
}

/** Anexo como a API o devolve (sem o caminho no disco). */
function anexo_publico(object $a): object
{
    $r = copia($a);
    unset($r->caminho, $r->mime);
    return $r;
}

/** Anexos de processos: só com sessão (e permissão de ver processos). */
function servir_anexo(string $id, ?object $processoDoPortal = null): never
{
    $a = Db::obter('anexos', $id);
    if (!$a || ($processoDoPortal && $a->processoId !== $processoDoPortal->id)) erro(404, 'Ficheiro não encontrado.');
    // No portal, só as fotografias da viatura (nunca assinaturas nem comprovativos).
    if ($processoDoPortal && (!empty($a->finalidade) || !in_array($a->tipo, ['foto', 'video'], true))) erro(404, 'Ficheiro não encontrado.');
    servir_ficheiro(pasta_dados() . '/' . $a->caminho, $a->mime);
}

function rotas_admin(): array
{
    return [
        ['GET', '/saude', fn() => (object) ['instalado' => true, 'versao' => VERSAO_API]],

        // ----- Autenticação -----
        ['POST', '/auth/login', function ($r) {
            $email = mb_strtolower(trim(str($r->body->email ?? '')));
            $senha = str($r->body->senha ?? '');
            limitar('login-ip:' . ip(), 30, 900, 'Demasiadas tentativas. Aguarde alguns minutos e tente novamente.');
            $chave = 'login:' . $email;
            $st = Db::$pdo->prepare('SELECT n, desde FROM ' . Db::$p . 'limites WHERE chave = ?');
            $st->execute([$chave]);
            $t = $st->fetch();
            if ($t && (int) $t['n'] >= 5 && time() - (int) $t['desde'] < 60) erro(429, 'Demasiadas tentativas falhadas. Aguarde um minuto e tente novamente.');
            $u = $email !== '' ? achar(Db::todos('utilizadores'), fn($x) => mb_strtolower($x->email ?? '') === $email) : null;
            if (!$u || empty($u->senhaHash) || !password_verify($senha, $u->senhaHash) || empty($u->ativo) || !empty($u->semAcesso)) {
                $n = ($t && time() - (int) $t['desde'] < 600) ? (int) $t['n'] + 1 : 1;
                Db::$pdo->prepare('REPLACE INTO ' . Db::$p . 'limites (chave, n, desde) VALUES (?, ?, ?)')->execute([$chave, $n, time()]);
                auditar($u->id ?? null, 'login_falhado', 'sessao', null, $email);
                Db::confirmarJa();
                erro(401, 'Email ou palavra-passe incorretos.');
            }
            limpar_limite($chave);
            if (password_needs_rehash($u->senhaHash, PASSWORD_DEFAULT)) $u->senhaHash = password_hash($senha, PASSWORD_DEFAULT);
            $u->ultimoAcesso = agora();
            definir_sessao($u->id);
            auditar($u->id, 'login', 'sessao');
            return publico($u);
        }],
        ['POST', '/auth/logout', function () {
            $id = sessao_id();
            if ($id) auditar($id, 'logout', 'sessao');
            definir_sessao(null);
            return null;
        }],
        ['GET', '/auth/me', fn() => publico(utilizador_atual())],
        ['POST', '/auth/senha', function ($r) {
            $u = utilizador_atual();
            $atual = str($r->body->atual ?? '');
            if (!password_verify($atual, $u->senhaHash ?? '')) erro(422, 'A palavra-passe atual não está correta.');
            $nova = str($r->body->nova ?? '');
            $fraca = erro_senha($nova, $u);
            if ($fraca) erro(422, $fraca);
            if ($nova === $atual) erro(422, 'A nova palavra-passe tem de ser diferente da atual.');
            $u->senhaHash = password_hash($nova, PASSWORD_DEFAULT);
            $u->mudarSenha = false;
            auditar($u->id, 'mudar_senha', 'utilizador', $u->id);
            return publico($u);
        }],

        // ----- Utilizadores -----
        ['GET', '/utilizadores', function () {
            utilizador_atual();
            return array_map('publico', Db::todos('utilizadores'));
        }],
        ['POST', '/utilizadores', function ($r) {
            $u = exigir('utilizadores.gerir');
            $d = validar_utilizador($r->body);
            exigir_sobre($u, $d->perfil);
            $senha = senha_temporaria();
            $novo = (object) ['id' => novo_id('utilizador', 'u')];
            atribuir($novo, $d);
            $novo->avatarIniciais = iniciais($d->nome);
            $novo->ativo = true;
            $novo->senhaHash = password_hash($d->semAcesso ? bin2hex(random_bytes(16)) : $senha, PASSWORD_DEFAULT);
            $novo->mudarSenha = !$d->semAcesso;
            $novo->criadoEm = agora();
            Db::inserir('utilizadores', $novo);
            auditar($u->id, 'criar', 'utilizador', $novo->id, "{$novo->nome} · " . PERFIL_LABEL[$novo->perfil] . ($d->semAcesso ? ' · sem acesso' : ''));
            return (object) ['utilizador' => publico($novo), 'senhaTemporaria' => $d->semAcesso ? null : $senha];
        }],
        ['PUT', '/utilizadores/:id', function ($r) {
            $u = exigir('utilizadores.gerir');
            $alvo = obter_utilizador($r->params['id']);
            exigir_sobre($u, $alvo->perfil);
            $d = validar_utilizador($r->body, $alvo->id);
            exigir_sobre($u, $d->perfil);
            if ($alvo->id === $u->id && $d->perfil !== $alvo->perfil) erro(422, 'Não pode mudar o seu próprio perfil.');
            if ($alvo->perfil === 'admin' && $d->perfil !== 'admin' && !empty($alvo->ativo) && count(admins_ativos()) === 1) erro(422, 'Tem de existir sempre um administrador do sistema ativo.');
            $mud = array_filter([
                $alvo->perfil !== $d->perfil ? 'perfil: ' . PERFIL_LABEL[$alvo->perfil] . ' → ' . PERFIL_LABEL[$d->perfil] : null,
                ($alvo->email ?? '') !== $d->email ? 'email' : null,
                !empty($alvo->semAcesso) !== (bool) $d->semAcesso ? ($d->semAcesso ? 'acesso retirado' : 'acesso dado') : null,
            ]);
            if (!empty($alvo->semAcesso) && !$d->semAcesso) { $alvo->senhaHash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT); $alvo->mudarSenha = true; }
            atribuir($alvo, $d);
            $alvo->avatarIniciais = iniciais($d->nome);
            auditar($u->id, 'editar', 'utilizador', $alvo->id, $mud ? implode(', ', $mud) : null);
            return publico($alvo);
        }],
        ['PATCH', '/utilizadores/:id/estado', function ($r) {
            $u = exigir('utilizadores.gerir');
            $alvo = obter_utilizador($r->params['id']);
            exigir_sobre($u, $alvo->perfil);
            $ativo = ($r->body->ativo ?? null) === true;
            if (!$ativo) {
                if ($alvo->id === $u->id) erro(422, 'Não pode desativar a sua própria conta.');
                if ($alvo->perfil === 'admin' && count(admins_ativos()) === 1) erro(422, 'Tem de existir sempre um administrador do sistema ativo.');
                $emCurso = filtrar(Db::todos('processos'), fn($p) => ($p->mecanicoId ?? null) === $alvo->id && esta_ativo($p->estado));
                if ($emCurso) erro(422, "{$alvo->nome} tem " . count($emCurso) . ' processo(s) em curso (' . implode(', ', array_map(fn($p) => $p->numero, array_slice($emCurso, 0, 3))) . (count($emCurso) > 3 ? '…' : '') . '). Reatribua-os primeiro no quadro da Oficina.');
            }
            $alvo->ativo = $ativo;
            auditar($u->id, $ativo ? 'reativar' : 'desativar', 'utilizador', $alvo->id, $alvo->nome);
            return publico($alvo);
        }],
        ['POST', '/utilizadores/:id/senha', function ($r) {
            $u = exigir('utilizadores.gerir');
            $alvo = obter_utilizador($r->params['id']);
            exigir_sobre($u, $alvo->perfil);
            if ($alvo->id === $u->id) erro(422, 'Para mudar a sua palavra-passe, use "Alterar palavra-passe" no seu menu.');
            if (!empty($alvo->semAcesso)) erro(422, "{$alvo->nome} não tem acesso ao sistema. Para lhe dar acesso, edite a conta e indique um email.");
            $senha = senha_temporaria();
            $alvo->senhaHash = password_hash($senha, PASSWORD_DEFAULT);
            $alvo->mudarSenha = true;
            auditar($u->id, 'repor_senha', 'utilizador', $alvo->id, $alvo->nome);
            return (object) ['senhaTemporaria' => $senha];
        }],

        // ----- Auditoria -----
        ['GET', '/auditoria', function ($r) {
            exigir('auditoria.ver');
            $q = $r->query;
            $onde = [];
            $args = [];
            if (!empty($q['de'])) { $onde[] = 'data >= ?'; $args[] = iso((new DateTime("{$q['de']} 00:00:00"))->getTimestamp()); }
            if (!empty($q['ate'])) { $onde[] = 'data <= ?'; $args[] = iso((new DateTime("{$q['ate']} 23:59:59"))->getTimestamp() + 0.999); }
            if (!empty($q['utilizadorId'])) {
                if ($q['utilizadorId'] === 'sistema') $onde[] = 'utilizador_id IS NULL';
                else { $onde[] = 'utilizador_id = ?'; $args[] = $q['utilizadorId']; }
            }
            if (!empty($q['entidade'])) { $onde[] = 'entidade = ?'; $args[] = $q['entidade']; }
            if (trim($q['q'] ?? '') !== '') {
                $onde[] = "LOWER(CONCAT(acao, ' ', entidade, ' ', COALESCE(entidade_id, ''), ' ', COALESCE(detalhe, ''))) LIKE ?";
                $args[] = '%' . mb_strtolower(trim($q['q'])) . '%';
            }
            if (!Db::mysql()) $onde = array_map(fn($w) => str_replace("CONCAT(acao, ' ', entidade, ' ', COALESCE(entidade_id, ''), ' ', COALESCE(detalhe, ''))", "acao || ' ' || entidade || ' ' || COALESCE(entidade_id, '') || ' ' || COALESCE(detalhe, '')", $w), $onde);
            $sql = ' FROM ' . Db::$p . 'auditoria' . ($onde ? ' WHERE ' . implode(' AND ', $onde) : '');
            $tamanho = min(5000, max(1, (int) ($q['tamanho'] ?? 50) ?: 50));
            $pagina = max(1, (int) ($q['pagina'] ?? 1));
            $st = Db::$pdo->prepare("SELECT COUNT(*)$sql");
            $st->execute($args);
            $total = (int) $st->fetchColumn();
            $st = Db::$pdo->prepare("SELECT id, data, utilizador_id, acao, entidade, entidade_id, detalhe$sql ORDER BY seq DESC LIMIT $tamanho OFFSET " . (($pagina - 1) * $tamanho));
            $st->execute($args);
            $itens = array_map(fn($x) => (object) ['id' => $x['id'], 'data' => $x['data'], 'utilizadorId' => $x['utilizador_id'], 'acao' => $x['acao'], 'entidade' => $x['entidade'], 'entidadeId' => $x['entidade_id'], 'detalhe' => $x['detalhe']], $st->fetchAll());
            return (object) ['itens' => $itens, 'total' => $total];
        }],

        // ----- Sistema -----
        ['GET', '/sistema/estado', function () {
            exigir('sistema.admin');
            $conta = fn($c) => (int) Db::$pdo->query('SELECT COUNT(*) FROM ' . Db::$p . "documentos WHERE colecao = '$c'")->fetchColumn();
            $ontem = iso(time() - 86400);
            $st = Db::$pdo->prepare('SELECT COUNT(*) FROM ' . Db::$p . "auditoria WHERE acao = 'login_falhado' AND data >= ?");
            $st->execute([$ontem]);
            $anexos = Db::todos('anexos');
            $copias = Db::todos('copias');
            usort($copias, fn($a, $b) => strcmp($b->data, $a->data));
            return (object) [
                'versaoServidor' => 'API ' . VERSAO_API . ' · PHP ' . PHP_VERSION . ' · ' . (Db::mysql() ? 'MySQL ' . Db::$pdo->getAttribute(PDO::ATTR_SERVER_VERSION) : 'SQLite'),
                'baseDados' => (object) [
                    'processos' => $conta('processos'), 'clientes' => $conta('clientes'), 'viaturas' => $conta('viaturas'), 'mensagens' => $conta('mensagens'),
                    'eventosAuditoria' => (int) Db::$pdo->query('SELECT COUNT(*) FROM ' . Db::$p . 'auditoria')->fetchColumn(),
                ],
                'anexos' => (object) ['total' => count($anexos), 'bytes' => soma($anexos, fn($a) => $a->tamanhoBytes)],
                'limiteArmazenamentoBytes' => 200 * 1024 ** 3,
                'ultimaCopia' => $copias[0] ?? null,
                'utilizadoresAtivos' => count(filtrar(Db::todos('utilizadores'), fn($x) => !empty($x->ativo))),
                'loginsFalhados24h' => (int) $st->fetchColumn(),
            ];
        }],
        ['GET', '/sistema/copias', function () {
            exigir('sistema.admin');
            $l = Db::todos('copias');
            usort($l, fn($a, $b) => strcmp($b->data, $a->data));
            return $l;
        }],
        ['POST', '/sistema/copias', function () {
            $u = exigir('sistema.admin');
            $c = criar_copia('manual', $u->id);
            auditar($u->id, 'criar', 'copia_seguranca', $c->id);
            return $c;
        }],
        // Descarrega a cópia (o ficheiro .json.gz, já descomprimido), sem palavras-passe.
        ['GET', '/sistema/copias/:id/dados', function ($r) {
            $u = exigir('sistema.admin');
            $c = Db::obter('copias', $r->params['id']);
            $f = pasta_copias() . '/' . basename($r->params['id']) . '.json.gz';
            if (!$c || !is_file($f)) erro(404, 'Cópia não encontrada.');
            auditar($u->id, 'descarregar', 'copia_seguranca', $c->id);
            $linhas = [];
            foreach (gzfile($f) as $l) {
                $x = json_decode($l, false);
                if (($x->r->colecao ?? null) === 'utilizadores') {
                    $doc = json_decode($x->r->dados, false);
                    unset($doc->senhaHash);
                    $x->r->dados = json_texto($doc);
                }
                $linhas[] = $x;
            }
            return $linhas;
        }],

        // ----- Definições -----
        ['GET', '/configuracao', function () {
            utilizador_atual();
            return sem_id_config();
        }],
        ['PUT', '/configuracao', function ($r) {
            $u = exigir('definicoes.gerir');
            $c = configuracao();
            foreach (array_keys(get_object_vars($c)) as $k) if ($k !== 'id') unset($c->$k);
            atribuir($c, validar_configuracao($r->body));
            auditar($u->id, 'atualizar', 'configuracao');
            return sem_id_config();
        }],

        // ----- Site público -----
        ['GET', '/site', function () {
            $s = copia(conteudo_site());
            unset($s->id);
            return $s;
        }],
        ['PUT', '/site', function ($r) {
            $u = exigir('site.gerir');
            $s = conteudo_site();
            foreach (array_keys(get_object_vars($s)) as $k) if ($k !== 'id') unset($s->$k);
            atribuir($s, validar_conteudo_site($r->body));
            $s->atualizadoEm = agora();
            $s->atualizadoPorId = $u->id;
            auditar($u->id, 'editar', 'site');
            $c = copia($s);
            unset($c->id);
            return $c;
        }],
        ['POST', '/site/pedidos', function ($r) {
            $b = $r->body;
            if (!empty($b->site)) return (object) ['recebido' => true];
            $telefone = texto($b->telefone ?? null, 'Telefone', 9, 30);
            if (strlen(so_digitos($telefone)) < 9) erro(422, 'Telefone: indique pelo menos 9 dígitos.');
            limitar('pedido-ip:' . ip(), 5, 3600, 'Já recebemos os seus pedidos. Vamos contactá-lo em breve.');
            limitar('pedido-tel:' . so_digitos($telefone), 3, 3600, 'Já recebemos os seus pedidos. Vamos contactá-lo em breve.');
            if (($b->consentimento ?? null) !== true) erro(422, 'Confirme que aceita ser contactado sobre este pedido.');
            $email = mb_strtolower(trim(str($b->email ?? '')));
            if ($email && !preg_match(EMAIL_VALIDO, $email)) erro(422, 'Email inválido.');
            $data = !empty($b->dataPreferida) ? str($b->dataPreferida) : null;
            if ($data && (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data) || $data < somar_dias_iso(dia_local(), -1))) erro(422, 'Escolha uma data a partir de hoje.');
            $p = (object) [
                'id' => novo_id('pedido', 'ps'), 'data' => agora(), 'nome' => texto($b->nome ?? null, 'Nome', 3, 80), 'telefone' => $telefone,
                'email' => $email ?: null, 'modelo' => opcional($b->modelo ?? null, 60),
                'matricula' => mb_substr(preg_replace('/[^A-Z0-9-]/', '', mb_strtoupper(str($b->matricula ?? ''))), 0, 12) ?: null,
                'servico' => texto($b->servico ?? null, 'Serviço', 2, 60), 'dataPreferida' => $data,
                'mensagem' => opcional($b->mensagem ?? null, 1000), 'estado' => 'novo',
            ];
            Db::inserir('pedidos', $p);
            notificar(['perfis' => ['rececionista']], 'Novo pedido no site', "{$p->nome} · {$p->servico}" . ($p->modelo ? " · {$p->modelo}" : ''), '/comunicacoes');
            auditar(null, 'pedido_site', 'pedido', $p->id, "{$p->nome} · {$p->servico}");
            return (object) ['recebido' => true];
        }],
        ['GET', '/site/pedidos', function () {
            exigir('mensagens.enviar');
            $l = Db::todos('pedidos');
            usort($l, fn($a, $b) => strcmp($b->data, $a->data));
            return $l;
        }],
        ['PATCH', '/site/pedidos/:id', function ($r) {
            $u = exigir('mensagens.enviar');
            $p = Db::obter('pedidos', $r->params['id']) ?? erro(404, 'Pedido não encontrado.');
            $estado = um_de($r->body->estado ?? $p->estado, ['novo', 'contactado', 'marcado', 'arquivado'], 'Estado');
            $marcacaoId = !empty($r->body->marcacaoId) ? str($r->body->marcacaoId) : ($p->marcacaoId ?? null);
            if ($marcacaoId && !Db::obter('marcacoes', $marcacaoId)) erro(422, 'Marcação não encontrada.');
            $p->estado = $estado;
            if ($marcacaoId) $p->marcacaoId = $marcacaoId;
            if (property_exists($r->body ?? new stdClass(), 'notas')) {
                $n = opcional($r->body->notas, 500);
                if ($n) $p->notas = $n; else unset($p->notas);
            }
            $p->tratadoPorId = $u->id;
            $p->tratadoEm = agora();
            auditar($u->id, 'tratar', 'pedido', $p->id, $estado);
            return $p;
        }],
    ];
}
