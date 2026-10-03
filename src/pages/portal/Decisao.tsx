import { useState } from 'react';
import { useDecisaoPortal } from '../../api/hooks';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { Checkbox, Field, Input, Textarea } from '../../components/ui/Form';
import { Aviso } from '../../components/ui/Controls';
import { mensagemErro } from '../../lib/erros';
import { formatAOA } from '../../lib/format';

/** Confirmação da decisão do cliente: nome, aceitação expressa (aprovar) ou motivo (recusar). */
export default function Decisao({
  token, decisao, adicionalId, total, condicoes, nomeCliente, onFechar,
}: {
  token: string;
  decisao: 'aprovado' | 'recusado';
  adicionalId?: string;
  total: number;
  condicoes?: string;
  nomeCliente: string;
  onFechar: () => void;
}) {
  const decidir = useDecisaoPortal(token);
  const [nome, setNome] = useState(nomeCliente);
  const [aceito, setAceito] = useState(false);
  const [motivo, setMotivo] = useState('');
  const aprovar = decisao === 'aprovado';
  const oQue = adicionalId ? 'o trabalho adicional' : 'o orçamento';
  const pronto = nome.trim().length >= 3 && (aprovar ? aceito : adicionalId ? true : motivo.trim().length >= 3);

  return (
    <Modal
      open
      onClose={onFechar}
      title={aprovar ? `Aprovar ${oQue}` : `Não aprovar ${oQue}`}
      footer={
        <>
          <Button variante="fantasma" onClick={onFechar}>Voltar</Button>
          <Button
            variante={aprovar ? 'primario' : 'perigo'}
            disabled={!pronto}
            carregando={decidir.isPending}
            onClick={() => decidir.mutate({ decisao, nome: nome.trim(), aceito: aprovar ? aceito : undefined, motivo: motivo.trim() || undefined, adicionalId }, { onSuccess: onFechar })}
          >
            {aprovar ? 'Confirmar aprovação' : 'Confirmar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {decidir.error && <Aviso tom="vermelho">{mensagemErro(decidir.error)}</Aviso>}
        <Field label="O seu nome" hint="Fica registado como a pessoa que decidiu.">
          {(a) => <Input {...a} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />}
        </Field>
        {aprovar ? (
          <Checkbox checked={aceito} onChange={setAceito}>
            Li e aceito {oQue} no valor de <strong className="num">{formatAOA(total)}</strong> (IVA incluído)
            {condicoes ? <>, com as condições: {condicoes}</> : null}.
          </Checkbox>
        ) : (
          <>
            <Field label={adicionalId ? 'Motivo (opcional)' : 'Porque não quer avançar?'} hint="Ajuda-nos a perceber e a melhorar.">
              {(a) => <Textarea {...a} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />}
            </Field>
            <Aviso tom="neutro">
              {adicionalId
                ? 'A reparação continua só com o que já tinha aprovado.'
                : 'O processo fica encerrado e a viatura não é reparada. Vamos contactá-lo para combinar o levantamento.'}
            </Aviso>
          </>
        )}
      </div>
    </Modal>
  );
}
