import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = join(process.cwd(), "public");

const sessions = new Map();
const subscribers = new Map();

const roomCards = [
  {
    id: "SALA_001",
    name: "Calabouco Sangrento",
    subtitle: "Pressao moderada",
    theme: "forest",
    setup: { common: 2, brutal: 1 },
    objective: "Derrote todos os inimigos.",
    rule: "O primeiro heroi que sofrer dano de inimigo em cada rodada sofre +1 de dano adicional.",
    reward: "",
    effect: "firstEnemyDamageBonus"
  },
  {
    id: "SALA_002",
    name: "Corredor dos Ossos",
    subtitle: "Muitos inimigos fracos",
    theme: "crypt",
    setup: { common: 3, brutal: 0 },
    objective: "Derrote todos os inimigos.",
    rule: "Enquanto houver 3 ou mais inimigos vivos, todos os Inimigos Comuns causam +1 de dano.",
    reward: "",
    effect: "commonBonusAtThreeEnemies"
  },
  {
    id: "SALA_003",
    name: "Camara do Carrasco",
    subtitle: "Dois brutais na linha de frente",
    theme: "crypt",
    setup: { common: 1, brutal: 2 },
    objective: "Derrote todos os inimigos.",
    rule: "Inimigos Brutais causam +1 de dano contra herois sem Escudo.",
    reward: "",
    effect: "brutalBonusVsNoShield"
  },
  {
    id: "SALA_004",
    name: "Ponte Quebrada",
    subtitle: "Queda iminente",
    theme: "forest",
    setup: { common: 2, brutal: 2 },
    objective: "Derrote todos os inimigos.",
    rule: "No final de cada rodada, se houver 2 ou mais inimigos vivos, todos os herois sofrem 1 de dano.",
    reward: "",
    effect: "endRoundDamageIfTwoEnemies"
  },
  {
    id: "SALA_005",
    name: "Cripta dos Sussurros",
    subtitle: "Inicio sufocante",
    theme: "crypt",
    setup: { common: 1, brutal: 1 },
    objective: "Derrote todos os inimigos.",
    rule: "Na primeira rodada desta sala, cada heroi comeca com -1 de Energia.",
    reward: "",
    effect: "firstRoomRoundEnergyPenalty"
  },
  {
    id: "SALA_006",
    name: "Salao das Correntes",
    subtitle: "Armadilha dominante",
    theme: "crypt",
    setup: { common: 2, brutal: 1 },
    objective: "Derrote todos os inimigos.",
    rule: "Enquanto a Armadilha estiver ativa, herois nao podem comprar cartas extras usando Energia.",
    reward: "",
    effect: "noDangerDrawWhileTrap"
  },
  {
    id: "SALA_007",
    name: "Fornalha Abandonada",
    subtitle: "Calor constante",
    theme: "crypt",
    setup: { common: 4, brutal: 0 },
    objective: "Derrote todos os inimigos.",
    rule: "No final de cada rodada, o heroi com menos Vida sofre 1 de dano.",
    reward: "",
    effect: "endRoundLowestLifeDamage"
  },
  {
    id: "SALA_008",
    name: "Portao dos Condenados",
    subtitle: "Mini-chefe",
    theme: "sanctum",
    setup: { common: 0, brutal: 1 },
    objective: "Derrote todos os inimigos.",
    rule: "O Inimigo Brutal desta sala recebe +3 de Vida maxima e atual.",
    reward: "",
    effect: "brutalLifeBonus"
  },
  {
    id: "SALA_009",
    name: "Patio Profanado",
    subtitle: "Ordem invertida",
    theme: "forest",
    setup: { common: 3, brutal: 1 },
    objective: "Derrote todos os inimigos.",
    rule: "Na fase inimiga, resolva os Inimigos Brutais antes dos Inimigos Comuns.",
    reward: "",
    effect: "brutalsFirst"
  },
  {
    id: "SALA_010",
    name: "Camara do Ritual",
    subtitle: "Ritual de pressao",
    theme: "sanctum",
    setup: { common: 2, brutal: 1 },
    objective: "Derrote todos os inimigos.",
    rule: "No inicio de cada rodada, todos sofrem 1 de dano no prototipo.",
    reward: "",
    effect: "ritualStartDamage"
  }
];

const trapCards = [
  { id: "TRAP_001", name: "Espinhos no Piso", text: "No final de cada turno da dungeon, todos os herois sofrem 1 de dano.", effect: "endDungeonAllDamage" },
  { id: "TRAP_002", name: "Fome Arcana", text: "No inicio da rodada, herois compram 0 cartas.", effect: "drawTwo" },
  { id: "TRAP_003", name: "Selo Anticura", text: "Herois nao podem ser curados enquanto esta armadilha estiver ativa.", effect: "noHealing" },
  { id: "TRAP_004", name: "Dreno de Vigor", text: "No inicio da rodada, cada heroi comeca com -1 de Energia.", effect: "energyPenalty" },
  { id: "TRAP_005", name: "Neblina Cortante", text: "Ataques dos herois causam -1 de dano.", effect: "heroAttackPenalty" },
  { id: "TRAP_006", name: "Alarme de Ossos", text: "Inimigos Comuns causam +1 de dano.", effect: "commonAttackBonus" },
  { id: "TRAP_007", name: "Marca do Carrasco", text: "Inimigos Brutais causam +1 de dano.", effect: "brutalAttackBonus" },
  { id: "TRAP_008", name: "Muralha Runica", text: "Inimigos entram com +2 de Escudo.", effect: "enemyShieldBonus" },
  { id: "TRAP_009", name: "Carne Recombinada", text: "Inimigos Comuns entram com +3 de Vida.", effect: "commonLifeBonus" },
  { id: "TRAP_010", name: "Juramento Sombrio", text: "Inimigos Brutais entram com +4 de Vida.", effect: "brutalLifeTrapBonus" },
  { id: "TRAP_011", name: "Punho Invisivel", text: "O primeiro dano de inimigo em cada rodada causa +1 de dano.", effect: "firstEnemyDamageBonus" },
  { id: "TRAP_012", name: "Ferrugem Subita", text: "No inicio da rodada, cada heroi perde 1 de Escudo.", effect: "shieldDecay" },
  { id: "TRAP_013", name: "Pergaminho Selado", text: "Cartas que comprariam cartas extras nao compram.", effect: "noExtraDraw" },
  { id: "TRAP_014", name: "Furia Ecoante", text: "Enquanto houver 3 ou mais inimigos vivos, todos os inimigos causam +1 de dano.", effect: "allAttackBonusAtThreeEnemies" },
  { id: "TRAP_015", name: "Fosso Aberto", text: "No final da rodada, o heroi com menos Vida sofre 1 de dano.", effect: "endRoundLowestLifeDamage" },
  { id: "TRAP_016", name: "Pacto Sangrento", text: "Sempre que um heroi derrotar um inimigo, esse heroi sofre 1 de dano.", effect: "damageOnKill" },
  { id: "TRAP_017", name: "Eco de Dor", text: "Sempre que um heroi sofrer dano de inimigo, outro heroi com menos Vida sofre 1 de dano.", effect: "splashLowestLife" },
  { id: "TRAP_018", name: "Vento Desorientador", text: "Na fase inimiga, Inimigos Brutais resolvem antes dos Comuns.", effect: "brutalsFirst" },
  { id: "TRAP_019", name: "Correntes no Deck", text: "No inicio da rodada, cada heroi descarta 1 carta da mao antes de comprar.", effect: "discardBeforeDraw" },
  { id: "TRAP_020", name: "Relogio da Ruina", text: "No final de cada turno da dungeon, se houver 2 ou mais inimigos vivos, todos sofrem 1 de dano.", effect: "endDungeonDamageIfTwoEnemies" }
];

function makeStatusEffects() {
  return {
    veneno: 0,
    queimadura: { value: 0, duration: 0 },
    vacuo: false,
    enfraquecido: 0,
    exposto: false
  };
}

const monsterTemplates = {
  sentinela: {
    id: "sentinela",
    name: "Sentinela Oco",
    category: "common",
    role: "Tanque",
    maxLife: 24,
    attack: 4,
    shield: 2,
    icon: "blade",
    keywords: []
  },
  salteador: {
    id: "salteador",
    name: "Salteador Cinzento",
    category: "common",
    role: "Atacante",
    maxLife: 18,
    attack: 5,
    shield: 0,
    icon: "fang",
    keywords: []
  },
  bruxa: {
    id: "bruxa",
    name: "Bruxa do Breu",
    category: "common",
    role: "Suporte (ofensivo)",
    maxLife: 20,
    attack: 2,
    shield: 3,
    icon: "moon",
    keywords: ["Peçonhenta"]
  },
  carcereiro: {
    id: "carcereiro",
    name: "Carcereiro Ferrugem",
    category: "common",
    role: "Tanque",
    maxLife: 28,
    attack: 4,
    shield: 3,
    icon: "stone",
    keywords: []
  },
  mistico: {
    id: "mistico",
    name: "Místico Penumbra",
    category: "common",
    role: "Suporte (cura)",
    maxLife: 16,
    attack: 1,
    shield: 1,
    icon: "star",
    keywords: ["Curandeira"],
    curandeiraValue: 3
  },
  arauto: {
    id: "arauto",
    name: "Arauto Cinza",
    category: "common",
    role: "Suporte (escudo)",
    maxLife: 18,
    attack: 2,
    shield: 2,
    icon: "shield",
    keywords: ["Guardiã"],
    guardiaValue: 2
  },
  colosso: {
    id: "colosso",
    name: "Colosso das Cinzas",
    category: "brutal",
    role: "Tanque/Bruto",
    maxLife: 48,
    attack: 7,
    shield: 5,
    icon: "stone",
    keywords: []
  },
  executor: {
    id: "executor",
    name: "Executor Sombrio",
    category: "brutal",
    role: "Atacante",
    maxLife: 40,
    attack: 8,
    shield: 3,
    icon: "blade",
    keywords: ["Sanguinária"]
  },
  basilisco: {
    id: "basilisco",
    name: "Basilisco Azul",
    category: "brutal",
    role: "Controlador",
    maxLife: 36,
    attack: 6,
    shield: 7,
    icon: "moon",
    keywords: ["Paralisante"]
  }
};


const intentionCards = [
  {
    id: "INT_001",
    name: "Caçada ao Sangue",
    presagioText: "Revele a próxima carta do baralho de Armadilhas (sem ativá-la). O grupo vê o que está por vir.",
    commonText: "Comuns atacam o herói com menos Vida atual.",
    brutalText: "Brutais atacam o herói com menos Vida atual.",
    represaliaText: "Se algum herói foi derrotado esta rodada, invoque 1 Inimigo Comum imediatamente.",
    commonTarget: "minLife",
    brutalTarget: "minLife"
  },
  {
    id: "INT_002",
    name: "Pressão Crescente",
    presagioText: "O Inimigo Brutal recebe +2 de Vida máxima e atual imediatamente.",
    commonText: "Comuns atacam o herói com mais Vida atual.",
    brutalText: "Brutais atacam o herói com menos Escudo atual.",
    represaliaText: "Se o Brutal ainda estiver vivo ao fim da rodada, ele ganha Enfurecido permanentemente.",
    commonTarget: "maxLife",
    brutalTarget: "minShield"
  },
  {
    id: "INT_003",
    name: "Fúria Coordenada",
    presagioText: "Todos os inimigos em jogo ganham +1 de dano nesta rodada.",
    commonText: "Comuns atacam o herói com mais cartas na mão.",
    brutalText: "Brutais atacam o herói que causou mais dano nesta rodada.",
    represaliaText: "Se nenhum inimigo foi derrotado nesta rodada, todos os heróis descartam 1 carta aleatoriamente.",
    commonTarget: "maxHand",
    brutalTarget: "maxDamageDealt"
  },
  {
    id: "INT_004",
    name: "Instinto Predatório",
    presagioText: "Cada herói com 0 de Escudo sofre 1 de dano imediatamente.",
    commonText: "Comuns atacam o herói com menos Escudo atual.",
    brutalText: "Brutais atacam o herói com menos Vida atual.",
    represaliaText: "Se nenhum herói possui Escudo ao fim da rodada, todos sofrem 1 de dano adicional.",
    commonTarget: "minShield",
    brutalTarget: "minLife"
  },
  {
    id: "INT_005",
    name: "Coração Fraco",
    presagioText: "O herói com menos Vida perde 1 de Energia nesta rodada (mínimo 1).",
    commonText: "Comuns atacam o herói com menos Vida atual.",
    brutalText: "Brutais atacam o herói com menos Vida atual.",
    represaliaText: "Se o herói com menos Vida terminar a rodada abaixo de 5 pontos, ele sofre 2 de dano adicional.",
    commonTarget: "minLife",
    brutalTarget: "minLife"
  },
  {
    id: "INT_006",
    name: "Cerco Implacável",
    presagioText: "Cada Inimigo Comum em jogo ganha +1 de Escudo imediatamente.",
    commonText: "Comuns atacam o herói com menos Vida atual.",
    brutalText: "Brutais atacam o herói com mais Escudo atual.",
    represaliaText: "Se restarem 2 ou mais inimigos vivos ao fim da rodada, todos os heróis sofrem 1 de dano.",
    commonTarget: "minLife",
    brutalTarget: "maxShield"
  },
  {
    id: "INT_007",
    name: "Retaliação",
    presagioText: "O Inimigo Brutal não pode ser alvo de Reações nesta rodada.",
    commonText: "Comuns atacam o herói que causou mais dano nesta rodada.",
    brutalText: "Brutais atacam o herói que derrotou mais inimigos nesta rodada.",
    represaliaText: "Se o Brutal sobreviveu a esta rodada, ele ganha +1 de dano permanentemente.",
    commonTarget: "maxDamageDealt",
    brutalTarget: "maxEnemiesDefeated"
  },
  {
    id: "INT_008",
    name: "Golpe nos Fortes",
    presagioText: "O herói com mais Escudo atual perde metade do seu Escudo (arredondado para baixo).",
    commonText: "Comuns atacam o herói com mais Vida atual.",
    brutalText: "Brutais atacam o herói com mais Vida atual.",
    represaliaText: "Se o herói com mais Vida não recebeu nenhum Escudo nesta rodada, ele sofre 2 de dano adicional.",
    commonTarget: "maxLife",
    brutalTarget: "maxLife"
  },
  {
    id: "INT_009",
    name: "Pavor das Sombras",
    presagioText: "Na próxima fase de compra desta sala, cada herói não comprará nenhuma carta.",
    commonText: "Comuns atacam o herói com menos cartas na mão.",
    brutalText: "Brutais atacam o herói com menos Energia atual.",
    represaliaText: "Se algum herói terminar a rodada com 0 cartas na mão, ele sofre 2 de dano.",
    commonTarget: "minHand",
    brutalTarget: "minEnergy"
  },
  {
    id: "INT_010",
    name: "Oportunismo",
    presagioText: "Se houver uma Armadilha ativa, ela aplica seu efeito uma vez adicional agora.",
    commonText: "Comuns atacam o herói com menos Escudo atual.",
    brutalText: "Brutais atacam o herói com menos Vida atual.",
    represaliaText: "Se a Armadilha ainda estiver ativa ao fim da rodada, todos os heróis sofrem 1 de dano.",
    commonTarget: "minShield",
    brutalTarget: "minLife"
  },
  {
    id: "INT_011",
    name: "Avanço Pesado",
    presagioText: "Todos os Inimigos Comuns em jogo ganham +2 de Vida máxima e atual.",
    commonText: "Comuns atacam o herói com mais Escudo atual.",
    brutalText: "Brutais atacam o herói com mais Vida atual.",
    represaliaText: "Se restarem 2 ou mais Comuns vivos ao fim da rodada, o Brutal realiza 1 ataque adicional de 2 de dano fixo no herói com menos Vida.",
    commonTarget: "maxShield",
    brutalTarget: "maxLife"
  },
  {
    id: "INT_012",
    name: "Caçada ao Preparado",
    presagioText: "O herói com mais cartas na mão deve descartar 1 carta agora (à sua escolha).",
    commonText: "Comuns atacam o herói com mais cartas na mão.",
    brutalText: "Brutais atacam o herói com mais Energia no início desta rodada.",
    represaliaText: "Se algum herói gastou menos de 2 de Energia nesta rodada, ele sofre 1 de dano.",
    commonTarget: "maxHand",
    brutalTarget: "maxEnergyAtStartOfRound"
  },
  {
    id: "INT_013",
    name: "Execução Coordenada",
    presagioText: "Todos os Inimigos Comuns ganham Veloz nesta rodada (atacam antes do Brutal).",
    commonText: "Comuns atacam o herói com menos Escudo atual.",
    brutalText: "Brutais atacam o herói que sofreu mais dano nesta rodada.",
    represaliaText: "Se o herói com menos Escudo terminar a rodada com menos de 8 de Vida, ele sofre 2 de dano adicional.",
    commonTarget: "minShield",
    brutalTarget: "maxDamageTaken"
  },
  {
    id: "INT_014",
    name: "Ruptura do Ritmo",
    presagioText: "O herói com mais Escudo transfere metade do seu Escudo (arredondado para baixo) para o herói com menos Vida.",
    commonText: "Comuns atacam o herói que jogou mais cartas nesta rodada.",
    brutalText: "Brutais atacam o herói que jogou menos cartas nesta rodada.",
    represaliaText: "Se algum herói não jogou nenhuma carta de Ataque nesta rodada, ele sofre 2 de dano.",
    commonTarget: "maxCardsPlayed",
    brutalTarget: "minCardsPlayed"
  },
  {
    id: "INT_015",
    name: "Sangue e Cura",
    presagioText: "O herói com mais Vida atual perde 2 pontos de Vida (ignora Escudo, não pode matar).",
    commonText: "Comuns atacam o herói que recebeu mais cura nesta rodada.",
    brutalText: "Brutais atacam o herói com menos Vida atual.",
    represaliaText: "Se algum herói foi curado nesta rodada, ele sofre 1 de dano adicional.",
    commonTarget: "maxHealingReceived",
    brutalTarget: "minLife"
  }
];

const bossTemplates = {
  inquisidor: {
    id: "inquisidor",
    name: "O Inquisidor Esquecido",
    description: "Um servo da ordem que viu demais no abismo. Cada Escudo é uma heresia, cada cura uma fraqueza.",
    maxLife: 90,
    life: 90,
    shield: 4,
    maxShield: 4,
    attack: 10,
    attackPhase2: 13,
    category: "boss",
    role: "Chefe",
    keywords: [],
    statusEffects: makeStatusEffects()
  },
  bruxa: {
    id: "bruxa",
    name: "A Bruxa da Última Hora",
    description: "Ela não te derrota pela força. Ela espera. O relógio dela nunca para.",
    maxLife: 75,
    life: 75,
    shield: 2,
    maxShield: 2,
    attack: 8,
    attackPhase2: 11,
    category: "boss",
    role: "Chefe",
    keywords: [],
    statusEffects: makeStatusEffects()
  },
  colosso: {
    id: "colosso",
    name: "O Colosso Sanguinário",
    description: "Não há estratégia. Não há fraqueza. Apenas peso, ferro e a certeza de que ele continuará de pé.",
    maxLife: 115,
    life: 115,
    shield: 8,
    maxShield: 8,
    attack: 12,
    attackPhase2: 15,
    category: "boss",
    role: "Chefe",
    keywords: [],
    statusEffects: makeStatusEffects()
  },
  oraculo: {
    id: "oraculo",
    name: "O Oráculo Corrompido",
    description: "Ele era um curandeiro. Agora drena o seu sangue para alimentar sua própria eternidade.",
    maxLife: 80,
    life: 80,
    shield: 3,
    maxShield: 3,
    attack: 8,
    attackPhase2: 11,
    category: "boss",
    role: "Chefe",
    keywords: [],
    statusEffects: makeStatusEffects()
  }
};

const bossIntentionCards = {
  inquisidor: [
    {
      id: "BOSSINQ-001",
      name: "Julgamento dos Escudos",
      presagioText: "O herói com mais Escudo atual perde todo o seu Escudo imediatamente.",
      commonText: "Inimigos atacam o herói com mais Vida.",
      represaliaText: "Se algum herói recebeu Escudo esta rodada, Inquisidor causa 4 de dano fixo no herói que recebeu mais Escudo.",
      commonTarget: "maxLife"
    },
    {
      id: "BOSSINQ-002",
      name: "Sentença de Morte",
      presagioText: "O Inquisidor não pode ser alvo de Reações nesta rodada.",
      commonText: "Inimigos atacam o herói com menos Vida.",
      represaliaText: "Se o herói com menos Vida terminar a rodada abaixo de 8 de Vida, sofre 3 de dano adicional (ignora Escudo).",
      commonTarget: "minLife"
    },
    {
      id: "BOSSINQ-003",
      name: "Absolvição Perversa",
      presagioText: "O Inquisidor recupera 6 de Vida (10 se estiver na Fase 2).",
      commonText: "Inimigos atacam o herói com menos Escudo.",
      represaliaText: "Se o grupo causou menos de 12 de dano total ao Inquisidor nesta rodada, todos os heróis sofrem 2 de dano.",
      commonTarget: "minShield"
    },
    {
      id: "BOSSINQ-004",
      name: "Veredicto Final",
      presagioText: "Todos os heróis que possuem Escudo sofrem 2 de dano (ignora Escudo).",
      commonText: "Inimigos atacam o herói que jogou mais cartas DEFENSE (ou com mais Vida).",
      represaliaText: "Se o Inquisidor está na Fase 2, seu próximo ataque causa +4 de dano fixo.",
      commonTarget: "maxCardsDefensePlayed"
    }
  ],
  bruxa: [
    {
      id: "BOSSBRT-001",
      name: "Maldição Acelerada",
      presagioText: "O contador da Maldição perde 1 ponto adicional (2 na Fase 2).",
      commonText: "Inimigos atacam o herói com mais cartas na mão.",
      represaliaText: "Se o contador atingiu 0 nesta rodada, a Bruxa recupera 8 de Vida imediatamente.",
      commonTarget: "maxHand"
    },
    {
      id: "BOSSBRT-002",
      name: "Distorção",
      presagioText: "O herói com mais cartas na mão deve descartar 2 cartas imediatamente.",
      commonText: "Inimigos atacam o herói com menos cartas na mão.",
      represaliaText: "Se algum herói terminou com 0 cartas na mão, ele recebe Vácuo.",
      commonTarget: "minHand"
    },
    {
      id: "BOSSBRT-003",
      name: "Inversão da Maré",
      presagioText: "Todos os heróis perdem 1 de Energia imediatamente (2 na Fase 2, mínimo 1).",
      commonText: "Inimigos atacam o herói com menos Energia atual.",
      represaliaText: "Se algum herói não gastou Energia nesta rodada, sofre 3 de dano.",
      commonTarget: "minEnergy"
    },
    {
      id: "BOSSBRT-004",
      name: "Ecos do Amanhã",
      presagioText: "Revela as próximas 2 intenções da Bruxa.",
      commonText: "Inimigos atacam o herói com mais Energia atual.",
      represaliaText: "Se a Bruxa está na Fase 2 e o grupo causou menos de 10 de dano, ela recupera 5 de Vida.",
      commonTarget: "maxEnergy"
    }
  ],
  colosso: [
    {
      id: "BOSSCOL-001",
      name: "Esmagamento",
      presagioText: "O Colosso ganha 3 de Escudo imediatamente.",
      commonText: "Inimigos atacam o herói com mais Escudo.",
      represaliaText: "Se o Colosso possui 8 ou mais de Escudo, ele ataca o herói com menos Vida por 4 de dano (interceptável).",
      commonTarget: "maxShield"
    },
    {
      id: "BOSSCOL-002",
      name: "Fúria Inabalável",
      presagioText: "Colosso fica imune a atordoamento e reações de redirecionamento ou anulação.",
      commonText: "Inimigos atacam o herói com mais Vida.",
      represaliaText: "Se causou dano ao alvo, ele fica Exposto (+1 de dano de todas as fontes) até seu próximo turno.",
      commonTarget: "maxLife"
    },
    {
      id: "BOSSCOL-003",
      name: "Pisoteio",
      presagioText: "Realiza um pré-ataque de metade do ATK contra todos os heróis (pode ser interceptado).",
      commonText: "Inimigos atacam o herói com menos Escudo.",
      represaliaText: "Se nenhum herói foi derrotado nesta sala até agora, recupera 5 de Vida.",
      commonTarget: "minShield"
    },
    {
      id: "BOSSCOL-004",
      name: "Muralha Eterna",
      presagioText: "Todos os Carcereiros Ferrugem vivos recuperam 6 de Vida.",
      commonText: "Inimigos atacam o herói que causou mais dano nesta rodada.",
      represaliaText: "Se está na Fase 2 e tem Escudo, o dano da Dupla Devastação aumenta para 8 (mais 3 fixo).",
      commonTarget: "maxDamageDealt"
    }
  ],
  oraculo: [
    {
      id: "BOSSORC-001",
      name: "Drenagem Vital",
      presagioText: "O herói com mais Vida sofre 3 de dano (ignora Escudo). Oráculo cura 3.",
      commonText: "Inimigos atacam o herói com menos Vida.",
      represaliaText: "Se algum herói foi curado esta rodada e o Oráculo está na Fase 2, cura 5.",
      commonTarget: "minLife"
    },
    {
      id: "BOSSORC-002",
      name: "Contaminação Sombria",
      presagioText: "Aplica Veneno 2 a um herói aleatório.",
      commonText: "Inimigos atacam o herói com mais cartas na mão.",
      represaliaText: "Para cada herói envenenado, Oráculo cura 2 de Vida.",
      commonTarget: "maxHand"
    },
    {
      id: "BOSSORC-003",
      name: "Espelho Sombrio",
      presagioText: "Reflete de forma invertida a última carta jogada nesta rodada.",
      commonText: "Inimigos atacam o herói com menos Escudo.",
      represaliaText: "Se curou via Espelho Sombrio esta rodada, o alvo sofre 2 de dano adicional.",
      commonTarget: "minShield"
    },
    {
      id: "BOSSORC-004",
      name: "Absorção Total",
      presagioText: "Todos perdem 1 de Energia. Oráculo cura 2 por herói afetado.",
      commonText: "Inimigos atacam o herói que mais recebeu cura na partida.",
      represaliaText: "Se na Fase 2 com 25+ HP, todos os heróis recebem Enfraquecido 1.",
      commonTarget: "maxCuraTotalRecebida"
    }
  ]
};

const tormentCards = [
  { id: "TORMENTO-001", name: "Altar do Sacrifício", text: "No início de cada rodada, o herói com mais Vida sofre 3 de dano (ignora Escudo)." },
  { id: "TORMENTO-002", name: "Pulso Reativo", text: "Sempre que o Boss sofrer 8 ou mais de dano de uma única fonte, ele ganha 3 de Escudo." },
  { id: "TORMENTO-003", name: "Marca da Escuridão", text: "No início de cada rodada, um herói aleatório recebe Vácuo." },
  { id: "TORMENTO-004", name: "Vórtice de Energia", text: "No início de cada rodada, após a restauração de Energia, cada herói perde 1 de Energia (mínimo 1)." },
  { id: "TORMENTO-005", name: "Contágio Perpétuo", text: "No início de cada rodada, o herói com menos Vida recebe Veneno 1." }
];

const heroes = {
  guardiao: {
    id: "guardiao",
    name: "Guardiao Solar",
    life: 32,
    energy: 4,
    supreme: "bastiao-supremo",
    deck: [
      ["escudo-protetor", 2],
      ["golpe-de-escudo", 2],
      ["formacao-defensiva", 2],
      ["varredura-de-escudos", 2],
      ["avanco-implacavel", 2],
      ["provocar", 2],
      ["interceptar", 2],
      ["contra-ataque", 1],
      ["muralha-viva", 1],
      ["desafio-do-guardiao", 1],
      ["ultima-resistencia", 1],
      ["inabalavel", 1],
      ["escudo-refletor", 1]
    ]
  },
  oraculo: {
    id: "oraculo",
    name: "Oraculo Lunar",
    life: 24,
    energy: 5,
    supreme: "luz-da-esperanca",
    deck: [
      ["cura-menor", 2],
      ["cura-em-massa", 2],
      ["inspiracao", 2],
      ["redistribuir-escudos", 2],
      ["planejamento", 2],
      ["luz-sagrada", 2],
      ["renovacao", 1],
      ["descanso-breve", 1],
      ["escudo-compartilhado", 1],
      ["purificar", 1],
      ["reanimar", 1],
      ["explosao-divina", 2]
    ]
  },
  batedor: {
    id: "batedor",
    name: "Batedor Verde",
    life: 28,
    energy: 4,
    supreme: "tempestade-de-flechas",
    deck: [
      ["flecha-precisa", 2],
      ["disparo-poderoso", 2],
      ["chuva-de-flechas", 2],
      ["tiro-perfurante", 2],
      ["mira-perfeita", 2],
      ["companheiro-animal", 2],
      ["flecha-explosiva", 1],
      ["disparo-rapido", 1],
      ["flecha-atordoante", 1],
      ["execucao", 1],
      ["cacada", 1],
      ["ultima-flecha", 1]
    ]
  },
  mago: {
    id: "mago",
    name: "Arcanista Vince",
    life: 26,
    energy: 6,
    supreme: "cataclismo-arcano",
    deck: [
      ["raio-arcano", 2],
      ["bola-de-fogo", 2],
      ["raio-congelante", 2],
      ["tempestade-eletrica", 2],
      ["fluxo-arcano", 2],
      ["manipular-energia", 2],
      ["prisao-de-gelo", 1],
      ["campo-antimagia", 1],
      ["teleporte-arcano", 1],
      ["explosao-de-mana", 1],
      ["eco-arcano", 1],
      ["distorcao-temporal", 1]
    ]
  }
};

const cards = {
  "escudo-protetor": {
    id: "escudo-protetor",
    name: "Escudo Protetor",
    type: "defense",
    target: "ally",
    cost: 1,
    block: 3,
    text: "Um aliado recebe 3 de Escudo."
  },
  "golpe-de-escudo": {
    id: "golpe-de-escudo",
    name: "Golpe de Escudo",
    type: "attack",
    cost: 1,
    damage: 3,
    selfBlock: 2,
    text: "Causa 3 de dano em um inimigo. Voce recebe 2 de Escudo."
  },
  "formacao-defensiva": {
    id: "formacao-defensiva",
    name: "Formacao Defensiva",
    type: "defense",
    cost: 2,
    allBlock: 2,
    text: "Todos os aliados recebem 2 de Escudo."
  },
  "varredura-de-escudos": {
    id: "varredura-de-escudos",
    name: "Varredura de Escudos",
    type: "attack",
    cost: 2,
    areaDamage: 2,
    text: "Causa 2 de dano em todos os inimigos."
  },
  "avanco-implacavel": {
    id: "avanco-implacavel",
    name: "Avanco Implacavel",
    type: "attack",
    cost: 2,
    damage: 5,
    ignoreShield: true,
    text: "Causa 5 de dano em um inimigo, ignorando Escudo."
  },
  provocar: {
    id: "provocar",
    name: "Provocar",
    type: "control",
    target: "ally",
    cost: 1,
    provoke: true,
    text: "Escolha um aliado. Ate o inicio do seu proximo turno, todo dano que ele receber seria causado a voce."
  },
  interceptar: {
    id: "interceptar",
    name: "Interceptar",
    type: "reaction",
    cost: 0,
    intercept: true,
    text: "Reacao. Quando um aliado sofreria dano, anule esse dano e voce sofre esse dano."
  },
  "contra-ataque": {
    id: "contra-ataque",
    name: "Contra-Ataque",
    type: "reaction",
    cost: 1,
    reflect: 2,
    text: "Reacao. Voce ganha Refletir 2 ate o inicio do proximo turno."
  },
  "muralha-viva": {
    id: "muralha-viva",
    name: "Muralha Viva",
    type: "defense",
    cost: 2,
    block: 6,
    draw: 1,
    text: "Voce recebe 6 de Escudo e compra 1 carta."
  },
  "desafio-do-guardiao": {
    id: "desafio-do-guardiao",
    name: "Desafio do Guardiao",
    type: "control",
    target: "enemy",
    cost: 1,
    enemyChallenge: true,
    text: "Escolha um inimigo. Ele so pode atacar voce ate o fim da rodada."
  },
  "ultima-resistencia": {
    id: "ultima-resistencia",
    name: "Ultima Resistencia",
    type: "heal",
    cost: 2,
    heal: 6,
    block: 6,
    lowLifeMax: 10,
    text: "Pre-requisito: 10 de Vida ou menos. Voce cura 6 e recebe 6 de Escudo."
  },
  inabalavel: {
    id: "inabalavel",
    name: "Inabalavel",
    type: "defense",
    cost: 2,
    reduceDamage: 2,
    text: "Todo dano recebido por voce e reduzido em 2 ate o inicio do proximo turno."
  },
  "escudo-refletor": {
    id: "escudo-refletor",
    name: "Escudo Refletor",
    type: "defense",
    target: "ally",
    cost: 1,
    block: 4,
    reflect: 1,
    text: "Um aliado recebe 4 de Escudo e Refletir 1 enquanto possuir esse Escudo."
  },
  "golpe-radiante": {
    id: "golpe-radiante",
    name: "Golpe Radiante",
    type: "attack",
    cost: 1,
    damage: 5,
    text: "Causa 5 de dano ao monstro."
  },
  "raio-lunar": {
    id: "raio-lunar",
    name: "Raio Lunar",
    type: "attack",
    cost: 2,
    damage: 8,
    text: "Causa 8 de dano ao monstro."
  },
  investida: {
    id: "investida",
    name: "Investida",
    type: "attack",
    cost: 1,
    damage: 4,
    text: "Causa 4 de dano ao monstro."
  },
  "flecha-dupla": {
    id: "flecha-dupla",
    name: "Flecha Dupla",
    type: "attack",
    cost: 2,
    damage: 7,
    text: "Causa 7 de dano ao monstro."
  },
  "pulso-arcano": {
    id: "pulso-arcano",
    name: "Pulso Arcano",
    type: "attack",
    cost: 1,
    damage: 3,
    text: "Causa 3 de dano ao monstro."
  },
  "escudo-de-luz": {
    id: "escudo-de-luz",
    name: "Escudo de Luz",
    type: "defense",
    cost: 1,
    block: 4,
    text: "Ganha 4 de escudo nesta rodada."
  },
  "cura-breve": {
    id: "cura-breve",
    name: "Cura Breve",
    type: "heal",
    cost: 1,
    heal: 4,
    text: "Cura 4 de vida de um heroi."
  },
  foco: {
    id: "foco",
    name: "Foco",
    type: "energy",
    cost: 0,
    energy: 1,
    text: "Ganha 1 de energia nesta rodada."
  },
  premonicao: {
    id: "premonicao",
    name: "Premonicao",
    type: "draw",
    cost: 1,
    draw: 1,
    text: "Compra 1 carta extra."
  },
  "selo-fragil": {
    id: "selo-fragil",
    name: "Selo Fragil",
    type: "attack",
    cost: 1,
    damage: 2,
    text: "Causa 2 de dano ao monstro."
  },
  armadilha: {
    id: "armadilha",
    name: "Armadilha",
    type: "defense",
    cost: 1,
    block: 3,
    text: "Ganha 3 de escudo nesta rodada."
  },
  "sombra-rapida": {
    id: "sombra-rapida",
    name: "Sombra Rapida",
    type: "attack",
    cost: 0,
    damage: 2,
    text: "Causa 2 de dano ao monstro."
  },
  "cura-menor": {
    id: "cura-menor",
    name: "Cura Menor",
    type: "heal",
    target: "ally",
    cost: 1,
    heal: 3,
    text: "Cura 3 de vida de um aliado."
  },
  "cura-em-massa": {
    id: "cura-em-massa",
    name: "Cura em Massa",
    type: "heal",
    cost: 2,
    allHeal: 2,
    text: "Todos os aliados recebem Cura 2."
  },
  "inspiracao": {
    id: "inspiracao",
    name: "Inspiracao",
    type: "energy",
    target: "ally",
    cost: 2,
    energy: 2,
    text: "Um aliado recupera 2 de Energia."
  },
  "redistribuir-escudos": {
    id: "redistribuir-escudos",
    name: "Redistribuir Escudos",
    type: "control",
    cost: 1,
    moveShield: true,
    text: "Mova qualquer quantidade de Escudo de um aliado para outro."
  },
  "planejamento": {
    id: "planejamento",
    name: "Planejamento",
    type: "draw",
    target: "ally",
    cost: 1,
    planning: true,
    text: "Um aliado compra 2 cartas e depois descarta 1 carta."
  },
  "luz-sagrada": {
    id: "luz-sagrada",
    name: "Luz Sagrada",
    type: "attack",
    cost: 1,
    damage: 3,
    text: "Cause 3 de dano a um inimigo."
  },
  "renovacao": {
    id: "renovacao",
    name: "Renovacao",
    type: "heal",
    target: "ally",
    cost: 3,
    heal: 6,
    text: "Cura 6 de vida de um aliado."
  },
  "descanso-breve": {
    id: "descanso-breve",
    name: "Descanso Breve",
    type: "energy",
    cost: 2,
    allEnergy: 1,
    text: "Todos os aliados recuperam 1 de Energia."
  },
  "escudo-compartilhado": {
    id: "escudo-compartilhado",
    name: "Escudo Compartilhado",
    type: "control",
    cost: 2,
    shareShields: true,
    text: "Redistribua livremente todos os Escudos existentes entre os herois."
  },
  "purificar": {
    id: "purificar",
    name: "Purificar",
    type: "control",
    cost: 5,
    removeTrap: true,
    text: "Remova a armadilha ativa. Todos os herois da mesa devem escolher e descartar 1 carta."
  },
  "reanimar": {
    id: "reanimar",
    name: "reanimar",
    type: "heal",
    target: "ally",
    cost: 4,
    revive: 5,
    text: "Reviva um aliado derrotado com 5 de Vida."
  },
  "explosao-divina": {
    id: "explosao-divina",
    name: "Explosao Divina",
    type: "attack",
    cost: 2,
    areaDamage: 2,
    text: "Causa 2 de dano em todos os inimigos."
  },
  "luz-da-esperanca": {
    id: "luz-da-esperanca",
    name: "Luz da Esperanca",
    type: "heal",
    cost: 0,
    supremeEffects: true,
    text: "Suprema. Todos os aliados recebem Cura 5, Escudo 5, Energia +2 e Compra 1."
  },
  "flecha-precisa": {
    id: "flecha-precisa",
    name: "Flecha Precisa",
    type: "attack",
    cost: 1,
    damage: 4,
    text: "Cause 4 de dano a um inimigo."
  },
  "disparo-poderoso": {
    id: "disparo-poderoso",
    name: "Disparo Poderoso",
    type: "attack",
    cost: 3,
    damage: 7,
    text: "Cause 7 de dano a um inimigo."
  },
  "chuva-de-flechas": {
    id: "chuva-de-flechas",
    name: "Chuva de Flechas",
    type: "attack",
    cost: 2,
    areaDamage: 2,
    text: "Cause 2 de dano em todos os inimigos."
  },
  "tiro-perfurante": {
    id: "tiro-perfurante",
    name: "Tiro Perfurante",
    type: "attack",
    cost: 3,
    damage: 5,
    ignoreShield: true,
    text: "Cause 5 de dano, ignorando Escudo."
  },
  "mira-perfeita": {
    id: "mira-perfeita",
    name: "Mira Perfeita",
    type: "draw",
    cost: 1,
    draw: 2,
    planning: true,
    text: "Compre 2 cartas e depois descarte 1."
  },
  "companheiro-animal": {
    id: "companheiro-animal",
    name: "Companheiro Animal",
    type: "permanent",
    cost: 2,
    nextAttackBonus: 2,
    text: "Na proxima carta de ataque que voce jogar nesta rodada, cause +2 de dano."
  },
  "flecha-explosiva": {
    id: "flecha-explosiva",
    name: "Flecha Explosiva",
    type: "attack",
    cost: 2,
    text: "Cause 4 de dano a um inimigo. Depois cause 2 de dano em todos os outros inimigos."
  },
  "disparo-rapido": {
    id: "disparo-rapido",
    name: "Disparo Rapido",
    type: "energy",
    cost: 1,
    energy: 1,
    draw: 1,
    text: "Recupere 1 de Energia. Compre 1 carta."
  },
  "flecha-atordoante": {
    id: "flecha-atordoante",
    name: "Flecha Atordoante",
    type: "attack",
    cost: 2,
    damage: 4,
    stun: true,
    text: "Causa 4 de dano. O alvo nao ataca nesta rodada."
  },
  "execucao": {
    id: "execucao",
    name: "Execucao",
    type: "attack",
    cost: 4,
    text: "Derrote imediatamente um Inimigo Comum. Contra Brutais, cause 5 de dano."
  },
  "cacada": {
    id: "cacada",
    name: "Cacada",
    type: "draw",
    cost: 1,
    text: "Se um inimigo foi derrotado nesta rodada, compre 2 cartas. Se nao, compre 1."
  },
  "ultima-flecha": {
    id: "ultima-flecha",
    name: "Ultima Flecha",
    type: "attack",
    cost: 3,
    damage: 10,
    text: "Causa 10 de dano. Depois descarte toda sua mao."
  },
  "tempestade-de-flechas": {
    id: "tempestade-de-flechas",
    name: "Tempestade de Flechas",
    type: "attack",
    cost: 0,
    text: "Suprema. Cause 6 de dano em todos os inimigos. Depois cause 8 de dano a um inimigo."
  },
  "bastiao-supremo": {
    id: "bastiao-supremo",
    name: "Bastiao Supremo",
    type: "defense",
    cost: 0,
    text: "Suprema. Todo dano aos aliados e redirecionado a voce, e todo dano recebido por voce e reduzido pela metade ate o inicio do seu proximo turno. Receba 8 de Escudo."
  },
  "raio-arcano": {
    id: "raio-arcano",
    name: "Raio Arcano",
    type: "attack",
    cost: 2,
    damage: 5,
    text: "Cause 5 de dano a um inimigo."
  },
  "bola-de-fogo": {
    id: "bola-de-fogo",
    name: "Bola de Fogo",
    type: "attack",
    cost: 3,
    areaDamage: 3,
    text: "Cause 3 de dano em todos os inimigos."
  },
  "raio-congelante": {
    id: "raio-congelante",
    name: "Raio Congelante",
    type: "attack",
    cost: 3,
    damage: 4,
    stun: true,
    text: "Cause 4 de dano. O alvo nao ataca nesta rodada."
  },
  "tempestade-eletrica": {
    id: "tempestade-eletrica",
    name: "Tempestade Eletrica",
    type: "attack",
    cost: 3,
    text: "Cause 6 de dano. Depois cause 2 de dano em outro inimigo."
  },
  "fluxo-arcano": {
    id: "fluxo-arcano",
    name: "Fluxo Arcano",
    type: "energy",
    target: "ally",
    cost: 2,
    energy: 2,
    text: "Um aliado recupera 2 de Energia."
  },
  "manipular-energia": {
    id: "manipular-energia",
    name: "Manipular Energia",
    type: "control",
    cost: 2,
    text: "Transfira ate 2 de Energia de um aliado para outro."
  },
  "prisao-de-gelo": {
    id: "prisao-de-gelo",
    name: "Prisao de Gelo",
    type: "attack",
    cost: 4,
    target: "brutal",
    stun: true,
    text: "Escolha um Inimigo Brutal. Ele nao pode atacar durante esta rodada."
  },
  "campo-antimagia": {
    id: "campo-antimagia",
    name: "Campo Antimagia",
    type: "control",
    cost: 3,
    disableTrap: 2,
    text: "Desative uma Armadilha por 2 rodadas. Depois ela volta normalmente."
  },
  "teleporte-arcano": {
    id: "teleporte-arcano",
    name: "Teleporte Arcano",
    type: "control",
    target: "ally",
    cost: 2,
    text: "Escolha um aliado. Ele recupera 1 Energia e compra 1 carta."
  },
  "explosao-de-mana": {
    id: "explosao-de-mana",
    name: "Explosao de Mana",
    type: "attack",
    cost: 4,
    damage: 8,
    ignoreShield: true,
    text: "Cause 8 de dano, ignorando Escudo."
  },
  "eco-arcano": {
    id: "eco-arcano",
    name: "Eco Arcano",
    type: "control",
    cost: 3,
    text: "Escolha uma carta que voce jogou nesta rodada. Resolva novamente seus efeitos. (Nao copia Cartas Supremas.)"
  },
  "distorcao-temporal": {
    id: "distorcao-temporal",
    name: "Distorcao Temporal",
    type: "control",
    target: "ally",
    cost: 4,
    text: "Escolha um aliado. Ele pode jogar imediatamente uma carta de custo 2 ou menos sem gastar Energia."
  },
  "cataclismo-arcano": {
    id: "cataclismo-arcano",
    name: "Cataclismo Arcano",
    type: "attack",
    cost: 0,
    text: "Suprema. Cause 6 de dano em todos os inimigos. Todos os aliados recuperam 2 de Energia. Desative todas as Armadilhas ate o fim da rodada. O Inimigo Brutal nao pode atacar nesta rodada."
  }
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return sessions.has(code) ? makeCode() : code;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeRoundStats() {
  return {
    damageDealt: 0,
    enemiesDefeated: 0,
    energySpent: 0,
    cardsPlayed: 0,
    attackCardsPlayed: 0,
    healingReceived: 0,
    damageTaken: 0,
    shieldReceived: 0
  };
}

function makeDeck(heroId) {
  return shuffle(
    heroes[heroId].deck.flatMap(([cardId, amount]) =>
      Array.from({ length: amount }, () => ({
        uid: randomUUID(),
        heroId,
        ...cards[cardId]
      }))
    )
  );
}

function makeEnemyDeck(category) {
  return shuffle(
    Object.values(monsterTemplates)
      .filter((monster) => monster.category === category)
      .map((monster) => monster.id)
  );
}

function createSession() {
  const id = makeCode();
  const roomDeck = shuffle(roomCards);
  const room = roomDeck.shift();
  const session = {
    id,
    status: "lobby",
    turn: "players",
    dungeonResolved: false,
    createdAt: Date.now(),
    round: 0,
    roomRound: 0,
    roomRewardClaimed: false,
    firstEnemyDamageApplied: false,
    players: [],
    arena: [],
    roomDeck,
    roomDiscard: [],
    room,
    enemies: [],
    commonEnemyDeck: makeEnemyDeck("common"),
    commonEnemyDiscard: [],
    brutalEnemyDeck: makeEnemyDeck("brutal"),
    brutalEnemyDiscard: [],
    trapDeck: shuffle(trapCards),
    trapDiscard: [],
    activeTrap: null,
    intentionDeck: shuffle(intentionCards),
    intentionDiscard: [],
    activeIntention: null,
    dungeonQueue: [],
    pendingReaction: null,
    visualEvents: [],
    log: ["Sala criada."]
  };
  sessions.set(id, session);
  subscribers.set(id, new Set());
  return session;
}

function pushVisualEvent(session, event) {
  session.visualEvents.push({
    id: randomUUID(),
    createdAt: Date.now(),
    ...event
  });
  session.visualEvents = session.visualEvents.slice(-60);
}

function drawFromDeck(session, deckName, discardName, fallbackItems) {
  if (session[deckName].length === 0) {
    session[deckName] = shuffle(session[discardName].length ? session[discardName] : fallbackItems);
    session[discardName] = [];
  }
  return session[deckName].shift();
}

function getUnlockedRoom(monsterId) {
  switch (monsterId) {
    case "sentinela":
    case "salteador":
    case "carcereiro":
    case "colosso":
      return 1;
    case "bruxa":
    case "executor":
    case "basilisco":
      return 2;
    case "mistico":
    case "arauto":
      return 3;
    default:
      return 1;
  }
}

function drawEnemyId(session, category) {
  const roomNum = session.roomNumber || 1;
  const unlocked = Object.values(monsterTemplates).filter(
    (m) => m.category === category && getUnlockedRoom(m.id) <= roomNum
  );
  if (unlocked.length === 0) return category === "common" ? "sentinela" : "colosso";
  const chosen = unlocked[Math.floor(Math.random() * unlocked.length)];
  return chosen.id;
}

function drawTrap(session) {
  if (session.trapDeck.length === 0) {
    session.trapDeck = shuffle(session.trapDiscard.length ? session.trapDiscard : trapCards);
    session.trapDiscard = [];
  }
  if (session.activeTrap) session.trapDiscard.push(session.activeTrap);
  session.activeTrap = session.trapDeck.shift() || trapCards[0];
  session.log.unshift(`Armadilha revelada: ${session.activeTrap.name}.`);
}

function createEnemy(session, templateId) {
  const template = monsterTemplates[templateId];
  const lifeBonus =
    (session.room.effect === "brutalLifeBonus" && template.category === "brutal" ? 3 : 0) +
    (session.activeTrap?.effect === "commonLifeBonus" && template.category === "common" ? 3 : 0) +
    (session.activeTrap?.effect === "brutalLifeTrapBonus" && template.category === "brutal" ? 4 : 0);
  const shieldBonus = session.activeTrap?.effect === "enemyShieldBonus" ? 2 : 0;

  const roomNum = session.roomNumber || 1;
  const threatLevel = Math.max(0, roomNum - 1);
  let attackMod = 0;
  let lifeMod = 0;
  if (threatLevel === 1) {
    attackMod = 2;
    lifeMod = template.category === "common" ? 4 : 6;
  } else if (threatLevel >= 2) {
    attackMod = 4;
    lifeMod = template.category === "common" ? 8 : 12;
  }

  const finalLife = template.maxLife + lifeMod + lifeBonus;
  const finalAttack = template.attack + attackMod;

  return {
    uid: randomUUID(),
    ...template,
    maxLife: finalLife,
    life: finalLife,
    shield: template.shield + shieldBonus,
    maxShield: template.shield + shieldBonus,
    attack: finalAttack,
    statusEffects: makeStatusEffects()
  };
}

function spawnMinion(session, templateId) {
  const originalRoomNumber = session.roomNumber;
  session.roomNumber = 3; // force threat level 2 scaling (+4 ATK, +8 Life)
  const minion = createEnemy(session, templateId);
  session.roomNumber = originalRoomNumber; // restore
  session.enemies.push(minion);
  session.log.unshift(`Invocacao: ${minion.name} entra em campo.`);
  pushVisualEvent(session, { type: "summon", targetType: "enemy", targetId: minion.uid, source: "Invocacao" });
}

function createEnemiesForRoom(session) {
  const enemies = [];
  const roomNum = session.roomNumber || 1;

  const unlockedCommons = Object.values(monsterTemplates).filter(
    (m) => m.category === "common" && getUnlockedRoom(m.id) <= roomNum
  );
  const unlockedBrutals = Object.values(monsterTemplates).filter(
    (m) => m.category === "brutal" && getUnlockedRoom(m.id) <= roomNum
  );

  const newlyUnlockedCommons = unlockedCommons.filter((m) => getUnlockedRoom(m.id) === roomNum);
  const newlyUnlockedBrutals = unlockedBrutals.filter((m) => getUnlockedRoom(m.id) === roomNum);

  const setup = session.room.setup;

  const hasNewCommons = newlyUnlockedCommons.length > 0 && setup.common > 0;
  const hasNewBrutals = newlyUnlockedBrutals.length > 0 && setup.brutal > 0;

  let commonIdsToSpawn = [];
  let brutalIdsToSpawn = [];

  if (roomNum >= 2 && (hasNewCommons || hasNewBrutals)) {
    const pickCommonAsPriority = hasNewCommons && (!hasNewBrutals || Math.random() < 0.5);

    if (pickCommonAsPriority) {
      const chosenCommon = newlyUnlockedCommons[Math.floor(Math.random() * newlyUnlockedCommons.length)];
      commonIdsToSpawn.push(chosenCommon.id);
    } else if (hasNewBrutals) {
      const chosenBrutal = newlyUnlockedBrutals[Math.floor(Math.random() * newlyUnlockedBrutals.length)];
      brutalIdsToSpawn.push(chosenBrutal.id);
    }
  }

  while (commonIdsToSpawn.length < setup.common) {
    if (unlockedCommons.length === 0) break;
    const chosen = unlockedCommons[Math.floor(Math.random() * unlockedCommons.length)];
    commonIdsToSpawn.push(chosen.id);
  }

  while (brutalIdsToSpawn.length < setup.brutal) {
    if (unlockedBrutals.length === 0) break;
    const chosen = unlockedBrutals[Math.floor(Math.random() * unlockedBrutals.length)];
    brutalIdsToSpawn.push(chosen.id);
  }

  commonIdsToSpawn = shuffle(commonIdsToSpawn);
  brutalIdsToSpawn = shuffle(brutalIdsToSpawn);

  commonIdsToSpawn.forEach((id) => {
    enemies.push(createEnemy(session, id));
  });

  brutalIdsToSpawn.forEach((id) => {
    enemies.push(createEnemy(session, id));
  });

  return enemies;
}

function drawNextRoom(session) {
  session.roomRound = 1;
  session.roomRewardClaimed = false;
  session.roomNumber = (session.roomNumber || 1) + 1;

  if (session.roomNumber === 4) {
    session.status = "boss_selection";
    const keys = ["inquisidor", "bruxa", "colosso", "oraculo"];
    const chosen = shuffle(keys).slice(0, 2);
    session.bossSelectOptions = chosen.map(key => bossTemplates[key]);
    session.log.unshift("[Sala 4] A masmorra treme... Escolham o Chefe que irão enfrentar.");
    return;
  }

  if (session.roomDeck.length === 0) {
    session.roomDeck = shuffle(session.roomDiscard.length ? session.roomDiscard : roomCards);
    session.roomDiscard = [];
  }
  if (session.room) session.roomDiscard.push(session.room);
  session.room = session.roomDeck.shift() || roomCards[0];
  drawTrap(session);
  session.enemies = createEnemiesForRoom(session);
  const roomNum = session.roomNumber;
  const threatLevel = Math.max(0, roomNum - 1);
  const attackMod = threatLevel === 1 ? "+2" : (threatLevel >= 2 ? "+4" : "+0");
  const lifeModCommon = threatLevel === 1 ? "+4" : (threatLevel >= 2 ? "+8" : "+0");
  const lifeModBrutal = threatLevel === 1 ? "+6" : (threatLevel >= 2 ? "+12" : "+0");
  session.log.unshift(`[Sala ${roomNum}] Sala revelada: ${session.room.name}. Nível de Ameaça: ${threatLevel} (Ataque: ${attackMod}, Vida Comum: ${lifeModCommon}, Vida Brutal: ${lifeModBrutal}). ${session.room.objective}`);
}

function setupCurrentRoom(session) {
  session.roomRound = 1;
  session.roomRewardClaimed = false;
  drawTrap(session);
  session.enemies = createEnemiesForRoom(session);
  const roomNum = session.roomNumber || 1;
  const threatLevel = Math.max(0, roomNum - 1);
  const attackMod = threatLevel === 1 ? "+2" : (threatLevel >= 2 ? "+4" : "+0");
  const lifeModCommon = threatLevel === 1 ? "+4" : (threatLevel >= 2 ? "+8" : "+0");
  const lifeModBrutal = threatLevel === 1 ? "+6" : (threatLevel >= 2 ? "+12" : "+0");
  session.log.unshift(`[Sala ${roomNum}] Sala revelada: ${session.room.name}. Nível de Ameaça: ${threatLevel} (Ataque: ${attackMod}, Vida Comum: ${lifeModCommon}, Vida Brutal: ${lifeModBrutal}). ${session.room.objective}`);
}

function isRoomComplete(session) {
  return session.enemies.length > 0 && session.enemies.every((enemy) => enemy.life <= 0);
}

function archiveCurrentEnemies(session) {
  session.enemies.forEach((enemy) => {
    if (enemy.category === "common") session.commonEnemyDiscard.push(enemy.id);
    if (enemy.category === "brutal") session.brutalEnemyDiscard.push(enemy.id);
  });
}

function getRoundDrawCount(session) {
  if (session.skipNextDraw) {
    return 0;
  }
  const isTrapActive = session.activeTrap && !(session.activeTrapDisabledRounds && session.activeTrapDisabledRounds > 0);
  return (isTrapActive && session.activeTrap.effect === "drawTwo") ? 0 : 1;
}

function applyStartOfRoundEffects(session) {
  session.firstEnemyDamageApplied = false;
  session.maldicao_triggered_this_round = false;

  // 1. Maldição do Relógio (A Bruxa da Última Hora)
  if (session.room?.effect === "bossRoom" && session.boss?.id === "bruxa") {
    session.maldicao_contador = (session.maldicao_contador || 5) - 1;
    session.log.unshift(`Maldicao do Relogio decrementa para ${session.maldicao_contador}.`);
    if (session.maldicao_contador === 0) {
      session.maldicao_triggered_this_round = true;
      session.log.unshift("⌛ A Maldicao do Relogio atingiu 0! Todos os herois sofrem 7 de dano.");
      session.players.forEach((p) => {
        if (p.life > 0) applyDamageToHero(session, p, 7, "Maldicao do Relogio", session.boss, { ignoreShield: true });
      });
      session.maldicao_contador = session.boss.fase_atual === 2 ? 3 : 5;
    }
  }

  // 2. Active Torment Effects
  if (session.activeTorment) {
    const tormentId = session.activeTorment.id;
    if (tormentId === "TORMENTO-001") {
      const target = selectTarget(session.players, "maxLife");
      if (target) {
        session.log.unshift(`Altar do Sacrificio: ${target.name} sofre 3 de dano (ignora Escudo).`);
        applyDamageToHero(session, target, 3, "Altar do Sacrificio", null, { ignoreShield: true });
      }
    } else if (tormentId === "TORMENTO-003") {
      const activePlayers = session.players.filter(p => p.life > 0);
      if (activePlayers.length > 0) {
        const target = activePlayers[Math.floor(Math.random() * activePlayers.length)];
        target.statusEffects.vacuo = true;
        session.log.unshift(`Marca da Escuridao: ${target.name} recebe Vacuo.`);
      }
    } else if (tormentId === "TORMENTO-004") {
      session.players.forEach(p => {
        if (p.life > 0) {
          p.energy = Math.max(1, p.energy - 1);
        }
      });
      session.log.unshift("Vortice de Energia: Cada heroi perde 1 de Energia (minimo 1).");
    } else if (tormentId === "TORMENTO-005") {
      const target = selectTarget(session.players, "minLife");
      if (target) {
        target.statusEffects.veneno = (target.statusEffects.veneno || 0) + 1;
        session.log.unshift(`Contagio Perpetuo: ${target.name} recebe Veneno 1.`);
      }
    }
  }

  // 3. Boss Invocations
  if (session.room?.effect === "bossRoom" && session.boss?.life > 0) {
    const bossId = session.boss.id;
    if (bossId === "inquisidor") {
      if (!session.nextInquisidorSummonRound) session.nextInquisidorSummonRound = 3;
      if (session.roomRound === session.nextInquisidorSummonRound) {
        spawnMinion(session, "sentinela");
        session.nextInquisidorSummonRound = session.roomRound + 3;
      }
    } else if (bossId === "bruxa" && session.boss.fase_atual === 2) {
      session.witchPhase2Rounds = (session.witchPhase2Rounds || 0) + 1;
      if (session.witchPhase2Rounds % 2 === 1) {
        const misticoAlive = session.enemies.some(e => e.id === "mistico" && e.life > 0);
        if (!misticoAlive) {
          spawnMinion(session, "mistico");
        }
      }
    } else if (bossId === "colosso") {
      if (session.roomRound === 2 || session.roomRound === 4 || session.roomRound === 6) {
        const carcereirosCount = session.enemies.filter(e => e.id === "carcereiro" && e.life > 0).length;
        if (carcereirosCount < 2) {
          spawnMinion(session, "carcereiro");
        }
      }
    } else if (bossId === "oraculo") {
      if (session.roomRound === 3 || session.roomRound === 5) {
        const misticosCount = session.enemies.filter(e => e.id === "mistico" && e.life > 0).length;
        if (misticosCount < 2) {
          spawnMinion(session, "mistico");
        }
      }
    }
  }
  if (session.room.effect === "firstRoomRoundEnergyPenalty" && session.roomRound === 1) {
    session.players.forEach((player) => {
      player.energy = Math.max(0, player.energy - 1);
    });
    session.log.unshift("Regra da sala: cada heroi comeca esta sala com -1 de Energia.");
  }
  if (session.room.effect === "ritualStartDamage") {
    session.players.forEach((player) => applyDamageToHero(session, player, 1, "Camara do Ritual"));
  }
  if (session.activeTrap?.effect === "energyPenalty") {
    session.players.forEach((player) => {
      player.energy = Math.max(0, player.energy - 1);
    });
    session.log.unshift("Armadilha: cada heroi comeca a rodada com -1 de Energia.");
  }
  if (session.activeTrap?.effect === "shieldDecay") {
    session.players.forEach((player) => {
      player.shield = Math.max(0, player.shield - 1);
    });
    session.log.unshift("Armadilha: cada heroi perde 1 de Escudo.");
  }
  if (session.activeTrap?.effect === "discardBeforeDraw") {
    session.log.unshift("Armadilha: descarte antes da compra ja foi absorvido pela limpeza da mao no prototipo.");
  }

  // Trigger Curandeira and Guardiã keywords for monsters
  session.enemies.forEach((enemy) => {
    if (enemy.life > 0 && enemy.keywords?.includes("Curandeira")) {
      const healVal = enemy.curandeiraValue || 3;
      const aliveMonsters = session.enemies.filter((m) => m.life > 0);
      const needsHealing = aliveMonsters.filter((m) => m.life < m.maxLife);
      if (needsHealing.length > 0) {
        needsHealing.sort((a, b) => a.life - b.life);
        const targetMonster = needsHealing[0];
        const before = targetMonster.life;
        targetMonster.life = Math.min(targetMonster.maxLife, targetMonster.life + healVal);
        const healed = targetMonster.life - before;
        
        if (targetMonster.statusEffects && targetMonster.statusEffects.veneno > 0) {
          targetMonster.statusEffects.veneno = 0;
          session.log.unshift(`Curandeira: ${enemy.name} curou ${targetMonster.name} e todo o seu Veneno foi removido.`);
        }
        
        if (healed > 0) {
          pushVisualEvent(session, {
            type: "heal",
            targetType: "enemy",
            targetId: targetMonster.uid,
            amount: healed,
            source: enemy.name
          });
          session.log.unshift(`Curandeira: ${enemy.name} curou ${healed} de Vida em ${targetMonster.name}.`);
        }
      }
    }

    if (enemy.life > 0 && enemy.keywords?.includes("Guardiã")) {
      const shieldVal = enemy.guardiaValue || 2;
      const aliveMonsters = session.enemies.filter((m) => m.life > 0);
      if (aliveMonsters.length > 0) {
        aliveMonsters.sort((a, b) => (a.shield || 0) - (b.shield || 0));
        const targetMonster = aliveMonsters[0];
        targetMonster.shield += shieldVal;
        pushVisualEvent(session, {
          type: "shield",
          targetType: "enemy",
          targetId: targetMonster.uid,
          amount: shieldVal,
          source: enemy.name
        });
        session.log.unshift(`Guardiã: ${enemy.name} concedeu ${shieldVal} de Escudo a ${targetMonster.name}.`);
      }
    }
  });
}

function applyDamageToHero(session, target, amount, source, sourceEnemy = null, options = {}) {
  if (!target || target.life <= 0 || amount <= 0) return 0;

  if (target.statusEffects?.exposto) {
    amount += 1;
  }

  if (!options.skipRedirect) {
    // Redirect all damage to Guardian if Bastião Supremo is active
    const guardian = session.players.find((player) => player.life > 0 && player.bastiaoSupremoActive && player.id !== target.id);
    if (guardian) {
      session.log.unshift(`Bastiao Supremo: todo o dano a ${target.name} e redirecionado para ${guardian.name}.`);
      return applyDamageToHero(session, guardian, amount, source, sourceEnemy, { skipRedirect: true });
    }

    const protector = session.players.find(
      (player) => player.life > 0 && player.protectingId === target.id && player.id !== target.id
    );
    if (protector) {
      session.log.unshift(`${protector.name} provocou o ataque e protegeu ${target.name}.`);
      target = protector;
    }

    const interceptor = session.players.find(
      (player) => player.life > 0 && player.interceptReady && player.id !== target.id
    );
    if (interceptor) {
      interceptor.interceptReady = false;
      session.log.unshift(`${interceptor.name} interceptou o dano que iria atingir ${target.name}.`);
      return applyDamageToHero(session, interceptor, amount, source, sourceEnemy, { skipRedirect: true });
    }
  }

  if (target.bastiaoSupremoActive) {
    const halved = Math.max(1, Math.ceil(amount / 2));
    session.log.unshift(`Bastiao Supremo: o dano recebido por ${target.name} foi reduzido pela metade de ${amount} para ${halved}.`);
    amount = halved;
  }

  const reduction = target.reduceDamage || 0;
  if (reduction > 0) {
    amount = Math.max(1, amount - reduction);
    session.log.unshift(`${target.name} reduziu o dano recebido em ${reduction}.`);
  }

  const isInquisidorPhase2 = sourceEnemy?.isBoss && sourceEnemy.id === "inquisidor" && sourceEnemy.fase_atual === 2;
  const shouldIgnoreShield = options.ignoreShield || isInquisidorPhase2;

  const blocked = shouldIgnoreShield ? 0 : Math.min(target.shield, amount);
  target.shield -= blocked;
  const damage = amount - blocked;
  const oldLife = target.life;
  target.life = Math.max(0, target.life - damage);
  if (oldLife > 0 && target.life === 0) {
    session.heroDefeatedThisRound = true;
    const allDefeated = session.players.every((p) => p.life <= 0);
    if (allDefeated) {
      session.status = "defeat";
      session.log.unshift("Todos os herois foram derrotados. Fim de jogo!");
    }
  }
  target.roundStats.damageTaken += damage;
  if (damage > 0) {
    pushVisualEvent(session, {
      type: "damage",
      targetType: "hero",
      targetId: target.id,
      amount: damage,
      source,
      enemyUid: sourceEnemy ? sourceEnemy.uid : null
    });
  }
  session.log.unshift(`${source} causou ${damage} de dano em ${target.name}${blocked ? ` (${blocked} bloqueado)` : ""}.${target.statusEffects?.exposto ? " (+1 por estar Exposto)" : ""}`);
  
  if (damage > 0 && sourceEnemy && sourceEnemy.life > 0 && sourceEnemy.keywords?.includes("Sanguinária")) {
    const before = sourceEnemy.life;
    sourceEnemy.life = Math.min(sourceEnemy.maxLife, sourceEnemy.life + 1);
    const healed = sourceEnemy.life - before;
    if (sourceEnemy.statusEffects && sourceEnemy.statusEffects.veneno > 0) {
      sourceEnemy.statusEffects.veneno = 0;
      session.log.unshift(`Sanguinária: ${sourceEnemy.name} curou-se e removeu todo o seu Veneno.`);
    }
    if (healed > 0) {
      pushVisualEvent(session, {
        type: "heal",
        targetType: "enemy",
        targetId: sourceEnemy.uid,
        amount: healed,
        source: "Sanguinária"
      });
      session.log.unshift(`Sanguinária: ${sourceEnemy.name} recuperou 1 de Vida.`);
    }
  }

  if (damage > 0 && target.reflectDamage > 0 && sourceEnemy?.life > 0) {
    applyDamageToEnemy(session, sourceEnemy, target.reflectDamage, `${target.name} refletiu`, false);
  }
  return damage;
}

function triggerBossTransition(session, boss) {
  session.log.unshift(`💥 [Transição] ${boss.name} cruzou 50% de Vida! Entrando na Fase 2!`);
  boss.fase_atual = 2;
  
  if (boss.id === "inquisidor") {
    // 1. Remove all shields from heroes
    session.players.forEach(p => { p.shield = 0; });
    session.log.unshift("[Transição] Inquisidor removeu todo o Escudo de todos os heróis!");
    // 2. All heroes suffer 4 damage ignoring shield
    session.players.forEach(p => {
      if (p.life > 0) applyDamageToHero(session, p, 4, "Veredicto de Transição", boss, { ignoreShield: true });
    });
    // 3. ATK goes to Phase 2 (13)
    boss.attack = 13;
    boss.isEnfurecido = true; // gains Enfurecido
  } else if (boss.id === "bruxa") {
    // 1. Clock counter immediately falls to 1
    session.maldicao_contador = 1;
    // 2. Summons 1 Bruxa do Breu + 1 Místico Penumbra
    spawnMinion(session, "bruxa");
    spawnMinion(session, "mistico");
    // 3. All heroes receive Vácuo
    session.players.forEach(p => {
      if (p.life > 0) p.statusEffects.vacuo = true;
    });
    session.log.unshift("[Transição] A Bruxa amaldiçoa todos com Vácuo e invoca seus servos!");
    // 4. ATK goes to Phase 2 (11)
    boss.attack = 11;
  } else if (boss.id === "colosso") {
    // 1. Attacks all heroes simultaneously for 8 damage (ignoring shield, cannot be intercepted)
    session.players.forEach(p => {
      if (p.life > 0) applyDamageToHero(session, p, 8, "Pisoteio Devastador (Transição)", boss, { ignoreShield: true, skipRedirect: true });
    });
    // 2. Shield goes to 0
    boss.shield = 0;
    session.log.unshift("[Transição] Colosso descarrega energia: 8 de dano a todos, zerando sua blindagem.");
    // 3. ATK goes to Phase 2 (15)
    boss.attack = 15;
  } else if (boss.id === "oraculo") {
    // 1. Oracle heals 20
    const before = boss.life;
    boss.life = Math.min(boss.maxLife, boss.life + 20);
    session.log.unshift(`[Transição] Oráculo Corrompido drena essência e recupera ${boss.life - before} de Vida.`);
    pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: boss.uid, amount: boss.life - before, source: "Transição" });
    // 2. All heroes receive Veneno 2
    session.players.forEach(p => {
      if (p.life > 0) p.statusEffects.veneno = (p.statusEffects.veneno || 0) + 2;
    });
    // 3. Summons 2 Místicos (up to cap of 2)
    const currentMisticos = session.enemies.filter(e => e.id === "mistico" && e.life > 0).length;
    const toSpawn = Math.max(0, 2 - currentMisticos);
    for (let i = 0; i < toSpawn; i++) {
      spawnMinion(session, "mistico");
    }
    // 4. ATK goes to Phase 2 (11)
    boss.attack = 11;
  }
}

function applyDamageToEnemy(session, target, amount, source, ignoreShield = false, player = null) {
  if (!target || target.life <= 0 || amount <= 0) return 0;

  if (target.statusEffects?.exposto) {
    amount += 1;
  }

  // 1. Pulso Reativo torment trigger (verify before damage resolution)
  const isPulsoReativo = session.activeTorment?.id === "TORMENTO-002";

  const shieldDamage = ignoreShield ? 0 : Math.min(target.shield, amount);
  target.shield -= shieldDamage;
  const lifeDamage = amount - shieldDamage;
  target.life = Math.max(0, target.life - lifeDamage);
  if (player) player.roundStats.damageDealt += lifeDamage;

  if (shieldDamage + lifeDamage > 0) {
    pushVisualEvent(session, {
      type: "damage",
      targetType: "enemy",
      targetId: target.uid,
      amount: shieldDamage + lifeDamage,
      source
    });
  }

  session.log.unshift(
    `${source}: ${shieldDamage} no escudo e ${lifeDamage} de dano em ${target.name}${ignoreShield ? " (ignorou Escudo)" : ""}.${target.statusEffects?.exposto ? " (+1 por estar Exposto)" : ""}`
  );

  // Pulso Reativo shield gain
  if (target.isBoss && lifeDamage >= 8 && isPulsoReativo && target.life > 0) {
    target.shield += 3;
    session.log.unshift(`Pulso Reativo: ${target.name} sofreu 8+ de dano e ganhou 3 de Escudo.`);
    pushVisualEvent(session, { type: "shield", targetType: "enemy", targetId: target.uid, amount: 3, source: "Pulso Reativo" });
  }

  // Boss Phase Transition check
  if (target.isBoss && target.life > 0 && target.life <= target.maxLife / 2 && target.fase_atual === 1 && !target.transicao_ocorrida) {
    target.transicao_ocorrida = true;
    triggerBossTransition(session, target);
  }

  if (target.life === 0) {
    if (player) player.roundStats.enemiesDefeated += 1;
    session.log.unshift(`${target.name} foi derrotado.`);
    if (target.isBoss) {
      session.enemies = session.enemies.filter(e => e.uid === target.uid); // keep only boss
      session.status = "victory";
      session.dungeonResolved = true;
      session.roomRewardClaimed = true;
      session.log.unshift(`O Chefe ${target.name} foi derrotado! Vitória da masmorra!`);
    } else {
      if (player && session.activeTrap?.effect === "damageOnKill") {
        applyDamageToHero(session, player, 1, session.activeTrap.name);
      }
      applyRoomReward(session);
    }
  }
  return lifeDamage;
}

function applyRoomReward(session) {
  if (session.roomRewardClaimed || !isRoomComplete(session)) return;
  session.roomRewardClaimed = true;
  session.log.unshift("Sala concluida!");
}

function drawIntention(session) {
  if (session.intentionDeck.length === 0) {
    session.intentionDeck = shuffle(session.intentionDiscard);
    session.intentionDiscard = [];
  }
  const card = session.intentionDeck.shift() || intentionCards[0];
  if (session.activeIntention) session.intentionDiscard.push(session.activeIntention);
  session.activeIntention = card;
  session.log.unshift(`Intencao revelada: ${card.name}.`);
}

function applyIntentionPresagio(session) {
  const card = session.activeIntention;
  if (!card) return;

  session.log.unshift(`⚡ [Presságio] Ativando Presságio de ${card.name}: ${card.presagioText}`);

  switch (card.id) {
    case "BOSSINQ-001": {
      const target = selectTarget(session.players, "maxShield");
      if (target && target.shield > 0) {
        target.shield = 0;
        session.log.unshift(`[Presságio] Julgamento dos Escudos: ${target.name} perdeu todo o seu Escudo.`);
      }
      break;
    }
    case "BOSSINQ-002": {
      session.bossReactionImmune = true;
      session.log.unshift("[Presságio] Sentença de Morte: Inquisidor imune a Reações nesta rodada.");
      break;
    }
    case "BOSSINQ-003": {
      const healAmt = session.boss.fase_atual === 2 ? 10 : 6;
      const before = session.boss.life;
      session.boss.life = Math.min(session.boss.maxLife, session.boss.life + healAmt);
      const healed = session.boss.life - before;
      if (healed > 0) {
        session.log.unshift(`[Presságio] Absolvição Perversa: Inquisidor recupera ${healed} de Vida.`);
        pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: session.boss.uid, amount: healed, source: "Absolvição Perversa" });
      }
      break;
    }
    case "BOSSINQ-004": {
      session.players.forEach(p => {
        if (p.life > 0 && p.shield > 0) {
          applyDamageToHero(session, p, 2, "Veredicto Final (Presságio)", session.boss, { ignoreShield: true });
        }
      });
      break;
    }
    case "BOSSBRT-001": {
      const pts = session.boss.fase_atual === 2 ? 2 : 1;
      session.maldicao_contador = Math.max(0, session.maldicao_contador - pts);
      session.log.unshift(`[Presságio] Maldicao Acelerada: Maldicao do Relogio perdeu ${pts} pontos adicionais (atual: ${session.maldicao_contador}).`);
      if (session.maldicao_contador === 0) {
        session.maldicao_triggered_this_round = true;
        session.log.unshift("⌛ A Maldicao do Relogio atingiu 0 via Presságio! Todos os herois sofrem 7 de dano.");
        session.players.forEach((p) => {
          if (p.life > 0) applyDamageToHero(session, p, 7, "Maldicao do Relogio", session.boss, { ignoreShield: true });
        });
        session.maldicao_contador = session.boss.fase_atual === 2 ? 3 : 5;
      }
      break;
    }
    case "BOSSBRT-002": {
      const target = selectTarget(session.players, "maxHand");
      if (target) {
        target.pendingDiscard = (target.pendingDiscard || 0) + 2;
        session.log.unshift(`[Presságio] Distorcao: ${target.name} deve descartar 2 cartas.`);
      }
      break;
    }
    case "BOSSBRT-003": {
      const pts = session.boss.fase_atual === 2 ? 2 : 1;
      session.players.forEach(p => {
        if (p.life > 0) {
          p.energy = Math.max(1, p.energy - pts);
        }
      });
      session.log.unshift(`[Presságio] Inversao da Mare: Todos os herois perderam ${pts} de Energia (minimo 1).`);
      break;
    }
    case "BOSSBRT-004": {
      session.revealedNextIntentionCards = session.intentionDeck.slice(0, 2);
      session.log.unshift("[Presságio] Ecos do Amanha: Proximas 2 intencoes reveladas.");
      break;
    }
    case "BOSSCOL-001": {
      session.boss.shield += 3;
      session.log.unshift("[Presságio] Esmagamento: Colosso ganha 3 de Escudo.");
      pushVisualEvent(session, { type: "shield", targetType: "enemy", targetId: session.boss.uid, amount: 3, source: "Esmagamento" });
      break;
    }
    case "BOSSCOL-002": {
      session.bossStunImmune = true;
      session.bossRedirectImmune = true;
      session.boss.isStunned = false;
      session.log.unshift("[Presságio] Furia Inabalavel: Colosso imune a atordoamento e redirecionamentos.");
      break;
    }
    case "BOSSCOL-003": {
      const preDmg = Math.floor(session.boss.attack / 2);
      session.players.forEach(p => {
        if (p.life > 0) {
          session.dungeonQueue.push({
            type: "enemyAttack",
            enemyUid: session.boss.uid,
            category: "boss",
            targetCriterion: "fixedPlayer_" + p.id,
            ruleText: `Pisoteio (Pre-ataque contra ${p.name})`,
            overrideAttack: preDmg
          });
        }
      });
      session.resolvingOmenAttacks = true;
      advanceDungeonTurn(session);
      break;
    }
    case "BOSSCOL-004": {
      session.enemies.forEach(e => {
        if (e.id === "carcereiro" && e.life > 0) {
          const before = e.life;
          e.life = Math.min(e.maxLife, e.life + 6);
          const healed = e.life - before;
          if (healed > 0) {
            session.log.unshift(`[Presságio] Muralha Eterna: ${e.name} curado em ${healed}.`);
            pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: e.uid, amount: healed, source: "Muralha Eterna" });
          }
        }
      });
      break;
    }
    case "BOSSORC-001": {
      const target = selectTarget(session.players, "maxLife");
      if (target) {
        applyDamageToHero(session, target, 3, "Drenagem Vital (Pressagio)", session.boss, { ignoreShield: true });
        const before = session.boss.life;
        session.boss.life = Math.min(session.boss.maxLife, session.boss.life + 3);
        const healed = session.boss.life - before;
        if (healed > 0) {
          session.log.unshift(`[Presságio] Drenagem Vital: Oraculo Corrompido curou ${healed}.`);
          pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: session.boss.uid, amount: healed, source: "Drenagem Vital" });
        }
      }
      break;
    }
    case "BOSSORC-002": {
      const active = session.players.filter(p => p.life > 0);
      if (active.length > 0) {
        const target = active[Math.floor(Math.random() * active.length)];
        target.statusEffects.veneno = (target.statusEffects.veneno || 0) + 2;
        session.log.unshift(`[Presságio] Contaminacao Sombria: ${target.name} recebe Veneno 2.`);
      }
      break;
    }
    case "BOSSORC-003": {
      const lastCard = session.ultima_carta_jogada_na_rodada;
      if (lastCard) {
        session.log.unshift(`[Presságio] Espelho Sombrio reflete a carta ${lastCard.name} (${lastCard.type.toUpperCase()}) de forma invertida.`);
        if (lastCard.type === "heal") {
          const x = lastCard.heal || lastCard.allHeal || lastCard.revive || 3;
          const active = session.players.filter(p => p.life > 0);
          if (active.length > 0) {
            const target = active[Math.floor(Math.random() * active.length)];
            session.log.unshift(`[Presságio] Espelho Sombrio: ${target.name} sofre ${x} de dano (ignora Escudo).`);
            applyDamageToHero(session, target, x, "Espelho Sombrio (Pressagio)", session.boss, { ignoreShield: true });
          }
        } else if (lastCard.type === "attack" || lastCard.damage || lastCard.areaDamage) {
          const x = lastCard.damage || lastCard.areaDamage || 3;
          const before = session.boss.life;
          session.boss.life = Math.min(session.boss.maxLife, session.boss.life + x);
          const healed = session.boss.life - before;
          if (healed > 0) {
            session.log.unshift(`[Presságio] Espelho Sombrio: Oraculo Corrompido curou ${healed}.`);
            pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: session.boss.uid, amount: healed, source: "Espelho Sombrio" });
            session.oracleMirrorHealedThisRound = true;
          }
        } else if (lastCard.type === "defense" || lastCard.block || lastCard.selfBlock || lastCard.allBlock) {
          const x = lastCard.block || lastCard.selfBlock || lastCard.allBlock || 3;
          session.boss.shield += x;
          session.log.unshift(`[Presságio] Espelho Sombrio: Oraculo Corrompido ganha ${x} de Escudo.`);
          pushVisualEvent(session, { type: "shield", targetType: "enemy", targetId: session.boss.uid, amount: x, source: "Espelho Sombrio" });
        } else {
          const active = session.players.filter(p => p.life > 0);
          if (active.length > 0) {
            const target = active[Math.floor(Math.random() * active.length)];
            target.statusEffects.vacuo = true;
            session.log.unshift(`[Presságio] Espelho Sombrio: ${target.name} recebe Vacuo.`);
          }
        }
      } else {
        session.log.unshift("[Presságio] Espelho Sombrio: Nenhuma carta jogada nesta rodada para refletir.");
      }
      break;
    }
    case "BOSSORC-004": {
      let lostCount = 0;
      session.players.forEach(p => {
        if (p.life > 0) {
          const oldEnergy = p.energy;
          p.energy = Math.max(1, p.energy - 1);
          if (p.energy < oldEnergy) {
            lostCount += 1;
          }
        }
      });
      const healAmt = lostCount * 2;
      if (healAmt > 0) {
        const before = session.boss.life;
        session.boss.life = Math.min(session.boss.maxLife, session.boss.life + healAmt);
        const healed = session.boss.life - before;
        if (healed > 0) {
          session.log.unshift(`[Presságio] Absorcao Total: ${lostCount} herois perderam Energia. Oraculo recupera ${healed} de Vida.`);
          pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: session.boss.uid, amount: healed, source: "Absorcao Total" });
        }
      }
      break;
    }
    case "INT_001": {
      // INT-001 (Caçada ao Sangue):
      // "Revele a próxima carta do baralho de Armadilhas (sem ativá-la). O grupo vê o que está por vir."
      const nextTrap = session.trapDeck[0] || trapCards[0];
      session.revealedNextTrap = nextTrap;
      session.log.unshift(`[Presságio] A próxima armadilha revelada é: ${nextTrap.name} (${nextTrap.text})`);
      break;
    }
    case "INT_002": {
      // INT-002 (Pressão Crescente):
      // "O Inimigo Brutal recebe +2 de Vida máxima e atual imediatamente."
      session.enemies.forEach((enemy) => {
        if (enemy.category === "brutal" && enemy.life > 0) {
          enemy.maxLife += 2;
          enemy.life += 2;
          session.log.unshift(`[Presságio] ${enemy.name} ganha +2 de Vida máxima e atual.`);
        }
      });
      break;
    }
    case "INT_003": {
      // INT-003 (Fúria Coordenada):
      // "Todos os inimigos em jogo ganham +1 de dano nesta rodada."
      // Handled inside computeEnemyAttack.
      break;
    }
    case "INT_004": {
      // INT-004 (Instinto Predatório):
      // "Cada herói com 0 de Escudo sofre 1 de dano imediatamente."
      session.players.forEach((player) => {
        if (player.life > 0 && player.shield === 0) {
          applyDamageToHero(session, player, 1, "Instinto Predatorio (Pressagio)");
        }
      });
      break;
    }
    case "INT_005": {
      // INT-005 (Coração Fraco):
      // "O herói com menos Vida perde 1 de Energia nesta rodada (mínimo 1)."
      const target = selectTarget(session.players, "minLife");
      if (target) {
        target.energy = Math.max(1, target.energy - 1);
        session.log.unshift(`[Presságio] ${target.name} (menor Vida) perdeu 1 de Energia nesta rodada.`);
      }
      break;
    }
    case "INT_006": {
      // INT-006 (Cerco Implacável):
      // "Cada Inimigo Comum em jogo ganham +1 de Escudo imediatamente."
      session.enemies.forEach((enemy) => {
        if (enemy.category === "common" && enemy.life > 0) {
          enemy.shield += 1;
          session.log.unshift(`[Presságio] ${enemy.name} recebe +1 de Escudo.`);
        }
      });
      break;
    }
    case "INT_007": {
      // INT-007 (Retaliação):
      // "O Inimigo Brutal não pode ser alvo de Reações nesta rodada."
      // Handled in advanceDungeonTurn by skipping reaction phase.
      break;
    }
    case "INT_008": {
      // INT-008 (Golpe nos Fortes):
      // "O herói com mais Escudo atual perde metade do seu Escudo (arredondado para baixo)."
      const target = selectTarget(session.players, "maxShield");
      if (target && target.shield > 0) {
        const removed = Math.floor(target.shield / 2);
        target.shield -= removed;
        session.log.unshift(`[Presságio] ${target.name} (mais Escudo) perdeu metade do seu Escudo (${removed} removido).`);
      }
      break;
    }
    case "INT_009": {
      // INT-009 (Pavor das Sombras):
      // "Na próxima fase de compra desta sala, cada herói não comprará nenhuma carta."
      session.skipNextDraw = true;
      break;
    }
    case "INT_010": {
      // INT-010 (Oportunismo):
      // "Se houver uma Armadilha ativa, ela aplica seu efeito uma vez adicional agora."
      const isTrapActive = session.activeTrap && !(session.activeTrapDisabledRounds && session.activeTrapDisabledRounds > 0);
      if (isTrapActive) {
        const effect = session.activeTrap.effect;
        if (effect === "energyPenalty") {
          session.players.forEach((player) => {
            if (player.life > 0) player.energy = Math.max(0, player.energy - 1);
          });
          session.log.unshift(`[Presságio] Oportunismo: Armadilha ativa (${session.activeTrap.name}) aplicou efeito adicional (-1 Energia).`);
        } else if (effect === "shieldDecay") {
          session.players.forEach((player) => {
            if (player.life > 0) player.shield = Math.max(0, player.shield - 1);
          });
          session.log.unshift(`[Presságio] Oportunismo: Armadilha ativa (${session.activeTrap.name}) aplicou efeito adicional (-1 Escudo).`);
        } else if (effect === "endDungeonAllDamage") {
          session.players.forEach((player) => {
            if (player.life > 0) applyDamageToHero(session, player, 1, session.activeTrap.name);
          });
          session.log.unshift(`[Presságio] Oportunismo: Armadilha ativa (${session.activeTrap.name}) aplicou efeito adicional (1 de dano a todos).`);
        } else if (effect === "endRoundLowestLifeDamage") {
          const target = selectTarget(session.players, "minLife");
          if (target) applyDamageToHero(session, target, 1, session.activeTrap.name);
          session.log.unshift(`[Presságio] Oportunismo: Armadilha ativa (${session.activeTrap.name}) aplicou efeito adicional (1 de dano no herói com menos vida).`);
        } else if (effect === "endDungeonDamageIfTwoEnemies") {
          if (aliveEnemyCount(session) >= 2) {
            session.players.forEach((player) => {
              if (player.life > 0) applyDamageToHero(session, player, 1, session.activeTrap.name);
            });
            session.log.unshift(`[Presságio] Oportunismo: Armadilha ativa (${session.activeTrap.name}) aplicou efeito adicional (1 de dano a todos).`);
          }
        } else {
          session.log.unshift(`[Presságio] Oportunismo: Armadilha ativa (${session.activeTrap.name}) tem efeito passivo e não pôde ser ativada de imediato.`);
        }
      } else {
        session.log.unshift(`[Presságio] Oportunismo: Nenhuma armadilha ativa para ativar.`);
      }
      break;
    }
    case "INT_011": {
      // INT-011 (Avanço Pesado):
      // "Todos os Inimigos Comuns em jogo ganham +2 de Vida máxima e atual."
      session.enemies.forEach((enemy) => {
        if (enemy.category === "common" && enemy.life > 0) {
          enemy.maxLife += 2;
          enemy.life += 2;
          session.log.unshift(`[Presságio] ${enemy.name} ganha +2 de Vida máxima e atual.`);
        }
      });
      break;
    }
    case "INT_012": {
      // INT-012 (Caçada ao Preparado):
      // "O herói com mais cartas na mão deve descartar 1 carta agora (à sua escolha)."
      const target = selectTarget(session.players, "maxHand");
      if (target && target.hand.length > 0) {
        target.pendingDiscard = (target.pendingDiscard || 0) + 1;
        session.log.unshift(`[Presságio] ${target.name} (mais cartas) deve escolher 1 carta para descartar.`);
      }
      break;
    }
    case "INT_013": {
      // INT-013 (Execução Coordenada):
      // "Todos os Inimigos Comuns ganham Veloz nesta rodada (atacam antes do Brutal)."
      // Handled in startDungeonTurn.
      break;
    }
    case "INT_014": {
      // INT-014 (Ruptura do Ritmo):
      // "O herói com mais Escudo transfere metade do seu Escudo (arredondado para baixo) para o herói com menos Vida."
      const source = selectTarget(session.players, "maxShield");
      const target = selectTarget(session.players, "minLife");
      if (source && target && source.id !== target.id && source.shield > 0) {
        const transferAmount = Math.floor(source.shield / 2);
        if (transferAmount > 0) {
          source.shield -= transferAmount;
          target.shield += transferAmount;
          target.roundStats.shieldReceived = (target.roundStats.shieldReceived || 0) + transferAmount;
          session.log.unshift(`[Presságio] Ruptura do Ritmo: ${source.name} transferiu ${transferAmount} de Escudo para ${target.name}.`);
        }
      }
      break;
    }
    case "INT_015": {
      // INT-015 (Sangue e Cura):
      // "O herói com mais Vida atual perde 2 pontos de Vida (ignora Escudo, não pode matar)."
      const target = selectTarget(session.players, "maxLife");
      if (target && target.life > 0) {
        const damage = Math.min(target.life - 1, 2);
        if (damage > 0) {
          target.life -= damage;
          pushVisualEvent(session, {
            type: "damage",
            targetType: "hero",
            targetId: target.id,
            amount: damage,
            source: "Sangue e Cura (Pressagio)"
          });
          session.log.unshift(`[Presságio] Sangue e Cura: ${target.name} perdeu ${damage} de Vida.`);
        }
      }
      break;
    }
  }
}

function applyIntentionRepresalia(session) {
  const card = session.activeIntention;
  if (!card) return;

  session.log.unshift(`💀 [Represália] Resolvendo Represália de ${card.name}: ${card.represaliaText}`);

  switch (card.id) {
    case "BOSSINQ-001": {
      const target = selectTarget(session.players, "maxShieldReceived");
      if (target) {
        session.log.unshift(`[Represália] Julgamento dos Escudos: Inquisidor realiza ataque adicional de 4 de dano fixo em ${target.name}.`);
        applyDamageToHero(session, target, 4, "Julgamento dos Escudos (Represalia)", session.boss);
      }
      break;
    }
    case "BOSSINQ-002": {
      const target = selectTarget(session.players, "minLife");
      if (target && target.life > 0 && target.life < 8) {
        session.log.unshift(`[Represália] Sentenca de Morte: ${target.name} sofre 3 de dano adicional.`);
        applyDamageToHero(session, target, 3, "Sentenca de Morte (Represalia)", session.boss, { ignoreShield: true });
      }
      break;
    }
    case "BOSSINQ-003": {
      if ((session.dano_total_causado_ao_boss || 0) < 12) {
        session.log.unshift("[Represália] Absolvicao Perversa: Grupo causou menos de 12 de dano. Todos os herois sofrem 2 de dano.");
        session.players.forEach(p => {
          if (p.life > 0) applyDamageToHero(session, p, 2, "Absolvicao Perversa (Represalia)", session.boss);
        });
      }
      break;
    }
    case "BOSSINQ-004": {
      if (session.boss?.fase_atual === 2 && session.boss?.life > 0) {
        session.bossNextAttackBonus = 4;
        session.log.unshift("[Represália] Veredicto Final: Proximo ataque do Inquisidor causara +4 de dano.");
      }
      break;
    }
    case "BOSSBRT-001": {
      if (session.maldicao_triggered_this_round) {
        const before = session.boss.life;
        session.boss.life = Math.min(session.boss.maxLife, session.boss.life + 8);
        const healed = session.boss.life - before;
        if (healed > 0) {
          session.log.unshift(`[Represália] Maldicao Acelerada: Bruxa curou ${healed} de Vida.`);
          pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: session.boss.uid, amount: healed, source: "Maldicao Acelerada" });
        }
      }
      break;
    }
    case "BOSSBRT-002": {
      session.players.forEach(p => {
        if (p.life > 0 && p.hand.length === 0) {
          p.statusEffects.vacuo = true;
          session.log.unshift(`[Represália] Distorcao: ${p.name} terminou sem cartas e recebe Vacuo.`);
        }
      });
      break;
    }
    case "BOSSBRT-003": {
      session.players.forEach(p => {
        if (p.life > 0 && p.roundStats.cardsPlayed === 0) {
          session.log.unshift(`[Represália] Inversao da Mare: ${p.name} nao jogou nenhuma carta e sofre 3 de dano.`);
          applyDamageToHero(session, p, 3, "Inversao da Mare (Represalia)", session.boss);
        }
      });
      break;
    }
    case "BOSSBRT-004": {
      if (session.boss?.fase_atual === 2 && (session.dano_total_causado_ao_boss || 0) < 10) {
        const before = session.boss.life;
        session.boss.life = Math.min(session.boss.maxLife, session.boss.life + 5);
        const healed = session.boss.life - before;
        if (healed > 0) {
          session.log.unshift(`[Represália] Ecos do Amanha: Bruxa curou ${healed} de Vida.`);
          pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: session.boss.uid, amount: healed, source: "Ecos do Amanha" });
        }
      }
      break;
    }
    case "BOSSCOL-001": {
      // Handled at end of dungeon turn
      break;
    }
    case "BOSSCOL-002": {
      // Handled in resolveEnemyAttack
      break;
    }
    case "BOSSCOL-003": {
      const anyDefeated = session.players.some(p => p.life <= 0);
      if (!anyDefeated) {
        const before = session.boss.life;
        session.boss.life = Math.min(session.boss.maxLife, session.boss.life + 5);
        const healed = session.boss.life - before;
        if (healed > 0) {
          session.log.unshift(`[Represália] Pisoteio: Colosso recupera ${healed} de Vida.`);
          pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: session.boss.uid, amount: healed, source: "Pisoteio" });
        }
      }
      break;
    }
    case "BOSSCOL-004": {
      if (session.boss?.fase_atual === 2 && session.boss.shield > 0 && session.doubleDevastationTarget) {
        session.log.unshift(`[Represália] Muralha Eterna: Colosso causou +3 de dano da Dupla Devastacao em ${session.doubleDevastationTarget.name} por possuir Escudo.`);
        applyDamageToHero(session, session.doubleDevastationTarget, 3, "Muralha Eterna (Represalia)", session.boss);
      }
      break;
    }
    case "BOSSORC-001": {
      const anyHealed = session.players.some(p => p.life > 0 && p.roundStats.healingReceived > 0);
      if (anyHealed && session.boss?.fase_atual === 2) {
        const before = session.boss.life;
        session.boss.life = Math.min(session.boss.maxLife, session.boss.life + 5);
        const healed = session.boss.life - before;
        if (healed > 0) {
          session.log.unshift(`[Represália] Drenagem Vital: Oraculo Corrompido recupera ${healed} de Vida.`);
          pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: session.boss.uid, amount: healed, source: "Drenagem Vital" });
        }
      }
      break;
    }
    case "BOSSORC-002": {
      const poisonedCount = session.players.filter(p => p.life > 0 && p.statusEffects.veneno > 0).length;
      if (poisonedCount > 0) {
        const healAmt = poisonedCount * 2;
        const before = session.boss.life;
        session.boss.life = Math.min(session.boss.maxLife, session.boss.life + healAmt);
        const healed = session.boss.life - before;
        if (healed > 0) {
          session.log.unshift(`[Represália] Contaminacao Sombria: Oraculo Corrompido recupera ${healed} de Vida.`);
          pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: session.boss.uid, amount: healed, source: "Contaminacao Sombria" });
        }
      }
      break;
    }
    case "BOSSORC-003": {
      if (session.oracleMirrorHealedThisRound) {
        const target = selectTarget(session.players, "minShield");
        if (target) {
          session.log.unshift(`[Represália] Espelho Sombrio: ${target.name} sofre 2 de dano adicional.`);
          applyDamageToHero(session, target, 2, "Espelho Sombrio (Represalia)", session.boss);
        }
      }
      break;
    }
    case "BOSSORC-004": {
      if (session.boss?.fase_atual === 2 && session.boss?.life >= 25) {
        session.players.forEach(p => {
          if (p.life > 0) {
            p.statusEffects.enfraquecido = (p.statusEffects.enfraquecido || 0) + 1;
          }
        });
        session.log.unshift("[Represália] Absorcao Total: Todos os herois receberam Enfraquecido 1.");
      }
      break;
    }
    case "INT_001": {
      // INT-001: "Se algum herói foi derrotado esta rodada, invoque 1 Inimigo Comum imediatamente."
      if (session.heroDefeatedThisRound) {
        const templateId = drawEnemyId(session, "common");
        const newEnemy = createEnemy(session, templateId);
        session.enemies.push(newEnemy);
        session.log.unshift(`[Represália] Caçada ao Sangue: Um herói foi derrotado. Invocado ${newEnemy.name}.`);
      }
      break;
    }
    case "INT_002": {
      // INT-002: "Se o Brutal ainda estiver vivo ao fim da rodada, ele ganha Enfurecido permanentemente."
      session.enemies.forEach((enemy) => {
        if (enemy.category === "brutal" && enemy.life > 0) {
          enemy.isEnfurecido = true;
          session.log.unshift(`[Represália] Pressão Crescente: ${enemy.name} ganha Enfurecido permanentemente.`);
        }
      });
      break;
    }
    case "INT_003": {
      // INT-003: "Se nenhum inimigo foi derrotado nesta rodada, todos os heróis descartam 1 carta aleatoriamente."
      const totalEnemiesDefeated = session.players.reduce((sum, p) => sum + (p.roundStats.enemiesDefeated || 0), 0);
      if (totalEnemiesDefeated === 0) {
        session.players.forEach((player) => {
          if (player.life > 0) {
            discardRandomCard(session, player);
          }
        });
      }
      break;
    }
    case "INT_004": {
      // INT-004: "Se nenhum herói possui Escudo ao fim da rodada, todos sofrem 1 de dano adicional."
      const noShield = session.players.every((p) => p.life <= 0 || p.shield === 0);
      if (noShield) {
        session.players.forEach((player) => {
          if (player.life > 0) {
            applyDamageToHero(session, player, 1, "Instinto Predatorio (Represalia)");
          }
        });
      }
      break;
    }
    case "INT_005": {
      // INT-005: "Se o herói com menos Vida terminar a rodada abaixo de 5 pontos, ele sofre 2 de dano adicional."
      const target = selectTarget(session.players, "minLife");
      if (target && target.life > 0 && target.life < 5) {
        applyDamageToHero(session, target, 2, "Coracao Fraco (Represalia)");
      }
      break;
    }
    case "INT_006": {
      // INT-006: "Se restarem 2 ou mais inimigos vivos ao fim da rodada, todos os heróis sofrem 1 de dano."
      if (aliveEnemyCount(session) >= 2) {
        session.players.forEach((player) => {
          if (player.life > 0) {
            applyDamageToHero(session, player, 1, "Cerco Implacavel (Represalia)");
          }
        });
      }
      break;
    }
    case "INT_007": {
      // INT-007: "Se o Brutal sobreviveu a esta rodada, ele ganha +1 de dano permanentemente."
      session.enemies.forEach((enemy) => {
        if (enemy.category === "brutal" && enemy.life > 0) {
          enemy.attack += 1;
          session.log.unshift(`[Represália] Retaliação: ${enemy.name} ganha +1 de dano permanentemente.`);
        }
      });
      break;
    }
    case "INT_008": {
      // INT-008: "Se o herói com mais Vida não recebeu nenhum Escudo nesta rodada, ele sofre 2 de dano adicional."
      const target = selectTarget(session.players, "maxLife");
      if (target && target.life > 0 && !(target.roundStats.shieldReceived > 0)) {
        applyDamageToHero(session, target, 2, "Golpe nos Fortes (Represalia)");
      }
      break;
    }
    case "INT_009": {
      // INT-009: "Se algum herói terminar a rodada com 0 cartas na mão, ele sofre 2 de dano."
      session.players.forEach((player) => {
        if (player.life > 0 && player.hand.length === 0) {
          applyDamageToHero(session, player, 2, "Pavor das Sombras (Represalia)");
        }
      });
      break;
    }
    case "INT_010": {
      // INT-010: "Se a Armadilha ainda estiver ativa ao fim da rodada, todos os heróis sofrem 1 de dano."
      const isTrapActive = session.activeTrap && !(session.activeTrapDisabledRounds && session.activeTrapDisabledRounds > 0);
      if (isTrapActive) {
        session.players.forEach((player) => {
          if (player.life > 0) {
            applyDamageToHero(session, player, 1, "Oportunismo (Represalia)");
          }
        });
      }
      break;
    }
    case "INT_011": {
      // INT-011: "Se restarem 2 ou mais Comuns vivos ao fim da rodada, o Brutal realiza 1 ataque adicional de 2 de dano fixo no herói com menos Vida."
      const aliveCommonsCount = session.enemies.filter((e) => e.category === "common" && e.life > 0).length;
      const brutal = session.enemies.find((e) => e.category === "brutal" && e.life > 0);
      if (aliveCommonsCount >= 2 && brutal) {
        const target = selectTarget(session.players, "minLife");
        if (target) {
          applyDamageToHero(session, target, 2, `${brutal.name} (Represalia)`);
        }
      }
      break;
    }
    case "INT_012": {
      // INT-012: "Se algum herói gastou menos de 2 de Energia nesta rodada, ele sofre 1 de dano."
      session.players.forEach((player) => {
        if (player.life > 0 && player.roundStats.energySpent < 2) {
          applyDamageToHero(session, player, 1, "Cacada ao Preparado (Represalia)");
        }
      });
      break;
    }
    case "INT_013": {
      // INT-013: "Se o herói com menos Escudo terminar a rodada com menos de 8 de Vida, ele sofre 2 de dano adicional."
      const target = selectTarget(session.players, "minShield");
      if (target && target.life > 0 && target.life < 8) {
        applyDamageToHero(session, target, 2, "Execucao Coordenada (Represalia)");
      }
      break;
    }
    case "INT_014": {
      // INT-014: "Se algum herói não jogou nenhuma carta de Ataque nesta rodada, ele sofre 2 de dano."
      session.players.forEach((player) => {
        if (player.life > 0 && player.roundStats.attackCardsPlayed === 0) {
          applyDamageToHero(session, player, 2, "Ruptura do Ritmo (Represalia)");
        }
      });
      break;
    }
    case "INT_015": {
      // INT-015: "Se algum herói foi curado nesta rodada, ele sofre 1 de dano adicional."
      session.players.forEach((player) => {
        if (player.life > 0 && player.roundStats.healingReceived > 0) {
          applyDamageToHero(session, player, 1, "Sangue e Cura (Represalia)");
        }
      });
      break;
    }
  }
}

function discardRandomCard(session, player) {
  if (player.hand.length === 0) return;
  const idx = Math.floor(Math.random() * player.hand.length);
  const card = player.hand.splice(idx, 1)[0];
  player.discard.push(card);
  session.log.unshift(`${player.name} descartou ${card.name} aleatoriamente.`);
}

function addPlayer(session, name) {
  if (session.players.length >= 5) throw new Error("A sala ja esta cheia.");
  if (session.status !== "lobby") throw new Error("A partida ja comecou.");

  const player = {
    id: randomUUID(),
    token: randomUUID(),
    name: cleanName(name),
    heroId: null,
    ready: false,
    turnEnded: false,
    maxLife: 0,
    life: 0,
    maxEnergy: 0,
    energy: 0,
    shield: 0,
    protectingId: null,
    interceptReady: false,
    reflectDamage: 0,
    reduceDamage: 0,
    statusEffects: makeStatusEffects(),
    roundStats: makeRoundStats(),
    deck: [],
    hand: [],
    played: [],
    discard: [],
    supremeCard: null,
    supremeUsed: false,
    pendingDiscard: 0,
    maxHandSize: 5,
    chosenRewards: [],
    hasClaimedRoomReward: false,
    hasRedrawAvailable: false,
    justChoseRedraw: false
  };
  session.players.push(player);
  session.log.unshift(`${player.name} entrou na sala.`);
  return player;
}

function cleanName(name) {
  const safe = String(name || "").trim().slice(0, 24);
  return safe || `Jogador ${Math.floor(Math.random() * 900 + 100)}`;
}

function getPlayer(session, playerId, token) {
  const player = session.players.find((candidate) => candidate.id === playerId);
  if (!player || player.token !== token) throw new Error("Jogador nao autorizado.");
  return player;
}

function drawCards(player, amount) {
  const maxDrawn = Math.max(0, (player.maxHandSize || 5) - player.hand.length);
  const targetAmount = Math.min(amount, maxDrawn);
  const drawn = [];
  while (drawn.length < targetAmount) {
    if (player.deck.length === 0) {
      if (player.discard.length === 0) break;
      player.deck = shuffle(player.discard);
      player.discard = [];
    }
    drawn.push(player.deck.shift());
  }
  player.hand.push(...drawn);
  return drawn.length;
}

function startGame(session) {
  if (session.status !== "lobby") throw new Error("A partida ja comecou.");
  if (session.players.length < 1) throw new Error("Entre com pelo menos um jogador.");
  if (session.players.some((player) => !player.heroId || !player.ready)) {
    throw new Error("Todos precisam escolher um heroi e marcar pronto.");
  }

  session.status = "playing";
  session.turn = "players";
  session.dungeonResolved = false;
  session.round = 1;
  session.roomRound = 1;
  session.roomNumber = 1;
  session.arena = [];
  session.commonEnemyDeck = makeEnemyDeck("common");
  session.commonEnemyDiscard = [];
  session.brutalEnemyDeck = makeEnemyDeck("brutal");
  session.brutalEnemyDiscard = [];
  session.trapDeck = shuffle(trapCards);
  session.trapDiscard = [];
  session.activeTrap = null;
  session.roomDeck = shuffle(roomCards);
  session.roomDiscard = [];
  session.room = session.roomDeck.shift() || roomCards[0];
  session.visualEvents = [];
  setupCurrentRoom(session);
  session.intentionDeck = shuffle(intentionCards);
  session.intentionDiscard = [];
  session.activeIntention = null;
  session.dungeonQueue = [];
  session.pendingReaction = null;
  session.pendingShieldAllocation = null;
  session.players.forEach((player) => {
    const hero = heroes[player.heroId];
    player.maxLife = hero.life;
    player.life = hero.life;
    player.maxEnergy = hero.energy;
    player.energy = hero.energy;
    player.shield = 0;
    player.protectingId = null;
    player.interceptReady = false;
    player.reflectDamage = 0;
    player.reduceDamage = 0;
    player.statusEffects = makeStatusEffects();
    player.nextAttackBonus = 0;
    player.bastiaoSupremoActive = false;
    player.turnEnded = false;
    player.roundStats = makeRoundStats();
    player.deck = makeDeck(player.heroId);
    player.hand = [];
    player.played = [];
    player.discard = [];
    player.pendingDiscard = 0;
    player.supremeUsed = false;
    // Give player their supreme card if their hero has one
    const supremeId = hero.supreme;
    player.supremeCard = supremeId && cards[supremeId]
      ? { uid: randomUUID(), heroId: player.heroId, ...cards[supremeId] }
      : null;
    drawCards(player, 5);
  });
  applyStartOfRoundEffects(session);
  session.players.forEach((p) => { p.energyAtStartOfRound = p.energy; });
  session.heroDefeatedThisRound = false;
  session.revealedNextTrap = null;
  session.nextDrawReduction = 0;
  session.skipNextDraw = false;
  drawIntention(session);
  applyIntentionPresagio(session);
  session.log.unshift("A partida comecou. Cada heroi comprou exatamente 5 cartas.");
}

function startNextRound(session) {
  if (session.status !== "playing") throw new Error("A partida ainda nao comecou.");
  if (session.turn !== "dungeon" || !session.dungeonResolved) {
    throw new Error("A proxima rodada so comeca depois do turno da dungeon.");
  }
  
  if (session.activeTrapDisabledRounds && session.activeTrapDisabledRounds > 0) {
    session.activeTrapDisabledRounds -= 1;
    if (session.activeTrapDisabledRounds === 0) {
      session.log.unshift(`A armadilha ${session.activeTrap ? session.activeTrap.name : ""} voltou a ficar ativa.`);
    }
  }

  // 1. Tick Veneno for both players and monsters (antes da Restauração e Compra)
  session.players.forEach((player) => {
    if (player.life > 0 && player.statusEffects?.veneno > 0) {
      const dmg = player.statusEffects.veneno;
      applyDamageToHero(session, player, dmg, "Veneno", null, { skipRedirect: true });
    }
  });
  session.enemies.forEach((enemy) => {
    if (enemy.life > 0 && enemy.statusEffects?.veneno > 0) {
      const dmg = enemy.statusEffects.veneno;
      applyDamageToEnemy(session, enemy, dmg, "Veneno", false, null);
    }
  });

  session.round += 1;
  session.turn = "players";
  session.dungeonResolved = false;
  session.dungeonQueue = [];
  session.pendingReaction = null;
  const completedRoom = isRoomComplete(session);
  if (completedRoom) {
    const allRewardsClaimed = session.players.every((p) => p.life <= 0 || p.hasClaimedRoomReward);
    if (!allRewardsClaimed) {
      throw new Error("Todos os jogadores ativos devem escolher suas recompensas antes de iniciar a proxima sala.");
    }
    session.players.forEach((player) => {
      player.hasClaimedRoomReward = false;
      if (player.justChoseRedraw) {
        player.hasRedrawAvailable = true;
        player.justChoseRedraw = false;
      } else {
        player.hasRedrawAvailable = false;
      }
    });
    archiveCurrentEnemies(session);
    drawNextRoom(session);
  } else {
    session.roomRound += 1;
  }
  session.arena = [];
  session.enemies.forEach((enemy) => {
    enemy.isStunned = false;
    if (enemy.statusEffects) {
      enemy.statusEffects.vacuo = false;
    }
  });
  session.players.forEach((player) => {
    player.discard.push(...player.played);
    player.played = [];
    player.energy = player.maxEnergy;
    player.protectingId = null;
    player.interceptReady = false;
    player.reflectDamage = 0;
    player.reduceDamage = 0;
    player.nextAttackBonus = 0;
    player.bastiaoSupremoActive = false;
    player.turnEnded = player.life <= 0;
    player.roundStats = makeRoundStats();
    
    // Draw logic checking Vácuo
    const isVacuo = player.statusEffects?.vacuo;
    const baseDraw = getRoundDrawCount(session);
    const cardsToDraw = isVacuo ? 0 : baseDraw;
    const drawn = drawCards(player, cardsToDraw);
    
    if (isVacuo) {
      session.log.unshift(`${player.name} não comprou cartas automaticamente devido ao status Vácuo.`);
      player.statusEffects.vacuo = false;
    } else {
      session.log.unshift(`${player.name} comprou ${drawn} de ${cardsToDraw} cartas na rodada ${session.round}.`);
    }

    // Exposto expiration logic:
    if (player.statusEffects?.exposto) {
      player.statusEffects.exposto = false;
      session.log.unshift(`Exposto expirou para ${player.name}.`);
    }
  });
  session.nextDrawReduction = 0;
  session.skipNextDraw = false;
  applyStartOfRoundEffects(session);
  session.players.forEach((p) => { p.energyAtStartOfRound = p.energy; });
  session.heroDefeatedThisRound = false;
  session.revealedNextTrap = null;
  session.enemies.forEach((enemy) => {
    enemy.forcedTargetId = null;
  });
  drawIntention(session);
  applyIntentionPresagio(session);
  session.log.unshift(
    completedRoom
      ? `Nova sala preparada: ${session.room.name}.`
      : `A sala continua: ${session.room.name}, rodada ${session.roomRound}.`
  );
}

function playCard(session, player, payload) {
  if (session.status !== "playing") throw new Error("A partida ainda nao comecou.");
  if (session.turn !== "players") throw new Error("Agora e o turno da dungeon.");
  if (player.turnEnded) throw new Error("Voce ja finalizou seu turno.");

  const cardIndex = player.hand.findIndex((card) => card.uid === payload.cardUid);
  if (cardIndex === -1) throw new Error("Carta nao encontrada na mao.");

  const card = player.hand[cardIndex];
  if (card.type === "reaction") throw new Error("Cartas de Reacao so podem ser usadas na janela de reacao da dungeon.");

  const isFreePlay = session.pendingDistorcaoTemporal && session.pendingDistorcaoTemporal.targetId === player.id;
  if (isFreePlay) {
    if (card.cost > 2) {
      throw new Error("Apenas cartas de custo 2 ou menos podem ser jogadas com Distorcao Temporal.");
    }
  }

  const finalCost = isFreePlay ? 0 : card.cost;
  if (player.energy < finalCost) throw new Error("Energia insuficiente.");

  if (card.id === "purificar") {
    if (!session.activeTrap) {
      throw new Error("Nao ha armadilha ativa para purificar.");
    }
    // Caster needs at least 1 other card to discard (since Purificar is in hand, total size must be >= 2)
    if (player.hand.length < 2) {
      throw new Error("Voce precisa de pelo menos mais uma carta na mao para descartar.");
    }
    // Other players need at least 1 card to discard
    const unablePlayers = session.players.filter(p => p.id !== player.id && p.life > 0 && p.hand.length < 1);
    if (unablePlayers.length > 0) {
      const names = unablePlayers.map(p => p.name).join(", ");
      throw new Error(`Nem todos os aliados possuem cartas na mao para descartar: ${names} estao sem cartas.`);
    }
  }
  if (card.lowLifeMax && player.life > card.lowLifeMax) {
    throw new Error(`${card.name} so pode ser usada com ${card.lowLifeMax} de Vida ou menos.`);
  }

  const isNoHealing = (session.activeTrapDisabledRounds && session.activeTrapDisabledRounds > 0) ? false : (session.activeTrap?.effect === "noHealing");
  if (card.type === "heal" && isNoHealing) {
    throw new Error(`Cura bloqueada pela armadilha ${session.activeTrap.name}.`);
  }

  const isNoExtraDraw = (session.activeTrapDisabledRounds && session.activeTrapDisabledRounds > 0) ? false : (session.activeTrap?.effect === "noExtraDraw");
  if (card.type === "draw" && isNoExtraDraw) {
    throw new Error(`Compra extra bloqueada pela armadilha ${session.activeTrap.name}.`);
  }

  player.hand.splice(cardIndex, 1);
  player.energy -= finalCost;
  player.roundStats.energySpent += finalCost;
  player.roundStats.cardsPlayed += 1;
  if (card.type === "attack") player.roundStats.attackCardsPlayed += 1;

  session.ultima_carta_jogada_na_rodada = card;

  const isDefenseOrShield = card.type === "defense" || card.block > 0 || card.selfBlock > 0 || card.allBlock > 0 || card.concede_escudo || card.shareShields || card.moveShield;
  if (isDefenseOrShield) {
    player.roundStats.cardsDefensePlayed = (player.roundStats.cardsDefensePlayed || 0) + 1;
    if (session.room?.effect === "bossRoom" && session.boss?.id === "inquisidor" && session.boss.fase_atual === 1 && session.boss.life > 0) {
      session.log.unshift(`Punicao dos Escudos: ${player.name} sofre 2 de dano por conceder Escudo.`);
      applyDamageToHero(session, player, 2, "Punicao dos Escudos", session.boss, { ignoreShield: true });
    }
  }

  player.played.push(card);

  const arenaCard = {
    uid: card.uid,
    id: card.id,
    heroId: card.heroId,
    name: card.name,
    type: card.type,
    cost: finalCost,
    damage: card.damage,
    areaDamage: card.areaDamage,
    ignoreShield: card.ignoreShield,
    heal: card.heal,
    block: card.block,
    selfBlock: card.selfBlock,
    allBlock: card.allBlock,
    energy: card.energy,
    draw: card.draw,
    provoke: card.provoke,
    intercept: card.intercept,
    reflect: card.reflect,
    reduceDamage: card.reduceDamage,
    enemyChallenge: card.enemyChallenge,
    lowLifeMax: card.lowLifeMax,
    text: card.text,
    playedBy: isFreePlay ? `${player.name} (Gratis)` : player.name
  };
  session.arena.unshift(arenaCard);

  if (isFreePlay) {
    session.pendingDistorcaoTemporal = null;
    session.log.unshift(`${player.name} jogou ${card.name} gratuitamente via Distorcao Temporal.`);
  }

  // Consume next attack bonus if it's an attack card
  let attackBuff = 0;
  const isAttackCard = card.type === "attack" || card.damage || card.areaDamage || card.id === "flecha-explosiva" || card.id === "execucao" || card.id === "tempestade-eletrica";
  if (player.nextAttackBonus && isAttackCard) {
    attackBuff = player.nextAttackBonus;
    player.nextAttackBonus = 0;
  }

  executeCardEffects(session, player, card, payload, attackBuff);

  if (isAttackCard && player.statusEffects && player.statusEffects.enfraquecido > 0) {
    session.log.unshift(`${player.name} consumiu o status Enfraquecido (redução de ${player.statusEffects.enfraquecido} no dano).`);
    player.statusEffects.enfraquecido = 0;
  }
}

function executeCardEffects(session, player, card, payload, attackBuff) {
  if (card.areaDamage) {
    const targets = session.enemies.filter((enemy) => enemy.life > 0);
    targets.forEach((enemy) =>
      applyDamageToEnemy(session, enemy, getHeroAttackDamage(player, card.areaDamage, attackBuff, getHeroAttackPenalty(session)), card.name, false, player)
    );
  }

  if (card.damage) {
    resolveHeroAttack(session, player, card, payload.targetId, attackBuff);
  }

  if (card.selfBlock) {
    player.shield += card.selfBlock;
    player.roundStats.shieldReceived = (player.roundStats.shieldReceived || 0) + card.selfBlock;
    session.log.unshift(`${player.name} recebeu ${card.selfBlock} de Escudo com ${card.name}.`);
    pushVisualEvent(session, {
      type: "shield",
      targetType: "hero",
      targetId: player.id,
      amount: card.selfBlock,
      source: card.name
    });
  }

  if (card.allBlock) {
    session.players.filter((ally) => ally.life > 0).forEach((ally) => {
      ally.shield += card.allBlock;
      ally.roundStats.shieldReceived = (ally.roundStats.shieldReceived || 0) + card.allBlock;
      pushVisualEvent(session, {
        type: "shield",
        targetType: "hero",
        targetId: ally.id,
        amount: card.allBlock,
        source: card.name
      });
    });
    session.log.unshift(`${card.name}: todos os aliados receberam ${card.allBlock} de Escudo.`);
  }

  if (card.block) {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    target.shield += card.block;
    target.roundStats.shieldReceived = (target.roundStats.shieldReceived || 0) + card.block;
    session.log.unshift(`${target.name} recebeu ${card.block} de Escudo com ${card.name}.`);
    pushVisualEvent(session, {
      type: "shield",
      targetType: "hero",
      targetId: target.id,
      amount: card.block,
      source: card.name
    });
  }

  // energy to self (existing)
  if (card.energy && !card.target) {
    player.energy += card.energy;
    session.log.unshift(`${player.name} recuperou ${card.energy} de energia com ${card.name}.`);
  }

  // energy to an ally (inspiracao or fluxo-arcano)
  if (card.energy && card.target === "ally") {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    target.energy = Math.min(target.maxEnergy + 2, target.energy + card.energy); // allow slight overflow for combos
    session.log.unshift(`${target.name} recuperou ${card.energy} de Energia com ${card.name}.`);
  }

  // energy to all allies (descanso-breve)
  if (card.allEnergy) {
    session.players.filter((ally) => ally.life > 0).forEach((ally) => {
      ally.energy = Math.min(ally.maxEnergy + 1, ally.energy + card.allEnergy);
    });
    session.log.unshift(`${card.name}: todos os aliados recuperaram ${card.allEnergy} de Energia.`);
  }

  if (card.draw && !card.planning) {
    const drawn = drawCards(player, card.draw);
    session.log.unshift(`${player.name} comprou ${drawn} carta(s) com ${card.name}.`);
  }

  // planejamento: ally draws 2, must discard 1
  if (card.planning) {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    drawCards(target, 2);
    target.pendingDiscard = (target.pendingDiscard || 0) + 1;
    session.log.unshift(`${target.name} comprou 2 cartas com ${card.name} e deve descartar 1.`);
  }

  if (card.heal) {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    applyHealToHero(session, target, card.heal, card.name);
    session.log.unshift(`${player.name} curou ${target.name} com ${card.name}.`);
  }

  // cura-em-massa: heal all allies
  if (card.allHeal) {
    session.players.filter((ally) => ally.life > 0).forEach((ally) => {
      applyHealToHero(session, ally, card.allHeal, card.name);
    });
    session.log.unshift(`${card.name}: todos os aliados receberam Cura ${card.allHeal}.`);
  }

  // reanimar: revive a defeated ally
  if (card.revive) {
    const target = session.players.find((p) => p.id === payload.targetId && p.life <= 0)
      || session.players.find((p) => p.life <= 0);
    if (!target) throw new Error("Nao ha aliados derrotados para reanimar.");
    target.life = card.revive;
    target.turnEnded = false;
    pushVisualEvent(session, { type: "heal", targetType: "hero", targetId: target.id, amount: card.revive, source: card.name });
    session.log.unshift(`${target.name} foi reanimado com ${card.revive} de Vida!`);
  }

  // redistribuir-escudos: move shield from one ally to another
  if (card.moveShield) {
    const fromPlayer = session.players.find((p) => p.id === payload.fromId && p.life > 0) || player;
    const toPlayer = getCardPlayerTarget(session, player, payload.targetId, card);
    const amount = Math.min(fromPlayer.shield, Number(payload.shieldAmount) || fromPlayer.shield);
    if (amount > 0 && fromPlayer.id !== toPlayer.id) {
      fromPlayer.shield -= amount;
      toPlayer.shield += amount;
      toPlayer.roundStats.shieldReceived = (toPlayer.roundStats.shieldReceived || 0) + amount;
      pushVisualEvent(session, { type: "shield", targetType: "hero", targetId: toPlayer.id, amount, source: card.name });
      session.log.unshift(`${player.name} moveu ${amount} de Escudo de ${fromPlayer.name} para ${toPlayer.name}.`);
    } else {
      // No valid move — open allocation UI for client to specify
      session.pendingShieldAllocation = { cardUid: card.uid, casterName: player.name, mode: "move" };
      session.log.unshift(`${player.name} jogou ${card.name}. Aguardando escolha de redistribuicao.`);
    }
  }

  // escudo-compartilhado: free redistribute all shields
  if (card.shareShields) {
    const totalShield = session.players.reduce((sum, p) => sum + p.shield, 0);
    session.pendingShieldAllocation = { cardUid: card.uid, casterName: player.name, mode: "share", totalShield };
    session.log.unshift(`${player.name} jogou ${card.name}. Redistribua ${totalShield} de Escudo entre os aliados.`);
  }

  // purificar: remove active trap
  if (card.removeTrap) {
    if (!session.activeTrap) throw new Error("Nao ha armadilha ativa para purificar.");
    const trapName = session.activeTrap.name;
    session.trapDiscard.push(session.activeTrap);
    session.activeTrap = null;
    
    // Each active player must discard 1 card
    session.players.forEach((p) => {
      if (p.life > 0) {
        p.pendingDiscard = (p.pendingDiscard || 0) + 1;
      }
    });

    session.log.unshift(`${player.name} purificou a armadilha ${trapName}! Todos os herois da mesa devem escolher e descartar 1 carta.`);
  }

  // suprema: luz-da-esperanca
  if (card.supremeEffects) {
    session.players.filter((ally) => ally.life > 0).forEach((ally) => {
      applyHealToHero(session, ally, 5, card.name);
      ally.shield += 5;
      ally.roundStats.shieldReceived = (ally.roundStats.shieldReceived || 0) + 5;
      ally.energy = Math.min(ally.maxEnergy + 2, ally.energy + 2);
      pushVisualEvent(session, { type: "shield", targetType: "hero", targetId: ally.id, amount: 5, source: card.name });
      drawCards(ally, 1);
    });
    session.log.unshift(`${player.name} usou ${card.name}! Todos os aliados receberam Cura 5, Escudo 5, Energia +2 e compraram 1 carta.`);
  }

  if (card.provoke) {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    player.protectingId = target.id;
    session.log.unshift(`${player.name} provocou ataques contra ${target.name}.`);
  }

  if (card.intercept) {
    player.interceptReady = true;
    session.log.unshift(`${player.name} preparou Interceptar.`);
  }

  if (card.reflect) {
    const target = card.target === "ally" ? getCardPlayerTarget(session, player, payload.targetId, card) : player;
    target.reflectDamage = Math.max(target.reflectDamage || 0, card.reflect);
    session.log.unshift(`${target.name} recebeu Refletir ${card.reflect}.`);
  }

  if (card.reduceDamage) {
    player.reduceDamage = Math.max(player.reduceDamage || 0, card.reduceDamage);
    session.log.unshift(`${player.name} reduziara todo dano recebido em ${card.reduceDamage}.`);
  }

  if (card.enemyChallenge) {
    const target =
      session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) ||
      session.enemies.find((enemy) => enemy.life > 0);
    if (!target) throw new Error("Nao ha monstros vivos para desafiar.");
    target.forcedTargetId = player.id;
    session.log.unshift(`${target.name} foi desafiado e so pode atacar ${player.name} ate o fim da rodada.`);
  }

  // Batedor (Archer) custom cards
  if (card.nextAttackBonus) {
    player.nextAttackBonus = (player.nextAttackBonus || 0) + card.nextAttackBonus;
    session.log.unshift(`${player.name} jogou ${card.name}. Proxima carta de ataque causara +${card.nextAttackBonus} de dano.`);
  }

  if (card.id === "flecha-explosiva") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const dmgTarget = getHeroAttackDamage(player, 4, attackBuff, getHeroAttackPenalty(session));
      const dmgOthers = getHeroAttackDamage(player, 2, 0, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmgTarget, card.name, false, player);
      session.enemies.filter((enemy) => enemy.uid !== target.uid && enemy.life > 0).forEach((other) => {
        applyDamageToEnemy(session, other, dmgOthers, card.name, false, player);
      });
      session.log.unshift(`${player.name} jogou Flecha Explosiva! 4 de dano (modificado para ${dmgTarget}) em ${target.name} e 2 de dano (modificado para ${dmgOthers}) em area nos demais.`);
    }
  }

  if (card.stun) {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      if (card.target === "brutal" && target.category !== "brutal") {
        throw new Error("Esta carta so pode visar Inimigos Brutais.");
      }
      target.isStunned = true;
      session.log.unshift(`${player.name} atordoou ${target.name} com ${card.name}. Ele nao atacara nesta rodada.`);
    }
  }

  if (card.id === "execucao") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      if (target.category === "common") {
        const damageNeeded = target.life;
        applyDamageToEnemy(session, target, damageNeeded, card.name, true, player);
        session.log.unshift(`${player.name} executou ${target.name} instantaneamente!`);
      } else {
        const dmg = getHeroAttackDamage(player, 5, attackBuff, getHeroAttackPenalty(session));
        applyDamageToEnemy(session, target, dmg, card.name, false, player);
        session.log.unshift(`${player.name} usou Execucao em ${target.name} (Brutal) e causou ${dmg} de dano.`);
      }
    }
  }

  if (card.id === "cacada") {
    const enemyDefeatedThisRound = session.players.some((p) => (p.roundStats?.enemiesDefeated || 0) > 0);
    const count = enemyDefeatedThisRound ? 2 : 1;
    const drawn = drawCards(player, count);
    session.log.unshift(`${player.name} jogou Cacada. Como ${enemyDefeatedThisRound ? "um" : "nenhum"} inimigo foi derrotado nesta rodada, comprou ${drawn} carta(s).`);
  }

  if (card.id === "ultima-flecha") {
    const count = player.hand.length;
    if (count > 0) {
      player.discard.push(...player.hand);
      player.hand = [];
      session.log.unshift(`${player.name} descartou toda a mao (${count} cartas) devido ao efeito de Ultima Flecha.`);
    }
  }

  // Vince (Mage) custom cards
  if (card.id === "tempestade-eletrica") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const dmgTarget = getHeroAttackDamage(player, 6, attackBuff, getHeroAttackPenalty(session));
      const dmgOther = getHeroAttackDamage(player, 2, 0, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmgTarget, card.name, false, player);
      const other = session.enemies.find((enemy) => enemy.uid !== target.uid && enemy.life > 0);
      if (other) {
        applyDamageToEnemy(session, other, dmgOther, card.name, false, player);
        session.log.unshift(`${player.name} jogou Tempestade Eletrica! 6 de dano (modificado para ${dmgTarget}) em ${target.name} e 2 de dano (modificado para ${dmgOther}) em ${other.name}.`);
      } else {
        session.log.unshift(`${player.name} jogou Tempestade Eletrica! 6 de dano (modificado para ${dmgTarget}) em ${target.name}.`);
      }
    }
  }

  if (card.id === "manipular-energia") {
    session.pendingEnergyAllocation = { cardUid: card.uid, casterId: player.id };
    session.log.unshift(`${player.name} jogou Manipular Energia. Aguardando escolha de transferencia.`);
  }

  if (card.id === "campo-antimagia") {
    session.activeTrapDisabledRounds = (session.activeTrapDisabledRounds || 0) + 2;
    session.log.unshift(`${player.name} jogou Campo Antimagia. A armadilha ativa ${session.activeTrap ? session.activeTrap.name : ""} foi desativada por 2 rodadas.`);
  }

  if (card.id === "teleporte-arcano") {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    target.energy = Math.min(target.maxEnergy + 2, target.energy + 1);
    const drawn = drawCards(target, 1);
    session.log.unshift(`${player.name} usou Teleporte Arcano: ${target.name} recuperou 1 Energia e comprou ${drawn} carta(s).`);
  }

  if (card.id === "eco-arcano") {
    const eligible = player.played.filter(c => c.id !== "eco-arcano" && c.id !== "cataclismo-arcano");
    if (eligible.length === 0) {
      throw new Error("Voce nao jogou nenhuma carta elegivel nesta rodada ainda.");
    }
    session.pendingEcoArcano = { cardUid: card.uid, casterId: player.id };
    session.log.unshift(`${player.name} jogou Eco Arcano. Escolhendo qual carta copiar.`);
  }

  if (card.id === "distorcao-temporal") {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    session.pendingDistorcaoTemporal = { casterId: player.id, targetId: target.id };
    session.log.unshift(`${player.name} jogou Distorcao Temporal em ${target.name}. Aguardando escolha de carta gratuita.`);
  }
}

function applyHealToHero(session, target, amount, source) {
  if (session.activeTrap?.effect === "noHealing") return;

  if (amount > 0 && target.statusEffects && target.statusEffects.veneno > 0) {
    target.statusEffects.veneno = 0;
    session.log.unshift(`${target.name} foi curado por ${source} e todo o Veneno foi removido.`);
  }

  const before = target.life;
  target.life = Math.min(target.maxLife, target.life + amount);
  const healed = target.life - before;
  if (healed > 0) {
    target.roundStats.healingReceived += healed;
    target.cura_total_recebida_na_partida = (target.cura_total_recebida_na_partida || 0) + healed;
    pushVisualEvent(session, { type: "heal", targetType: "hero", targetId: target.id, amount: healed, source });

    if (session.room?.effect === "bossRoom" && session.boss?.id === "oraculo" && session.boss.fase_atual === 2 && session.boss.life > 0) {
      const oracleBefore = session.boss.life;
      session.boss.life = Math.min(session.boss.maxLife, session.boss.life + healed);
      const oracleHealed = session.boss.life - oracleBefore;
      if (oracleHealed > 0) {
        session.log.unshift(`Drenagem de Alma: Oraculo Corrompido recupera ${oracleHealed} de Vida (absorvido da cura de ${target.name}).`);
        pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: session.boss.uid, amount: oracleHealed, source: "Drenagem de Alma" });
      }
    }
  }
}

function getHeroAttackDamage(player, baseDmg, attackBuff, penalty) {
  const enf = player.statusEffects?.enfraquecido || 0;
  if (enf > 0) {
    return Math.max(1, baseDmg + attackBuff - penalty - enf);
  }
  return Math.max(0, baseDmg + attackBuff - penalty);
}

function resolveHeroAttack(session, player, card, targetId, attackBuff = 0) {
  const target =
    session.enemies.find((enemy) => enemy.uid === targetId && enemy.life > 0) ||
    session.enemies.find((enemy) => enemy.life > 0);
  if (!target) throw new Error("Nao ha monstros vivos para atacar.");

  const totalDamage = getHeroAttackDamage(player, card.damage, attackBuff, getHeroAttackPenalty(session));
  applyDamageToEnemy(session, target, totalDamage, `${player.name} jogou ${card.name}`, Boolean(card.ignoreShield), player);
}

function getHeroAttackPenalty(session) {
  return session.activeTrap?.effect === "heroAttackPenalty" ? 1 : 0;
}

function getCardPlayerTarget(session, player, targetId, card) {
  if (card.target === "ally") {
    return session.players.find((candidate) => candidate.id === targetId && candidate.life > 0) || player;
  }
  return player;
}

function endTurn(session, player) {
  if (session.status !== "playing") throw new Error("A partida ainda nao comecou.");
  if (session.turn !== "players") throw new Error("Agora e o turno da dungeon.");
  if (player.turnEnded) throw new Error("Voce ja finalizou seu turno.");

  player.turnEnded = true;
  session.log.unshift(`${player.name} finalizou o turno.`);
  const activePlayers = session.players.filter((candidate) => candidate.life > 0);
  if (activePlayers.length > 0 && activePlayers.every((candidate) => candidate.turnEnded)) {
    startDungeonTurn(session);
    advanceDungeonTurn(session);
  }
}

function startDungeonTurn(session) {
  session.turn = "dungeon";
  session.dungeonResolved = false;
  session.pendingReaction = null;
  session.dungeonQueue = [];
  session.represaliaChecked = false; // Reset for colossus BOSSCOL-001 Represália check
  const intention = session.activeIntention;
  session.log.unshift(`Turno da dungeon: ${intention.name}.`);

  // Start of Dungeon Phase Boss Passives
  if (session.room?.effect === "bossRoom" && session.boss?.life > 0) {
    if (session.boss.id === "colosso" && session.boss.fase_atual === 1) {
      session.boss.shield += 3;
      session.log.unshift("Blindagem Adaptativa: Colosso ganha 3 de Escudo.");
      pushVisualEvent(session, { type: "shield", targetType: "enemy", targetId: session.boss.uid, amount: 3, source: "Blindagem Adaptativa" });
    } else if (session.boss.id === "oraculo") {
      const before = session.boss.life;
      session.boss.life = Math.min(session.boss.maxLife, session.boss.life + 4);
      const healed = session.boss.life - before;
      if (healed > 0) {
        session.log.unshift(`Regeneracao Sombria: Oraculo Corrompido recupera ${healed} de Vida.`);
        pushVisualEvent(session, { type: "heal", targetType: "enemy", targetId: session.boss.uid, amount: healed, source: "Regeneracao Sombria" });
      }
    }
  }

  if (!isRoomComplete(session)) {
    if (session.room?.effect === "bossRoom") {
      // 1. Queue Commons (minions)
      queueEnemyGroup(session, "common", intention.commonTarget, intention.commonText);
      // 2. Queue Boss
      queueEnemyGroup(session, "boss", intention.commonTarget, intention.commonText);
    } else {
      const brutalsFirst = (session.room.effect === "brutalsFirst" || session.activeTrap?.effect === "brutalsFirst") && session.activeIntention?.id !== "INT_013";
      if (brutalsFirst) {
        queueEnemyGroup(session, "brutal", intention.brutalTarget, intention.brutalText);
        queueEnemyGroup(session, "common", intention.commonTarget, intention.commonText);
      } else {
        queueEnemyGroup(session, "common", intention.commonTarget, intention.commonText);
        queueEnemyGroup(session, "brutal", intention.brutalTarget, intention.brutalText);
      }
    }
  }
}

function queueEnemyGroup(session, category, targetCriterion, ruleText) {
  const enemies = session.enemies.filter((enemy) => enemy.category === category && enemy.life > 0 && !enemy.isStunned);
  enemies.forEach((enemy) => {
    session.dungeonQueue.push({
      type: "enemyAttack",
      enemyUid: enemy.uid,
      category,
      targetCriterion,
      ruleText
    });
  });
}

function advanceDungeonTurn(session) {
  if (session.pendingReaction || session.dungeonResolved) return;

  while (session.dungeonQueue.length > 0) {
    const step = session.dungeonQueue.shift();
    if (step.type !== "enemyAttack") continue;

    const enemy = session.enemies.find((candidate) => candidate.uid === step.enemyUid && candidate.life > 0);
    if (!enemy) continue;
    const forcedTarget = session.players.find((player) => player.id === enemy.forcedTargetId && player.life > 0);
    const target = forcedTarget || selectTarget(session.players, step.targetCriterion);
    if (!target) continue;
    const attack = step.overrideAttack ?? computeEnemyAttack(session, enemy, target, true);
    const isRetaliacaoBrutal = enemy.category === "brutal" && session.activeIntention?.id === "INT_007";
    const isBossReactionImmune = enemy.isBoss && session.bossReactionImmune;
    const isReactionSkipped = isRetaliacaoBrutal || isBossReactionImmune;
    const eligiblePlayerIds = isReactionSkipped ? [] : getReactionEligiblePlayers(session).map((player) => player.id);

    if (eligiblePlayerIds.length > 0) {
      session.pendingReaction = {
        id: randomUUID(),
        enemyUid: enemy.uid,
        enemyName: enemy.name,
        enemyCategory: enemy.category,
        targetId: target.id,
        targetName: target.name,
        attack,
        ruleText: step.ruleText,
        eligiblePlayerIds,
        skippedPlayerIds: []
      };
      session.log.unshift(`${enemy.name} esta prestes a atacar ${target.name} com ${attack} de dano. Reacoes abertas.`);
      return;
    }

    session.log.unshift(`${step.ruleText} Alvo: ${target.name}.`);
    resolveEnemyAttack(session, enemy, target, attack);
  }

  // Check for Colossus BOSSCOL-001 Represália attack before finishing dungeon turn
  if (!session.represaliaChecked) {
    session.represaliaChecked = true;
    if (session.activeIntention?.id === "BOSSCOL-001" && session.boss?.life > 0 && session.boss.shield >= 8) {
      const target = selectTarget(session.players, "minLife");
      if (target) {
        session.dungeonQueue.push({
          type: "enemyAttack",
          enemyUid: session.boss.uid,
          category: "boss",
          targetCriterion: "minLife",
          ruleText: "Esmagamento (Represalia)",
          overrideAttack: 4
        });
        advanceDungeonTurn(session);
        return;
      }
    }
  }

  // Pre-attack Omen check
  if (session.resolvingOmenAttacks) {
    session.resolvingOmenAttacks = false;
    session.pendingReaction = null;
    session.dungeonQueue = [];
    session.turn = "players";
    session.log.unshift("Pre-ataques de Pisoteio resolvidos. Turno dos jogadores iniciado.");
    broadcast(session);
    return;
  }

  finishDungeonTurn(session);
}

function applyQueimaduraTick(session) {
  session.players.forEach((player) => {
    if (player.life > 0 && player.statusEffects?.queimadura?.duration > 0) {
      const q = player.statusEffects.queimadura;
      const damage = q.value;
      player.life = Math.max(0, player.life - damage);
      q.duration -= 1;
      
      pushVisualEvent(session, {
        type: "damage",
        targetType: "hero",
        targetId: player.id,
        amount: damage,
        source: "Queimadura"
      });
      session.log.unshift(`Queimadura causou ${damage} de dano em ${player.name} (ignora Escudo). Duração restante: ${q.duration} rodadas.`);
      
      if (player.life === 0) {
        session.heroDefeatedThisRound = true;
        session.log.unshift(`${player.name} sucumbiu à Queimadura.`);
      }
    }
  });

  session.enemies.forEach((enemy) => {
    if (enemy.life > 0 && enemy.statusEffects?.queimadura?.duration > 0) {
      const q = enemy.statusEffects.queimadura;
      const damage = q.value;
      enemy.life = Math.max(0, enemy.life - damage);
      q.duration -= 1;
      
      pushVisualEvent(session, {
        type: "damage",
        targetType: "enemy",
        targetId: enemy.uid,
        amount: damage,
        source: "Queimadura"
      });
      session.log.unshift(`Queimadura causou ${damage} de dano em ${enemy.name} (ignora Escudo). Duração restante: ${q.duration} rodadas.`);
      
      if (enemy.life === 0) {
        session.log.unshift(`${enemy.name} sucumbiu à Queimadura.`);
        applyRoomReward(session);
      }
    }
  });
}

function finishDungeonTurn(session) {
  applyIntentionRepresalia(session);
  applyEndOfDungeonEffects(session);
  applyQueimaduraTick(session);
  applyRoomReward(session);

  session.dungeonResolved = true;
  session.pendingReaction = null;
  session.dungeonQueue = [];
  session.log.unshift("Turno da dungeon resolvido. Os jogadores podem iniciar a proxima rodada.");
}

function getReactionEligiblePlayers(session) {
  return session.players.filter(
    (player) => player.life > 0 && player.hand.some((card) => card.type === "reaction")
  );
}

function skipReaction(session, player) {
  const pending = session.pendingReaction;
  if (!pending) throw new Error("Nao ha reacao pendente.");
  if (!pending.eligiblePlayerIds.includes(player.id)) throw new Error("Voce nao tem reacao disponivel para este ataque.");
  if (!pending.skippedPlayerIds.includes(player.id)) pending.skippedPlayerIds.push(player.id);
  session.log.unshift(`${player.name} nao usou reacao.`);

  const remaining = pending.eligiblePlayerIds.filter((id) => !pending.skippedPlayerIds.includes(id));
  if (remaining.length === 0) {
    resolvePendingReactionAttack(session);
    advanceDungeonTurn(session);
  }
}

function playReaction(session, player, payload) {
  const pending = session.pendingReaction;
  if (!pending) throw new Error("Nao ha reacao pendente.");
  if (!pending.eligiblePlayerIds.includes(player.id)) throw new Error("Voce nao tem reacao disponivel para este ataque.");

  const cardIndex = player.hand.findIndex((card) => card.uid === payload.cardUid && card.type === "reaction");
  if (cardIndex === -1) throw new Error("Carta de reacao nao encontrada na mao.");
  const card = player.hand[cardIndex];
  if (player.energy < card.cost) throw new Error("Energia insuficiente para a reacao.");

  player.hand.splice(cardIndex, 1);
  player.energy -= card.cost;
  player.roundStats.energySpent += card.cost;
  player.roundStats.cardsPlayed += 1;
  player.played.push(card);
  session.arena.unshift({
    uid: card.uid,
    heroId: card.heroId,
    name: card.name,
    type: card.type,
    cost: card.cost,
    intercept: card.intercept,
    reflect: card.reflect,
    text: card.text,
    playedBy: player.name
  });

  const enemy = session.enemies.find((candidate) => candidate.uid === pending.enemyUid && candidate.life > 0);
  const target = session.players.find((candidate) => candidate.id === pending.targetId && candidate.life > 0);
  session.pendingReaction = null;

  if (!enemy || !target) {
    session.log.unshift(`${player.name} usou ${card.name}, mas o ataque nao tinha mais alvo valido.`);
    advanceDungeonTurn(session);
    return;
  }

  if (card.intercept) {
    session.log.unshift(`${player.name} usou ${card.name} e interceptou o ataque contra ${target.name}.`);
    applyDamageToHero(session, player, pending.attack, enemy.name, enemy, { skipRedirect: true });
    advanceDungeonTurn(session);
    return;
  }

  if (card.reflect) {
    player.reflectDamage = Math.max(player.reflectDamage || 0, card.reflect);
    session.log.unshift(`${player.name} usou ${card.name} e recebeu Refletir ${card.reflect}.`);
  } else {
    session.log.unshift(`${player.name} usou ${card.name}.`);
  }

  resolveEnemyAttack(session, enemy, target, pending.attack);
  advanceDungeonTurn(session);
}

function resolvePendingReactionAttack(session) {
  const pending = session.pendingReaction;
  if (!pending) return;
  const enemy = session.enemies.find((candidate) => candidate.uid === pending.enemyUid && candidate.life > 0);
  const target = session.players.find((candidate) => candidate.id === pending.targetId && candidate.life > 0);
  session.pendingReaction = null;
  if (!enemy || !target) return;
  session.log.unshift(`${enemy.name} atacou ${target.name}.`);
  resolveEnemyAttack(session, enemy, target, pending.attack);
}

function selectTarget(players, criterion) {
  if (criterion && criterion.startsWith("fixedPlayer_")) {
    const targetId = criterion.split("_")[1];
    return players.find(p => p.id === targetId && p.life > 0);
  }
  const active = players.filter((player) => player.life > 0);
  if (active.length === 0) return null;

  return [...active].sort((a, b) => {
    const primary = compareCriterion(a, b, criterion);
    if (primary !== 0) return primary;
    return universalTieBreak(a, b, players);
  })[0];
}

function compareCriterion(a, b, criterion) {
  const direction = criterion.startsWith("max") ? -1 : 1;
  const diff = getCriterionValue(a, criterion) - getCriterionValue(b, criterion);
  if (diff === 0) return 0;
  return diff * direction;
}

function getCriterionValue(player, criterion) {
  const values = {
    maxLife: player.life,
    minLife: player.life,
    maxShield: player.shield,
    minShield: player.shield,
    maxEnergy: player.energy,
    minEnergy: player.energy,
    maxHand: player.hand.length,
    minHand: player.hand.length,
    maxEnergySpent: player.roundStats.energySpent,
    maxHealingReceived: player.roundStats.healingReceived,
    maxDamageDealt: player.roundStats.damageDealt,
    maxEnemiesDefeated: player.roundStats.enemiesDefeated,
    maxAttackCardsPlayed: player.roundStats.attackCardsPlayed,
    maxCardsPlayed: player.roundStats.cardsPlayed,
    minCardsPlayed: player.roundStats.cardsPlayed,
    maxDamageTaken: player.roundStats.damageTaken,
    maxEnergyAtStartOfRound: player.energyAtStartOfRound || 0,
    maxShieldReceived: player.roundStats.shieldReceived || 0,
    maxCardsDefensePlayed: player.roundStats.cardsDefensePlayed || 0,
    maxCuraTotalRecebida: player.cura_total_recebida_na_partida || 0
  };
  return values[criterion] ?? 0;
}

function universalTieBreak(a, b, allPlayers) {
  if (a.life !== b.life) return a.life - b.life;
  if (a.shield !== b.shield) return a.shield - b.shield;
  if (a.hand.length !== b.hand.length) return a.hand.length - b.hand.length;
  return allPlayers.indexOf(a) - allPlayers.indexOf(b);
}

function getEnemyCurrentTarget(session, enemy) {
  if (session.status !== "playing" || !session.activeIntention || enemy.life <= 0) {
    return null;
  }
  const forcedTarget = session.players.find((player) => player.id === enemy.forcedTargetId && player.life > 0);
  if (forcedTarget) return forcedTarget;

  const criterion = enemy.category === "brutal"
    ? session.activeIntention.brutalTarget
    : session.activeIntention.commonTarget;

  if (!criterion) return null;

  return selectTarget(session.players, criterion);
}

function computeEnemyAttack(session, enemy, target, commitFirstBonus) {
  const forcedTarget = session.players.find((player) => player.id === enemy.forcedTargetId && player.life > 0);
  if (forcedTarget) target = forcedTarget;
  let attack = enemy.attack;
  if (enemy.isEnfurecido && enemy.life <= enemy.maxLife / 2) {
    attack += 2;
  }
  if (session.activeIntention?.id === "INT_003") {
    attack += 1;
  }
  if (session.room.effect === "commonBonusAtThreeEnemies" && enemy.category === "common" && aliveEnemyCount(session) >= 3) {
    attack += 1;
  }
  if (session.room.effect === "brutalBonusVsNoShield" && enemy.category === "brutal" && target.shield === 0) {
    attack += 1;
  }
  if (session.activeTrap?.effect === "commonAttackBonus" && enemy.category === "common") attack += 1;
  if (session.activeTrap?.effect === "brutalAttackBonus" && enemy.category === "brutal") attack += 1;
  if (session.activeTrap?.effect === "allAttackBonusAtThreeEnemies" && aliveEnemyCount(session) >= 3) attack += 1;
  if (
    !session.firstEnemyDamageApplied &&
    (session.room.effect === "firstEnemyDamageBonus" || session.activeTrap?.effect === "firstEnemyDamageBonus")
  ) {
    attack += 1;
    if (commitFirstBonus) session.firstEnemyDamageApplied = true;
  }

  // Apply Enfraquecido to monster attack calculation
  if (enemy.statusEffects?.enfraquecido > 0) {
    const enf = enemy.statusEffects.enfraquecido;
    attack = Math.max(1, attack - enf);
  }

  return attack;
}

function resolveEnemyAttack(session, enemy, target, overrideAttack = null) {
  const forcedTarget = session.players.find((player) => player.id === enemy.forcedTargetId && player.life > 0);
  if (forcedTarget) target = forcedTarget;
  const attack = overrideAttack ?? computeEnemyAttack(session, enemy, target, true);
  const damage = applyDamageToHero(session, target, attack, enemy.name, enemy);

  if (enemy.isBoss && enemy.id === "colosso") {
    if (session.activeIntention?.id === "BOSSCOL-002" && damage > 0) {
      session.colossoTargetDamaged = target;
    }
    if (enemy.fase_atual === 2 && !enemy.isResolvingDoubleDevastation) {
      enemy.isResolvingDoubleDevastation = true;
      const ddTarget = selectTarget(session.players, "minShield");
      if (ddTarget) {
        session.log.unshift(`Dupla Devastacao: ${enemy.name} realiza segundo ataque de 5 de dano fixo contra ${ddTarget.name}.`);
        applyDamageToHero(session, ddTarget, 5, "Dupla Devastacao", enemy, { skipRedirect: true });
        session.doubleDevastationTarget = ddTarget;
      }
      enemy.isResolvingDoubleDevastation = false;
    }
  }

  // Consume Enfraquecido status if any
  if (enemy.statusEffects?.enfraquecido > 0) {
    session.log.unshift(`${enemy.name} consumiu o status Enfraquecido.`);
    enemy.statusEffects.enfraquecido = 0;
  }

  // Peçonhenta trigger
  if (damage > 0 && enemy.keywords?.includes("Peçonhenta")) {
    if (target.statusEffects) {
      target.statusEffects.veneno = (target.statusEffects.veneno || 0) + 1;
      session.log.unshift(`Peçonhenta: ${enemy.name} aplicou Veneno 1 em ${target.name}.`);
    }
  }

  // Paralisante trigger
  if (damage > 0 && enemy.keywords?.includes("Paralisante")) {
    if (target.statusEffects) {
      target.statusEffects.vacuo = true;
      session.log.unshift(`Paralisante: ${enemy.name} aplicou Vácuo em ${target.name}.`);
    }
  }

  if (damage > 0 && session.activeTrap?.effect === "splashLowestLife") {
    const splashTarget = selectTarget(
      session.players.filter((player) => player.id !== target.id),
      "minLife"
    );
    if (splashTarget) applyDamageToHero(session, splashTarget, 1, session.activeTrap.name);
  }
}

function aliveEnemyCount(session) {
  return session.enemies.filter((enemy) => enemy.life > 0).length;
}

function applyEndOfDungeonEffects(session) {
  if (isRoomComplete(session)) return;

  if (session.room.effect === "endRoundDamageIfTwoEnemies" && aliveEnemyCount(session) >= 2) {
    session.players.forEach((player) => applyDamageToHero(session, player, 1, session.room.name));
  }
  if (session.room.effect === "endRoundLowestLifeDamage") {
    const target = selectTarget(session.players, "minLife");
    if (target) applyDamageToHero(session, target, 1, session.room.name);
  }
  if (session.activeTrap?.effect === "endDungeonAllDamage") {
    session.players.forEach((player) => applyDamageToHero(session, player, 1, session.activeTrap.name));
  }
  if (session.activeTrap?.effect === "endRoundLowestLifeDamage") {
    const target = selectTarget(session.players, "minLife");
    if (target) applyDamageToHero(session, target, 1, session.activeTrap.name);
  }
  if (session.activeTrap?.effect === "endDungeonDamageIfTwoEnemies" && aliveEnemyCount(session) >= 2) {
    session.players.forEach((player) => applyDamageToHero(session, player, 1, session.activeTrap.name));
  }
}

function sanitizeSession(session, viewerId) {
  return {
    id: session.id,
    status: session.status,
    turn: session.turn,
    dungeonResolved: session.dungeonResolved,
    round: session.round,
    roomRound: session.roomRound,
    roomNumber: session.roomNumber || 1,
    roomComplete: isRoomComplete(session),
    allRewardsClaimed: session.players.every((p) => p.life <= 0 || p.hasClaimedRoomReward),
    heroes: Object.values(heroes).map(({ deck, ...hero }) => hero),
    heroCards: Object.keys(heroes).reduce((acc, heroId) => {
      const hero = heroes[heroId];
      const deckCards = hero.deck.map(([cardId]) => cards[cardId]);
      const supremeCard = hero.supreme ? cards[hero.supreme] : null;
      const allUniqueCards = [];
      const seen = new Set();
      if (supremeCard) {
        allUniqueCards.push(supremeCard);
        seen.add(supremeCard.id);
      }
      deckCards.forEach(card => {
        if (card && !seen.has(card.id)) {
          allUniqueCards.push(card);
          seen.add(card.id);
        }
      });
      acc[heroId] = allUniqueCards;
      return acc;
    }, {}),
    roomCards: roomCards,
    trapCards: trapCards,
    intentionCards: intentionCards,
    room: session.room,
    enemies: session.enemies.map(enemy => {
      const target = getEnemyCurrentTarget(session, enemy);
      return {
        ...enemy,
        name: (enemy.isEnfurecido && enemy.life <= enemy.maxLife / 2) ? `${enemy.name} (Enfurecido)` : enemy.name,
        currentTargetName: target ? target.name : null,
        currentTargetHeroId: target ? target.heroId : null
      };
    }),
    activeTrap: session.activeTrap,
    revealedNextTrap: session.revealedNextTrap,
    roomDeckCount: session.roomDeck.length,
    trapDeckCount: session.trapDeck.length,
    activeIntention: session.activeIntention,
    intentionDeckCount: session.intentionDeck.length,
    intentionDiscardCount: session.intentionDiscard.length,
    pendingReaction: session.pendingReaction,
    pendingShieldAllocation: session.pendingShieldAllocation,
    pendingEnergyAllocation: session.pendingEnergyAllocation,
    pendingEcoArcano: session.pendingEcoArcano,
    pendingDistorcaoTemporal: session.pendingDistorcaoTemporal,
    activeTrapDisabledRounds: session.activeTrapDisabledRounds || 0,
    bossSelectOptions: session.bossSelectOptions || [],
    activeTorment: session.activeTorment || null,
    maldicao_contador: session.maldicao_contador !== undefined ? session.maldicao_contador : null,
    revealedNextIntentionCards: session.revealedNextIntentionCards || null,
    visualEvents: session.visualEvents.slice(-30),
    arena: session.arena,
    log: session.log.slice(0, 16),
    players: session.players.map((player) => ({
      id: player.id,
      name: player.name,
      heroId: player.heroId,
      heroName: player.heroId ? heroes[player.heroId].name : null,
      ready: player.ready,
      turnEnded: player.turnEnded,
      maxLife: player.maxLife,
      life: player.life,
      maxEnergy: player.maxEnergy,
      energy: player.energy,
      shield: player.shield,
      statusEffects: player.statusEffects,
      roundStats: player.roundStats,
      deckCount: player.deck.length,
      handCount: player.hand.length,
      discardCount: player.discard.length,
      played: player.played,
      supremeCard: player.id === viewerId ? player.supremeCard : null,
      supremeUsed: player.supremeUsed,
      pendingDiscard: player.id === viewerId ? (player.pendingDiscard || 0) : 0,
      maxHandSize: player.maxHandSize || 5,
      chosenRewards: player.chosenRewards || [],
      hasClaimedRoomReward: player.hasClaimedRoomReward || false,
      hasRedrawAvailable: player.hasRedrawAvailable || false,
      hand: player.id === viewerId ? player.hand : []
    }))
  };
}

function getViewerId(session, url) {
  const playerId = url.searchParams.get("playerId");
  const token = url.searchParams.get("token");
  const player = session.players.find((candidate) => candidate.id === playerId);
  return player?.token === token ? player.id : null;
}

function broadcast(session) {
  const clients = subscribers.get(session.id);
  if (!clients) return;
  clients.forEach((client) => {
    client.write(`event: state\n`);
    client.write(`data: ${JSON.stringify(sanitizeSession(session, client.viewerId))}\n\n`);
  });
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    res.end(file);
  } catch {
    const file = await readFile(join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": contentTypes[".html"] });
    res.end(file);
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    if (req.method === "GET" && parts[0] === "api" && parts[1] === "health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && parts[0] === "api" && parts[1] === "cards") {
      const heroesList = Object.values(heroes).map(({ deck, ...hero }) => hero);
      const heroCardsMap = Object.keys(heroes).reduce((acc, heroId) => {
        const hero = heroes[heroId];
        const deckCards = hero.deck.map(([cardId]) => cards[cardId]);
        const supremeCard = hero.supreme ? cards[hero.supreme] : null;
        const allUniqueCards = [];
        const seen = new Set();
        if (supremeCard) {
          allUniqueCards.push(supremeCard);
          seen.add(supremeCard.id);
        }
        deckCards.forEach(card => {
          if (card && !seen.has(card.id)) {
            allUniqueCards.push(card);
            seen.add(card.id);
          }
        });
        acc[heroId] = allUniqueCards;
        return acc;
      }, {});

      json(res, 200, {
        roomCards,
        trapCards,
        intentionCards,
        heroes: heroesList,
        heroCards: heroCardsMap
      });
      return;
    }

    if (req.method === "POST" && parts[0] === "api" && parts[1] === "sessions" && parts.length === 2) {
      const body = await readJson(req);
      const session = createSession();
      const player = addPlayer(session, body.name);
      broadcast(session);
      json(res, 201, { sessionId: session.id, playerId: player.id, token: player.token });
      return;
    }

    if (parts[0] === "api" && parts[1] === "sessions" && parts[2]) {
      const session = sessions.get(parts[2].toUpperCase());
      if (!session) throw new Error("Sala nao encontrada.");

      if (req.method === "GET" && parts.length === 3) {
        json(res, 200, sanitizeSession(session, getViewerId(session, url)));
        return;
      }

      if (req.method === "GET" && parts[3] === "events") {
        const viewerId = getViewerId(session, url);
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive"
        });
        res.write(`event: state\n`);
        res.write(`data: ${JSON.stringify(sanitizeSession(session, viewerId))}\n\n`);

        const client = { res, write: res.write.bind(res), viewerId };
        subscribers.get(session.id).add(client);
        req.on("close", () => subscribers.get(session.id)?.delete(client));
        return;
      }

      if (req.method === "POST" && parts[3] === "join") {
        const body = await readJson(req);
        const player = addPlayer(session, body.name);
        broadcast(session);
        json(res, 201, { sessionId: session.id, playerId: player.id, token: player.token });
        return;
      }

      if (req.method === "POST" && parts[3] === "action") {
        const body = await readJson(req);
        const player = getPlayer(session, body.playerId, body.token);

        if (body.type === "chooseHero") {
          if (!heroes[body.heroId]) throw new Error("Heroi invalido.");
          if (session.status !== "lobby") throw new Error("A partida ja comecou.");
          player.heroId = body.heroId;
          player.ready = false;
          session.log.unshift(`${player.name} escolheu ${heroes[body.heroId].name}.`);
        } else if (body.type === "ready") {
          if (!player.heroId) throw new Error("Escolha um heroi antes.");
          player.ready = Boolean(body.ready);
          session.log.unshift(`${player.name} ${player.ready ? "esta pronto" : "nao esta pronto"}.`);
        } else if (body.type === "start") {
          startGame(session);
        } else if (body.type === "selectBoss") {
          if (session.status !== "boss_selection") throw new Error("Acao invalida neste momento.");
          const chosenBossTemplate = session.bossSelectOptions.find(b => b.id === body.bossId);
          if (!chosenBossTemplate) throw new Error("Chefe escolhido nao e uma das opcoes.");

          // 1. Instantiate the boss
          session.boss = {
            uid: randomUUID(),
            ...chosenBossTemplate,
            life: chosenBossTemplate.maxLife,
            shield: chosenBossTemplate.shield,
            fase_atual: 1,
            transicao_ocorrida: false,
            isBoss: true
          };
          session.enemies = [session.boss];

          // 2. Prepare Boss Intention Deck
          const bossIntentions = bossIntentionCards[body.bossId].map(card => ({
            ...card,
            uid: randomUUID(),
            presagioText: card.presagioText,
            commonText: card.commonText,
            brutalText: card.commonText, // same target/text for brutal to avoid errors
            brutalTarget: card.commonTarget,
            represaliaText: card.represaliaText
          }));
          session.intentionDeck = shuffle(bossIntentions);
          session.intentionDiscard = [];
          session.activeIntention = null;

          // 3. Draw 1 Torment out of 5
          session.activeTorment = shuffle(tormentCards)[0];
          session.log.unshift(`Tormento ativo sorteado: ${session.activeTorment.name} (${session.activeTorment.text})`);

          // 4. Set special Room 4 card
          session.room = {
            id: "SALA_BOSS",
            name: "Camara do Chefe: " + chosenBossTemplate.name,
            subtitle: "Confronte o Mal Supremo",
            theme: "sanctum",
            setup: { common: 0, brutal: 0 },
            objective: "Derrote o chefe para vencer a dungeon.",
            rule: "Sem composicoes normais ou ambientes. Regras exclusivas ativas.",
            reward: "",
            effect: "bossRoom"
          };

          // 5. Initialize boss specific counters
          if (body.bossId === "bruxa") {
            session.maldicao_contador = 5;
            session.witchPhase2Rounds = 0;
          }
          session.doubleDevastationTarget = null;
          session.bossStunImmune = false;
          session.bossRedirectImmune = false;
          session.colossoTargetDamaged = null;
          session.bossNextAttackBonus = 0;
          session.oracleMirrorHealedThisRound = false;
          session.dano_total_causado_ao_boss = 0;
          session.heroDefeatedThisRound = false;

          // Track total healing for all players (reset at boss start, but accumulates)
          session.players.forEach(p => {
            p.cura_total_recebida_na_partida = 0;
            p.roundStats.cardsDefensePlayed = 0;
          });

          session.status = "playing";
          session.turn = "players";
          session.roomRound = 1;

          // Clean old round state
          session.players.forEach((player) => {
            player.discard.push(...player.played);
            player.played = [];
            player.energy = player.maxEnergy;
            player.shield = 0;
            player.protectingId = null;
            player.interceptReady = false;
            player.reflectDamage = 0;
            player.reduceDamage = 0;
            player.nextAttackBonus = 0;
            player.bastiaoSupremoActive = false;
            player.turnEnded = player.life <= 0;
            player.roundStats = makeRoundStats();
            player.hand = [];
            drawCards(player, 5);
          });

          session.players.forEach((p) => { p.energyAtStartOfRound = p.energy; });
          session.heroDefeatedThisRound = false;
          session.revealedNextTrap = null;
          session.nextDrawReduction = 0;
          session.skipNextDraw = false;

          drawIntention(session);
          applyIntentionPresagio(session);
          applyStartOfRoundEffects(session);

          session.log.unshift(`[Sala 4] A batalha contra ${chosenBossTemplate.name} comecou!`);
        } else if (body.type === "rematch") {
          session.status = "lobby";
          session.round = 0;
          session.roomRound = 0;
          session.roomNumber = 0;
          session.enemies = [];
          session.boss = null;
          session.activeTorment = null;
          session.maldicao_contador = null;
          session.revealedNextIntentionCards = null;
          session.log = ["A partida foi resetada. Sejam bem-vindos de volta ao lobby!"];
          session.players.forEach(p => {
            p.ready = false;
            p.life = 15; // default max life
            p.shield = 0;
            p.energy = 3; // default max energy
            p.deck = [];
            p.hand = [];
            p.played = [];
            p.discard = [];
            p.roundStats = makeRoundStats();
            p.chosenRewards = [];
            p.hasClaimedRoomReward = false;
            p.hasRedrawAvailable = false;
            p.statusEffects = makeStatusEffects();
            p.heroId = null;
          });
          session.roomDeck = [];
          session.trapDeck = [];
          session.intentionDeck = [];
          session.intentionDiscard = [];
          session.activeTrap = null;
          session.activeIntention = null;
          session.arena = [];
          session.visualEvents = [];
          session.log.unshift(`${player.name} solicitou reinício do jogo.`);
        } else if (body.type === "startNextRound" || body.type === "newRound") {
          startNextRound(session);
        } else if (body.type === "playCard") {
          playCard(session, player, body);
        } else if (body.type === "buyCard") {
          if (session.status !== "playing") throw new Error("A partida ainda nao comecou.");
          if (session.turn !== "players") throw new Error("Agora e o turno da dungeon.");
          if (player.turnEnded) throw new Error("Voce ja finalizou seu turno.");
          const maxHand = player.maxHandSize || 5;
          if (player.hand.length >= maxHand) throw new Error("Mao cheia! O limite maximo e de " + maxHand + " cartas.");
          if (player.energy < 1) throw new Error("Energia insuficiente para comprar carta.");

          const isTrapActive = session.activeTrap && !(session.activeTrapDisabledRounds && session.activeTrapDisabledRounds > 0);
          if (session.room.effect === "noDangerDrawWhileTrap" && isTrapActive) {
            throw new Error("Regra da Sala: Herois nao podem comprar cartas usando Energia enquanto a Armadilha estiver ativa.");
          }

          player.energy -= 1;
          const drawn = drawCards(player, 1);
          if (drawn === 0) {
            player.energy += 1;
            throw new Error("Nao ha cartas restantes no deck ou descarte.");
          }
          session.log.unshift(`${player.name} pagou 1 de Energia para comprar 1 carta.`);
        } else if (body.type === "playReaction") {
          playReaction(session, player, body);
        } else if (body.type === "skipReaction") {
          skipReaction(session, player);
        } else if (body.type === "endTurn") {
          endTurn(session, player);
        } else if (body.type === "useSupreme") {
          // Play the hero's supreme card (not in hand/deck, separate slot)
          if (!player.supremeCard) throw new Error("Voce nao possui carta suprema.");
          if (player.supremeUsed) throw new Error("A Carta Suprema ja foi usada nesta partida.");
          if (session.status !== "playing") throw new Error("A partida ainda nao comecou.");
          if (session.turn !== "players") throw new Error("Agora e o turno da dungeon.");
          if (player.turnEnded) throw new Error("Voce ja finalizou seu turno.");
          const sc = player.supremeCard;
          player.supremeUsed = true;
          player.roundStats.cardsPlayed += 1;
          session.arena.unshift({ uid: sc.uid, heroId: player.heroId, name: sc.name, type: sc.type, cost: sc.cost, text: sc.text, playedBy: player.name + " (Suprema)" });
          // Execute supreme effects directly
          if (sc.supremeEffects) {
            session.players.filter((ally) => ally.life > 0).forEach((ally) => {
              applyHealToHero(session, ally, 5, sc.name);
              ally.shield += 5;
              ally.roundStats.shieldReceived = (ally.roundStats.shieldReceived || 0) + 5;
              ally.energy = Math.min(ally.maxEnergy + 2, ally.energy + 2);
              pushVisualEvent(session, { type: "shield", targetType: "hero", targetId: ally.id, amount: 5, source: sc.name });
              drawCards(ally, 1);
            });
            session.log.unshift(`${player.name} usou ${sc.name}! Todos receberam Cura 5, Escudo 5, Energia +2 e compraram 1 carta.`);
          } else if (sc.id === "tempestade-de-flechas") {
            const targets = session.enemies.filter((enemy) => enemy.life > 0);
            const penalty = getHeroAttackPenalty(session);
            const dmgAll = getHeroAttackDamage(player, 6, 0, penalty);
            const dmgSingle = getHeroAttackDamage(player, 8, 0, penalty);
            // 6 area damage
            targets.forEach((enemy) =>
              applyDamageToEnemy(session, enemy, dmgAll, sc.name, false, player)
            );
            // 8 single target damage to highest current life enemy
            const aliveTargets = session.enemies.filter((enemy) => enemy.life > 0);
            let singleTarget = null;
            if (aliveTargets.length > 0) {
              aliveTargets.sort((a, b) => b.life - a.life);
              singleTarget = aliveTargets[0];
              applyDamageToEnemy(session, singleTarget, dmgSingle, sc.name, false, player);
            }
            session.log.unshift(`${player.name} usou ${sc.name}! Causou 6 de dano (modificado para ${dmgAll}) em todos os inimigos e 8 de dano adicional (modificado para ${dmgSingle}) em ${singleTarget ? singleTarget.name : "nenhum inimigo"}.`);
            
            // Consume Enfraquecido
            if (player.statusEffects && player.statusEffects.enfraquecido > 0) {
              session.log.unshift(`${player.name} consumiu o status Enfraquecido (redução de ${player.statusEffects.enfraquecido} no dano).`);
              player.statusEffects.enfraquecido = 0;
            }
          } else if (sc.id === "bastiao-supremo") {
            player.shield += 8;
            player.roundStats.shieldReceived = (player.roundStats.shieldReceived || 0) + 8;
            player.bastiaoSupremoActive = true;
            pushVisualEvent(session, { type: "shield", targetType: "hero", targetId: player.id, amount: 8, source: sc.name });
            session.log.unshift(`${player.name} usou ${sc.name}! Recebeu 8 de Escudo, redirecionara todo o dano aliado a si mesmo e reduzira todo o dano sofrido pela metade ate a proxima rodada.`);
          } else if (sc.id === "cataclismo-arcano") {
            const targets = session.enemies.filter((enemy) => enemy.life > 0);
            targets.forEach((enemy) =>
              applyDamageToEnemy(session, enemy, Math.max(0, 6 - getHeroAttackPenalty(session)), sc.name, false, player)
            );
            session.players.filter((ally) => ally.life > 0).forEach((ally) => {
              ally.energy = Math.min(ally.maxEnergy + 2, ally.energy + 2);
            });
            session.activeTrapDisabledRounds = 1;
            const brutal = session.enemies.find((enemy) => enemy.category === "brutal" && enemy.life > 0);
            if (brutal) {
              brutal.isStunned = true;
              session.log.unshift(`${player.name} usou Cataclismo Arcano! Causou 6 de dano em todos os inimigos, concedeu +2 de Energia para todos os aliados, atordoou ${brutal.name} e desativou as armadilhas nesta rodada.`);
            } else {
              session.log.unshift(`${player.name} usou Cataclismo Arcano! Causou 6 de dano em todos os inimigos, concedeu +2 de Energia para todos os aliados e desativou as armadilhas nesta rodada.`);
            }
          }
        } else if (body.type === "discardCard") {
          // Resolve a pending discard (from planejamento)
          if (!(player.pendingDiscard > 0)) throw new Error("Nao ha descarte pendente.");
          const idx = player.hand.findIndex((c) => c.uid === body.cardUid);
          if (idx === -1) throw new Error("Carta nao encontrada na mao.");
          player.discard.push(player.hand.splice(idx, 1)[0]);
          player.pendingDiscard -= 1;
          session.log.unshift(`${player.name} descartou uma carta.`);
        } else if (body.type === "confirmShieldAllocation") {
          // Resolve escudo-compartilhado or redistribuir-escudos
          if (!session.pendingShieldAllocation) throw new Error("Nao ha redistribuicao de escudos pendente.");
          const allocation = body.allocation; // { playerId: amount, ... }
          if (!allocation) throw new Error("Alocacao de escudos ausente.");
          const totalAvailable = session.pendingShieldAllocation.totalShield ??
            session.players.reduce((s, p) => s + p.shield, 0);
          const totalAssigned = Object.values(allocation).reduce((s, v) => s + Number(v), 0);
          if (totalAssigned > totalAvailable) throw new Error("Escudos alocados excedem o total disponivel.");
          // Clear all shields then assign
          session.players.forEach((p) => { p.shield = 0; });
          Object.entries(allocation).forEach(([pid, amount]) => {
            const target = session.players.find((p) => p.id === pid);
            if (target) {
              const val = Number(amount);
              target.shield = val;
              if (val > 0) {
                target.roundStats.shieldReceived = (target.roundStats.shieldReceived || 0) + val;
                pushVisualEvent(session, { type: "shield", targetType: "hero", targetId: pid, amount: val, source: "Escudo redistribuido" });
              }
            }
          });
          session.pendingShieldAllocation = null;
          session.log.unshift(`${player.name} redistribuiu os escudos entre os aliados.`);
        } else if (body.type === "confirmEnergyAllocation") {
          if (!session.pendingEnergyAllocation) throw new Error("Nao ha transferencia de energia pendente.");
          const alloc = body.allocation; // { fromId, toId, amount }
          if (!alloc || !alloc.fromId || !alloc.toId || !alloc.amount) {
            throw new Error("Dados de alocacao de energia invalidos.");
          }
          const fromPlayer = session.players.find(p => p.id === alloc.fromId);
          const toPlayer = session.players.find(p => p.id === alloc.toId);
          if (!fromPlayer || !toPlayer) throw new Error("Jogadores de origem ou destino nao encontrados.");
          if (fromPlayer.energy < alloc.amount) throw new Error("A origem nao possui energia suficiente.");
          if (alloc.amount > 2) throw new Error("Limite maximo de 2 de Energia para transferencia.");
          
          fromPlayer.energy -= alloc.amount;
          toPlayer.energy = Math.min(toPlayer.maxEnergy + 2, toPlayer.energy + alloc.amount);
          session.pendingEnergyAllocation = null;
          session.log.unshift(`${player.name} transferiu ${alloc.amount}⚡ de ${fromPlayer.name} para ${toPlayer.name}.`);
        } else if (body.type === "confirmEcoArcano") {
          if (!session.pendingEcoArcano) throw new Error("Nao ha Eco Arcano pendente.");
          if (session.pendingEcoArcano.casterId !== player.id) throw new Error("Apenas o conjurador do Eco Arcano pode responder.");
          const copiedCardId = body.copiedCardId;
          const targetId = body.targetId;
          if (!copiedCardId) throw new Error("Selecione uma carta para copiar.");
          
          const copiedCard = cards[copiedCardId];
          if (!copiedCard) throw new Error("Carta copiada nao encontrada.");
          if (copiedCard.id === "eco-arcano" || copiedCard.id === "cataclismo-arcano") {
            throw new Error("Eco Arcano nao pode copiar a si mesma ou cartas supremas.");
          }
          
          session.pendingEcoArcano = null;
          session.log.unshift(`${player.name} usou Eco Arcano para repetir os efeitos de ${copiedCard.name}!`);
          executeCardEffects(session, player, copiedCard, { targetId }, 0);
        } else if (body.type === "cancelEcoArcano") {
          if (!session.pendingEcoArcano) throw new Error("Nao ha Eco Arcano pendente.");
          if (session.pendingEcoArcano.casterId !== player.id) throw new Error("Apenas o conjurador pode cancelar.");
          session.pendingEcoArcano = null;
          session.log.unshift(`${player.name} cancelou o efeito do Eco Arcano.`);
        } else if (body.type === "skipDistorcaoTemporal") {
          if (!session.pendingDistorcaoTemporal) throw new Error("Nao ha Distorcao Temporal pendente.");
          if (session.pendingDistorcaoTemporal.targetId !== player.id) throw new Error("Apenas o alvo da Distorcao Temporal pode pular.");
          session.pendingDistorcaoTemporal = null;
          session.log.unshift(`${player.name} decidiu pular a acao extra da Distorcao Temporal.`);
        } else if (body.type === "selectRoomReward") {
          if (session.status !== "playing") throw new Error("A partida ainda nao comecou.");
          if (!isRoomComplete(session)) throw new Error("A sala ainda nao foi concluida.");
          if (player.hasClaimedRoomReward) throw new Error("Voce ja escolheu sua recompensa para esta sala.");

          const rewardId = body.rewardId;
          if (rewardId) {
            if (!["energy", "handSize", "redraw"].includes(rewardId)) throw new Error("Recompensa invalida.");
            if (!player.chosenRewards) player.chosenRewards = [];
            if (player.chosenRewards.includes(rewardId)) throw new Error("Recompensa ja escolhida anteriormente.");
            
            player.chosenRewards.push(rewardId);
            if (rewardId === "energy") {
              player.maxEnergy += 1;
              player.energy = player.maxEnergy;
            } else if (rewardId === "handSize") {
              player.maxHandSize = (player.maxHandSize || 5) + 1;
            } else if (rewardId === "redraw") {
              player.justChoseRedraw = true;
            }
            session.log.unshift(`${player.name} escolheu a recompensa: ${rewardId === "energy" ? "Energia Maxima +1" : rewardId === "handSize" ? "Tamanho da Mao +1" : "Troca de Mao"}.`);
          } else {
            session.log.unshift(`${player.name} concluiu a escolha de recompensas.`);
          }
          player.hasClaimedRoomReward = true;
        } else if (body.type === "useRedraw") {
          if (session.status !== "playing") throw new Error("A partida ainda nao comecou.");
          if (session.turn !== "players") throw new Error("Agora e o turno da dungeon.");
          if (player.turnEnded) throw new Error("Voce ja finalizou seu turno.");
          if (!player.hasRedrawAvailable) throw new Error("Voce nao possui Troca de Mao disponivel.");

          const handSizeBefore = player.hand.length;
          if (handSizeBefore > 0) {
            player.discard.push(...player.hand);
            player.hand = [];
            const drawn = drawCards(player, handSizeBefore);
            session.log.unshift(`${player.name} usou a Troca de Mao! Descartou sua mao e comprou ${drawn} novas cartas.`);
          } else {
            session.log.unshift(`${player.name} usou a Troca de Mao, mas nao tinha cartas na mao.`);
          }
          player.hasRedrawAvailable = false;
        } else {
          throw new Error("Acao desconhecida.");
        }

        broadcast(session);
        json(res, 200, sanitizeSession(session, player.id));
        return;
      }
    }

    json(res, 404, { error: "Rota nao encontrada." });
  } catch (error) {
    json(res, 400, { error: error.message || "Erro inesperado." });
  }
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor em http://localhost:${PORT}`);
});
