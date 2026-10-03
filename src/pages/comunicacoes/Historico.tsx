import { useState } from 'react';
import type { CanalMensagem, Mensagem } from '../../types';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { SearchInput, Segmented } from '../../components/ui/Controls';
import { Vazio } from '../../components/ui/Estados';
import ListaMensagens from '../../components/comunicacoes/ListaMensagens';

const PAGINA = 40;
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Historico({ mensagens }: { mensagens: Mensagem[] }) {
  const [canal, setCanal] = useState<CanalMensagem | 'todos'>('todos');
  const [direcao, setDirecao] = useState<'todas' | 'saida' | 'entrada'>('todas');
  const [pesquisa, setPesquisa] = useState('');
  const [limite, setLimite] = useState(PAGINA);

  const t = normalizar(pesquisa.trim());
  const filtradas = mensagens.filter((m) =>
    (canal === 'todos' || m.canal === canal)
    && (direcao === 'todas' || m.direcao === direcao)
    && (!t || normalizar(`${m.nome} ${m.destino} ${m.texto} ${m.assunto ?? ''}`).includes(t)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={pesquisa} onChange={(v) => { setPesquisa(v); setLimite(PAGINA); }} placeholder="Cliente, telefone ou texto…" label="Pesquisar mensagens" />
        <Segmented label="Canal" value={canal} onChange={setCanal} opcoes={[{ valor: 'todos', label: 'Todos' }, { valor: 'whatsapp', label: 'WhatsApp' }, { valor: 'email', label: 'Email' }]} />
        <Segmented label="Sentido" value={direcao} onChange={setDirecao} opcoes={[{ valor: 'todas', label: 'Todas' }, { valor: 'saida', label: 'Enviadas' }, { valor: 'entrada', label: 'Respostas' }]} />
        <span className="num ml-auto text-xs text-mzd-gray">{filtradas.length} mensagem(ns)</span>
      </div>
      <Card>
        {filtradas.length === 0 ? (
          <Vazio titulo="Sem mensagens">{mensagens.length ? 'Nenhuma mensagem corresponde aos filtros.' : 'As mensagens enviadas aos clientes ficam registadas aqui.'}</Vazio>
        ) : (
          <ListaMensagens mensagens={filtradas.slice(0, limite)} mostrarCliente />
        )}
      </Card>
      {filtradas.length > limite && (
        <div className="flex justify-center">
          <Button variante="secundario" onClick={() => setLimite((l) => l + PAGINA)}>Mostrar mais ({filtradas.length - limite})</Button>
        </div>
      )}
    </div>
  );
}
