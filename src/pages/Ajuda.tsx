import { Card } from '../components/ui/Card';
import { HelpCircle, Phone, Mail } from 'lucide-react';

export default function Ajuda() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-mzd-black">Ajuda / Suporte</h1>
        <p className="text-sm text-mzd-gray">Precisa de apoio a usar o sistema de gestão de oficina?</p>
      </div>
      <Card className="p-6">
        <HelpCircle size={28} className="text-mzd-red" />
        <h2 className="mt-3 text-lg font-bold text-mzd-black">Fale com a equipa de suporte MZD</h2>
        <p className="mt-1 text-sm text-mzd-gray">Disponível de segunda a sábado, 08h–18h.</p>
        <div className="mt-4 space-y-2 text-sm">
          <p className="flex items-center gap-2 text-mzd-black"><Phone size={14} /> +244 923 000 000</p>
          <p className="flex items-center gap-2 text-mzd-black"><Mail size={14} /> suporte@mzdcarros.ao</p>
        </div>
      </Card>
    </div>
  );
}
