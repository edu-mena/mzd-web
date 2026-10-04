// Conteúdo inicial do site público (o administrador edita tudo em "Site").
// As fotografias de origem externa têm licença livre (Wikimedia Commons) e o crédito vai com cada uma.

import type { ConteudoSite } from '../types';

/** Fotografias incluídas no site, com a licença de cada uma (página de créditos). */
export const CREDITOS_FOTOGRAFIAS: { ficheiro: string; titulo: string; autor: string; licenca: string; licencaUrl: string; origem: string }[] = [
  {
    "ficheiro": "/site/hero.jpg",
    "titulo": "Desert Driving.jpg",
    "autor": "Darvin.wilson",
    "licenca": "CC BY-SA 4.0",
    "licencaUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "origem": "https://commons.wikimedia.org/wiki/File:Desert_Driving.jpg"
  },
  {
    "ficheiro": "/site/modelo-pajero.jpg",
    "titulo": "Mitsubishi Pajero NX @ Brookfield Conservation Park 20240523-102455.jpg",
    "autor": "RegionVisitor90",
    "licenca": "CC0",
    "licencaUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "origem": "https://commons.wikimedia.org/wiki/File:Mitsubishi_Pajero_NX_@_Brookfield_Conservation_Park_20240523-102455.jpg"
  },
  {
    "ficheiro": "/site/modelo-pajero-sport.jpg",
    "titulo": "2020 Mitsubishi Pajero Sport Dakar 4x2 2.4 KR1W (20211007) 01.jpg",
    "autor": "オーバードライブ83",
    "licenca": "CC BY-SA 4.0",
    "licencaUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "origem": "https://commons.wikimedia.org/wiki/File:2020_Mitsubishi_Pajero_Sport_Dakar_4x2_2.4_KR1W_(20211007)_01.jpg"
  },
  {
    "ficheiro": "/site/modelo-l200.jpg",
    "titulo": "2019 Mitsubishi L200 Katana CR.jpg",
    "autor": "RL GNZLZ",
    "licenca": "CC BY-SA 2.0",
    "licencaUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "origem": "https://commons.wikimedia.org/wiki/File:2019_Mitsubishi_L200_Katana_CR.jpg"
  },
  {
    "ficheiro": "/site/modelo-outlander.jpg",
    "titulo": "2022 Mitsubishi Outlander.jpg",
    "autor": "MercurySable99",
    "licenca": "CC BY-SA 4.0",
    "licencaUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "origem": "https://commons.wikimedia.org/wiki/File:2022_Mitsubishi_Outlander.jpg"
  },
  {
    "ficheiro": "/site/modelo-asx.jpg",
    "titulo": "2020 Mitsubishi ASX Exceed 2.0 Front.jpg",
    "autor": "Vauxford",
    "licenca": "CC BY-SA 4.0",
    "licencaUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "origem": "https://commons.wikimedia.org/wiki/File:2020_Mitsubishi_ASX_Exceed_2.0_Front.jpg"
  },
  {
    "ficheiro": "/site/modelo-eclipse-cross.jpg",
    "titulo": "Mitsubishi Eclipse Cross PHEV 1X7A6477.jpg",
    "autor": "Alexander Migl",
    "licenca": "CC BY-SA 4.0",
    "licencaUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "origem": "https://commons.wikimedia.org/wiki/File:Mitsubishi_Eclipse_Cross_PHEV_1X7A6477.jpg"
  },
  {
    "ficheiro": "/site/servico-diagnostico.jpg",
    "titulo": "Man holding Obd2 jack for car software diagnostic.jpg",
    "autor": "Nenad Stojkovic",
    "licenca": "CC BY 2.0",
    "licencaUrl": "https://creativecommons.org/licenses/by/2.0",
    "origem": "https://commons.wikimedia.org/wiki/File:Man_holding_Obd2_jack_for_car_software_diagnostic.jpg"
  },
  {
    "ficheiro": "/site/servico-revisao.jpg",
    "titulo": "The Mechanic (Unsplash).jpg",
    "autor": "Tim Mossholder timmossholder",
    "licenca": "CC0",
    "licencaUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "origem": "https://commons.wikimedia.org/wiki/File:The_Mechanic_(Unsplash).jpg"
  },
  {
    "ficheiro": "/site/servico-travoes.jpg",
    "titulo": "Alarm bells! (25681917701).jpg",
    "autor": "Riley from Christchurch, New Zealand",
    "licenca": "CC BY 2.0",
    "licencaUrl": "https://creativecommons.org/licenses/by/2.0",
    "origem": "https://commons.wikimedia.org/wiki/File:Alarm_bells!_(25681917701).jpg"
  },
  {
    "ficheiro": "/site/servico-motor.jpg",
    "titulo": "Automotive service centers.jpg",
    "autor": "Chad Kirchoff",
    "licenca": "CC0",
    "licencaUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "origem": "https://commons.wikimedia.org/wiki/File:Automotive_service_centers.jpg"
  },
  {
    "ficheiro": "/site/servico-mecanica.jpg",
    "titulo": "Car repair in an auto shop with tools and equipment present on the floor and a partially disassembled vehicle on a lift.jpg",
    "autor": "Shixart1985",
    "licenca": "CC BY 2.0",
    "licencaUrl": "https://creativecommons.org/licenses/by/2.0",
    "origem": "https://commons.wikimedia.org/wiki/File:Car_repair_in_an_auto_shop_with_tools_and_equipment_present_on_the_floor_and_a_partially_disassembled_vehicle_on_a_lift.jpg"
  },
  {
    "ficheiro": "/site/servico-4x4.jpg",
    "titulo": "Mitsubishi Pajero in off-roading.jpg",
    "autor": "Biso",
    "licenca": "CC BY 3.0",
    "licencaUrl": "https://creativecommons.org/licenses/by/3.0",
    "origem": "https://commons.wikimedia.org/wiki/File:Mitsubishi_Pajero_in_off-roading.jpg"
  },
  {
    "ficheiro": "/site/galeria-oficina.jpg",
    "titulo": "Car Restoration Workshop (Unsplash).jpg",
    "autor": "Igor Ovsyannykov igorovsyannykov",
    "licenca": "CC0",
    "licencaUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "origem": "https://commons.wikimedia.org/wiki/File:Car_Restoration_Workshop_(Unsplash).jpg"
  },
  {
    "ficheiro": "/site/galeria-bancada.jpg",
    "titulo": "Car mechanic's workbench (Unsplash).jpg",
    "autor": "AJ Yorio lightninghorse",
    "licenca": "CC0",
    "licencaUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "origem": "https://commons.wikimedia.org/wiki/File:Car_mechanic%27s_workbench_(Unsplash).jpg"
  },
  {
    "ficheiro": "/site/galeria-dunas.jpg",
    "titulo": "Desert Dunes in RAK.jpg",
    "autor": "Darvin.wilson",
    "licenca": "CC BY-SA 4.0",
    "licencaUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "origem": "https://commons.wikimedia.org/wiki/File:Desert_Dunes_in_RAK.jpg"
  },
  {
    "ficheiro": "/site/galeria-triton.jpg",
    "titulo": "The frontview of Mitsubishi TRITON in Asia Cross Country Rally 2022.jpg",
    "autor": "Tokumeigakarinoaoshima",
    "licenca": "CC0",
    "licencaUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "origem": "https://commons.wikimedia.org/wiki/File:The_frontview_of_Mitsubishi_TRITON_in_Asia_Cross_Country_Rally_2022.jpg"
  },
  {
    "ficheiro": "/site/galeria-pajero-classico.jpg",
    "titulo": "1986 Mitsubishi Pajero (NC) Superwagon wagon (2015-05-29) 02.jpg",
    "autor": "OSX",
    "licenca": "Public domain",
    "licencaUrl": "",
    "origem": "https://commons.wikimedia.org/wiki/File:1986_Mitsubishi_Pajero_(NC)_Superwagon_wagon_(2015-05-29)_02.jpg"
  },
  {
    "ficheiro": "/site/galeria-pajero-sport.jpg",
    "titulo": "2020 Mitsubishi Pajero Sport (Vietnam; facelift) front view 01.png",
    "autor": "Tuyền Mitsubishi",
    "licenca": "CC BY 3.0",
    "licencaUrl": "https://creativecommons.org/licenses/by/3.0",
    "origem": "https://commons.wikimedia.org/wiki/File:2020_Mitsubishi_Pajero_Sport_(Vietnam;_facelift)_front_view_01.png"
  }
];

export const CONTEUDO_SITE_PADRAO: ConteudoSite = {
  hero: {
    titulo: 'Especialistas em Mitsubishi.',
    subtitulo: "Diagnóstico eletrónico, mecânica e tração 4x4 para Pajero, Pajero Sport, L200 e toda a gama. Só reparamos depois de aprovar o orçamento — e acompanha cada etapa pelo telemóvel.",
    imagem: { url: '/site/hero.jpg', alt: "Mitsubishi Pajero nas dunas, com os faróis acesos", credito: "Darvin.wilson · CC BY-SA 4.0 · Wikimedia Commons · adaptada (fundo retocado)" },
  },
  destaques: [
    { titulo: "Orçamento antes de tudo", texto: "Recebe o diagnóstico e o orçamento por escrito e decide. Nada é feito sem a sua aprovação." },
    { titulo: "Acompanhamento online", texto: "Um link pessoal mostra em que etapa está a viatura, com fotografias do que encontrámos." },
    { titulo: "Peças certas para Mitsubishi", texto: "Peças adequadas a cada modelo e motor, com garantia escrita nas peças e na mão de obra." },
  ],
  modelos: [
    { id: "pajero", nome: "Pajero", descricao: "O todo-o-terreno de referência. Super Select 4WD, suspensão e travões preparados para estrada e picada.", imagem: { url: '/site/modelo-pajero.jpg', alt: "Mitsubishi Pajero branco", credito: "RegionVisitor90 · CC0 · Wikimedia Commons" } },
    { id: "pajero-sport", nome: "Pajero Sport", descricao: "Motores diesel 2.4 e 2.5, caixa automática e tração integral: revisões e diagnóstico completos.", imagem: { url: '/site/modelo-pajero-sport.jpg', alt: "Mitsubishi Pajero Sport branco", credito: "オーバードライブ83 · CC BY-SA 4.0 · Wikimedia Commons" } },
    { id: "l200", nome: "L200 / Triton", descricao: "A pick-up de trabalho: embraiagem, caixa de transferência, suspensão traseira e injeção diesel.", imagem: { url: '/site/modelo-l200.jpg', alt: "Mitsubishi L200 cinzenta", credito: "RL GNZLZ · CC BY-SA 2.0 · Wikimedia Commons" } },
    { id: "outlander", nome: "Outlander", descricao: "Revisões, ar condicionado, sistemas eletrónicos e travagem — incluindo versões híbridas.", imagem: { url: '/site/modelo-outlander.jpg', alt: "Mitsubishi Outlander branco", credito: "MercurySable99 · CC BY-SA 4.0 · Wikimedia Commons" } },
    { id: "asx", nome: "ASX", descricao: "Manutenção do dia a dia, diagnóstico de avarias e afinação para a cidade.", imagem: { url: '/site/modelo-asx.jpg', alt: "Mitsubishi ASX prateado", credito: "Vauxford · CC BY-SA 4.0 · Wikimedia Commons" } },
    { id: "eclipse-cross", nome: "Eclipse Cross", descricao: "Eletrónica, sensores e assistência à condução, com equipamento de diagnóstico atualizado.", imagem: { url: '/site/modelo-eclipse-cross.jpg', alt: "Mitsubishi Eclipse Cross azul", credito: "Alexander Migl · CC BY-SA 4.0 · Wikimedia Commons" } },
  ],
  servicos: [
    { id: "diagnostico", titulo: "Diagnóstico eletrónico", descricao: "Leitura de avarias, testes aos sensores e relatório com fotografias, antes de qualquer orçamento.", imagem: { url: '/site/servico-diagnostico.jpg', alt: "Técnico a ligar o equipamento de diagnóstico", credito: "Nenad Stojkovic · CC BY 2.0 · Wikimedia Commons" } },
    { id: "revisao", titulo: "Revisões e manutenção", descricao: "Óleo, filtros, correias e líquidos nos intervalos certos para o seu motor.", imagem: { url: '/site/servico-revisao.jpg', alt: "Mudança de óleo do motor", credito: "Tim Mossholder timmossholder · CC0 · Wikimedia Commons" } },
    { id: "travoes", titulo: "Travões e suspensão", descricao: "Pastilhas, discos, amortecedores e alinhamento, com verificação de segurança no fim.", imagem: { url: '/site/servico-travoes.jpg', alt: "Disco e pinça de travão", credito: "Riley from Christchurch, New Zealand · CC BY 2.0 · Wikimedia Commons" } },
    { id: "motor", titulo: "Motor e transmissão", descricao: "Injeção diesel, embraiagem, caixa e distribuição, com peças adequadas a cada modelo.", imagem: { url: '/site/servico-motor.jpg', alt: "Correias e polias de um motor", credito: "Chad Kirchoff · CC0 · Wikimedia Commons" } },
    { id: "4x4", titulo: "Tração 4x4", descricao: "Super Select, caixa de transferência, diferenciais e bloqueios — testados em carga.", imagem: { url: '/site/servico-4x4.jpg', alt: "Mitsubishi Pajero na lama", credito: "Biso · CC BY 3.0 · Wikimedia Commons" } },
    { id: "mecanica", titulo: "Mecânica geral", descricao: "Tudo o resto que a viatura precisa, com o mesmo cuidado e o mesmo orçamento prévio.", imagem: { url: '/site/servico-mecanica.jpg', alt: "Viatura em reparação na oficina", credito: "Shixart1985 · CC BY 2.0 · Wikimedia Commons" } },
  ],
  galeria: [
    { id: "oficina", ...{ url: '/site/galeria-oficina.jpg', alt: "Mecânico a trabalhar numa viatura na oficina", credito: "Igor Ovsyannykov igorovsyannykov · CC0 · Wikimedia Commons" } },
    { id: "dunas", ...{ url: '/site/galeria-dunas.jpg', alt: "Pajero nas dunas ao fim da tarde", credito: "Darvin.wilson · CC BY-SA 4.0 · Wikimedia Commons" } },
    { id: "triton", ...{ url: '/site/galeria-triton.jpg', alt: "Mitsubishi Triton preparada para rali", credito: "Tokumeigakarinoaoshima · CC0 · Wikimedia Commons" } },
    { id: "bancada", ...{ url: '/site/galeria-bancada.jpg', alt: "Bancada de ferramentas da oficina", credito: "AJ Yorio lightninghorse · CC0 · Wikimedia Commons" } },
    { id: "pajero-sport", ...{ url: '/site/galeria-pajero-sport.jpg', alt: "Mitsubishi Pajero Sport castanho", credito: "Tuyền Mitsubishi · CC BY 3.0 · Wikimedia Commons" } },
    { id: "classico", ...{ url: '/site/galeria-pajero-classico.jpg', alt: "Mitsubishi Pajero clássico de 1986", credito: "OSX · Public domain · Wikimedia Commons" } },
  ],
  testemunhos: [],
  contactos: {
    telefone: '+244 923 000 000',
    whatsapp: '+244 923 000 000',
    email: 'geral@mzdcarros.ao',
    morada: 'Luanda, Angola',
    horario: 'Segunda a sexta, 07h30–18h · Sábado, 07h30–13h',
    mapaUrl: '',
  },
  seo: {
    titulo: 'MZD Carros e Motores — Especialistas em Mitsubishi em Luanda',
    descricao: "Oficina especializada em Mitsubishi: diagnóstico eletrónico, revisões, travões, suspensão, motor e 4x4. Orçamento aprovado antes da reparação e acompanhamento online.",
  },
};

export const AVISO_MARCA = 'A MZD Carros e Motores é uma oficina independente. Mitsubishi e os nomes dos modelos são marcas da Mitsubishi Motors Corporation.';
