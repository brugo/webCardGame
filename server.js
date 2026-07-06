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
    exposto: false,
    marcado: false,
    envenenamento: 0
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
    keywords: []
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
    keywords: []
  },
  bruxa: {
    id: "bruxa",
    name: "Bruxa do Breu",
    category: "mystic",
    role: "Suporte (cura)",
    maxLife: 12,
    attack: 0,
    shield: 0,
    icon: "moon",
    keywords: ["Curandeira"],
    curandeiraValue: 4
  },
  mistico: {
    id: "mistico",
    name: "Místico Penumbra",
    category: "mystic",
    role: "Suporte (escudo)",
    maxLife: 15,
    attack: 0,
    shield: 0,
    icon: "star",
    keywords: ["Guardiã"],
    guardiaValue: 3
  },
  arauto: {
    id: "arauto",
    name: "Arauto Cinza",
    category: "mystic",
    role: "Suporte (dano)",
    maxLife: 17,
    attack: 0,
    shield: 0,
    icon: "shield",
    keywords: ["Fortalecer +3"]
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
    name: "Donovan",
    life: 32,
    energy: 4,
    supreme: "bastiao-supremo",
    deck: [
      ["escudo-protetor", 1],
      ["golpe-de-escudo", 1],
      ["provocar", 1],
      ["desafio-do-guardiao", 1],
      ["corte-do-escudo", 1],
      ["grito-de-guerra", 1],
      ["salvaguarda", 1],
      ["ultima-resistencia", 1],
      ["barreira-explosiva", 1],
      ["formacao-defensiva", 1],
      ["avanco-implacavel", 1],
      ["troca-de-escudos", 1],
      ["muralha-viva", 1],
      ["golpe-pesado", 1],
      ["avalanche-de-ferro", 2],
      ["provocacao-em-massa", 1],
      ["escudo-refletor", 1],
      ["protecao-divina", 1],
      ["destruir-armadilha", 2],
      ["rugido-feroz", 2],
      ["benevolencia", 2]
    ]
  },
  oraculo: {
    id: "oraculo",
    name: "Oraculo Lunar",
    life: 24,
    energy: 5,
    supreme: "luz-da-esperanca",
    deck: [
      ["cura-de-emergencia", 1],
      ["bencao-protetora", 1],
      ["voz-do-oraculo", 1],
      ["cura-menor", 1],
      ["cura-em-ondas", 1],
      ["planejamento", 1],
      ["redistribuir-escudos", 1],
      ["absolvicao", 1],
      ["inspiracao", 1],
      ["profecia-menor", 1],
      ["pressagio", 1],
      ["toque-sagrado", 1],
      ["cura-de-alma", 1],
      ["luz-sagrada", 1],
      ["profecia-dupla", 1],
      ["bencao-arcana", 1],
      ["purificar", 1],
      ["visao-do-futuro", 1],
      ["luz-purificadora", 1],
      ["descanso-breve", 1],
      ["renovacao", 1],
      ["reanimar", 1],
      ["julgamento-divino", 1]
    ]
  },
  batedor: {
    id: "batedor",
    name: "Elerion",
    life: 28,
    energy: 4,
    supreme: "tempestade-de-flechas",
    deck: [
      ["flechada-de-oportunidade", 1],
      ["flecha-relampago", 1],
      ["flecha-precisa", 1],
      ["mira-perfeita", 1],
      ["disparo-rapido", 1],
      ["flecha-envenenada", 1],
      ["marcar-alvo", 1],
      ["cacada", 1],
      ["flecha-de-abertura", 1],
      ["chuva-de-flechas", 1],
      ["flecha-explosiva", 1],
      ["flecha-atordoante", 1],
      ["companheiro-animal", 1],
      ["tiro-duplo", 1],
      ["concentracao", 1],
      ["flecha-perfurante", 1],
      ["rastrear", 1],
      ["disparo-poderoso", 1],
      ["tiro-perfurante", 1],
      ["cacada-implacavel", 1],
      ["ultima-flecha", 1],
      ["saraivada-venenosa", 1],
      ["flecha-letal", 1]
    ]
  },
  mago: {
    id: "mago",
    name: "Arcanista Vince",
    life: 26,
    energy: 6,
    supreme: "cataclismo-arcano",
    deck: [
      ["absorcao-arcana", 1],
      ["contra-feitico", 1],
      ["raio-arcano", 1],
      ["fluxo-arcano", 1],
      ["teleporte-arcano", 1],
      ["chama-menor", 1],
      ["toque-glacial", 1],
      ["marca-arcana", 1],
      ["bola-de-fogo", 1],
      ["espelho-arcano", 1],
      ["amplificar", 1],
      ["manipular-energia", 1],
      ["detonacao-arcana", 1],
      ["campo-antimagia", 1],
      ["escudo-etereo", 1],
      ["no-temporal", 1],
      ["tempestade-eletrica", 1],
      ["raio-congelante", 1],
      ["eco-arcano", 1],
      ["sobrecarga-ignea", 1],
      ["explosao-de-mana", 1],
      ["terreno-chao-de-gelo", 1],
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
    block: 4,
    text: "Um aliado recebe 4 de Escudo."
  },
  "golpe-de-escudo": {
    id: "golpe-de-escudo",
    name: "Golpe de Escudo",
    type: "attack",
    cost: 1,
    damage: 4,
    selfBlock: 3,
    text: "Cause 4 de dano a um inimigo. Você recebe 3 de Escudo."
  },
  "formacao-defensiva": {
    id: "formacao-defensiva",
    name: "Formação Defensiva",
    type: "defense",
    cost: 2,
    allBlock: 2,
    text: "Todos os aliados recebem 2 de Escudo."
  },
  "salvaguarda": {
    id: "salvaguarda",
    name: "Salvaguarda",
    type: "defense",
    cost: 3,
    text: "Nesta rodada, metade de todo o dano que os aliados receberiam de ataques inimigos é redirecionado para você (arredondado para baixo)."
  },
  "avanco-implacavel": {
    id: "avanco-implacavel",
    name: "Avanço Implacável",
    type: "attack",
    cost: 2,
    damage: 7,
    ignoreShield: true,
    text: "Cause 7 de dano a um inimigo, ignorando Escudo."
  },
  provocar: {
    id: "provocar",
    name: "Provocar",
    type: "control",
    target: "ally",
    cost: 1,
    text: "Escolha um aliado. Até o início da próxima Fase dos Heróis, todo dano que ele receberia é redirecionado para você. Acumule +1 de Carga."
  },
  "muralha-viva": {
    id: "muralha-viva",
    name: "Muralha Viva",
    type: "defense",
    cost: 2,
    block: 4,
    draw: 1,
    text: "Você recebe 4 de Escudo e compra 1 carta."
  },
  "desafio-do-guardiao": {
    id: "desafio-do-guardiao",
    name: "Desafio do Guardião",
    type: "control",
    target: "enemy",
    cost: 1,
    text: "Escolha um inimigo. Todo o dano que ele causar nesta rodada é redirecionado para você e reduzido em 2 vezes a sua Carga de Batalha atual."
  },
  "ultima-resistencia": {
    id: "ultima-resistencia",
    name: "Última Resistência",
    type: "heal",
    cost: 1,
    heal: 8,
    block: 8,
    lowLifeMax: 10,
    text: "Pré-requisito: 10 de Vida ou menos. Você cura 8 e recebe 8 de Escudo. Acumule +2 de Carga."
  },
  "escudo-refletor": {
    id: "escudo-refletor",
    name: "Escudo Refletor",
    type: "defense",
    target: "ally",
    cost: 2,
    block: 5,
    text: "Um aliado recebe 5 de Escudo. Você ganha +1 de Carga de Batalha."
  },
  "corte-do-escudo": {
    id: "corte-do-escudo",
    name: "Corte do Escudo",
    type: "attack",
    cost: 1,
    text: "Cause 3 de dano a um inimigo. Remova todo o Escudo atual desse inimigo."
  },
  "grito-de-guerra": {
    id: "grito-de-guerra",
    name: "Grito de Guerra",
    type: "control",
    cost: 1,
    text: "Todos os aliados recebem 2 de Escudo. Compre 1 carta. Você ganha +1 de Carga de Batalha."
  },
  "barreira-explosiva": {
    id: "barreira-explosiva",
    name: "Barreira Explosiva",
    type: "defense",
    cost: 3,
    block: 6,
    text: "Você recebe 6 de Escudo."
  },
  "troca-de-escudos": {
    id: "troca-de-escudos",
    name: "Troca de Escudos",
    type: "control",
    cost: 2,
    text: "Soma o Escudo de todos os aliados e distribui igualmente entre todos, arredondando para baixo."
  },
  "golpe-pesado": {
    id: "golpe-pesado",
    name: "Golpe Pesado",
    type: "attack",
    cost: 2,
    text: "Cause 6 de dano a um inimigo. Se você possui 4+ de Escudo, cause 9 de dano."
  },
  "avalanche-de-ferro": {
    id: "avalanche-de-ferro",
    name: "Avalanche de Ferro",
    type: "attack",
    cost: 2,
    target: "enemy",
    text: "Cause 4 de dano a um inimigo. Todos os aliados ganham Escudo igual à Carga de Batalha atual."
  },
  "provocacao-em-massa": {
    id: "provocacao-em-massa",
    name: "Provocação em Massa",
    type: "control",
    cost: 2,
    text: "Até o início da próxima Fase dos Heróis, todos os inimigos só atacam você. Você recebe 3 de Escudo. Acumule +1 de Carga."
  },
  "protecao-divina": {
    id: "protecao-divina",
    name: "Proteção Divina",
    type: "defense",
    target: "enemy",
    cost: 3,
    text: "Reduz o dano total causado pelo monstro alvo nesta rodada em 2 vezes a sua Carga de Batalha atual."
  },
  "destruir-armadilha": {
    id: "destruir-armadilha",
    name: "Destruir Armadilha",
    type: "defense",
    cost: 0,
    lifeCost: 4,
    text: "Destrói a armadilha ativa da sala. Impede por 1 rodada que novas armadilhas entrem em jogo. Custa 4 de Vida."
  },
  "rugido-feroz": {
    id: "rugido-feroz",
    name: "Rugido Feroz",
    type: "control",
    cost: 3,
    text: "Remove todo o Escudo de todos os inimigos. Você ganha +1 de Carga de Batalha."
  },
  "benevolencia": {
    id: "benevolencia",
    name: "Benevolência",
    type: "defense",
    target: "ally",
    cost: 2,
    block: 2,
    text: "Um aliado recebe 2 de Escudo. Você ganha +3 de Carga de Batalha."
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
  "cura-de-emergencia": {
    id: "cura-de-emergencia",
    name: "Cura de Emergência",
    type: "reaction",
    cost: 0,
    text: "Reação. Quando um ataque inimigo reduzir a Vida de qualquer herói para 8 ou menos, esse herói imediatamente cura 5."
  },
  "bencao-protetora": {
    id: "bencao-protetora",
    name: "Bênção Protetora",
    type: "reaction",
    cost: 0,
    text: "Reação. Quando um monstro aplicaria um status effect a qualquer herói, negue essa aplicação de status. (O dano ainda ocorre normalmente)."
  },
  "voz-do-oraculo": {
    id: "voz-do-oraculo",
    name: "Voz do Oráculo",
    type: "reaction",
    cost: 0,
    text: "Reação. Quando uma Armadilha ativa aplicaria seu efeito (em qualquer fase da rodada), escolha um herói. Esse herói é imune ao efeito desta Armadilha nesta aplicação específica."
  },
  "cura-menor": {
    id: "cura-menor",
    name: "Cura Menor",
    type: "heal",
    target: "ally",
    cost: 1,
    heal: 4,
    text: "Cure 4 de Vida de um aliado. Se esse aliado possui Veneno, remova todo o Veneno dele."
  },
  "cura-em-ondas": {
    id: "cura-em-ondas",
    name: "Cura em Ondas",
    type: "heal",
    cost: 1,
    allHeal: 2,
    text: "Todos os aliados curam 2 de Vida."
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
  "redistribuir-escudos": {
    id: "redistribuir-escudos",
    name: "Redistribuir Escudos",
    type: "control",
    cost: 1,
    moveShield: true,
    text: "Mova qualquer quantidade de Escudo de um aliado para outro."
  },
  "absolvicao": {
    id: "absolvicao",
    name: "Absolvição",
    type: "control",
    target: "ally",
    cost: 1,
    text: "Remova todos os status effects ativos de um aliado (Veneno, Queimadura, Vácuo, Enfraquecido, Exposto)."
  },
  "inspiracao": {
    id: "inspiracao",
    name: "Inspiração",
    type: "energy",
    target: "ally",
    cost: 1,
    energy: 2,
    text: "Um aliado recupera 2 de Energia."
  },
  "profecia-menor": {
    id: "profecia-menor",
    name: "Profecia Menor",
    type: "heal",
    target: "ally",
    cost: 1,
    text: "Coloque 1 token de Profecia (valor: 5) em um aliado. Na próxima vez que esse aliado sofrer dano de um ataque inimigo nesta rodada, ele cura 5 imediatamente após o dano resolver."
  },
  "pressagio": {
    id: "pressagio",
    name: "Presságio",
    type: "control",
    cost: 1,
    text: "Olhe as próximas 2 cartas do topo do baralho de Intenções (sem removê-las). Você pode reordenar essas 2 cartas como desejar."
  },
  "toque-sagrado": {
    id: "toque-sagrado",
    name: "Toque Sagrado",
    type: "heal",
    target: "ally",
    cost: 2,
    heal: 6,
    text: "Cure 6 de Vida de um aliado. Remova todos os status effects desse aliado."
  },
  "cura-de-alma": {
    id: "cura-de-alma",
    name: "Cura de Alma",
    type: "heal",
    cost: 2,
    text: "Todos os aliados curam 3 de Vida. Aliados que possuem qualquer status effect ativo curam 3 adicionais (6 de Vida total)."
  },
  "luz-sagrada": {
    id: "luz-sagrada",
    name: "Luz Sagrada",
    type: "attack",
    cost: 2,
    damage: 5,
    text: "Cause 5 de dano a um inimigo. Se qualquer aliado possui um status effect ativo no momento em que esta carta resolve, cause 8 de dano em vez disso."
  },
  "profecia-dupla": {
    id: "profecia-dupla",
    name: "Profecia Dupla",
    type: "heal",
    cost: 2,
    text: "Coloque 1 token de Profecia (valor: 4) em dois aliados diferentes."
  },
  "bencao-arcana": {
    id: "bencao-arcana",
    name: "Bênção Arcana",
    type: "control",
    target: "ally",
    cost: 2,
    text: "Escolha um aliado. A próxima carta que ele jogar nesta rodada custa 1 de Energia a menos (mínimo 0)."
  },
  "purificar": {
    id: "purificar",
    name: "Purificar",
    type: "control",
    cost: 2,
    removeTrap: true,
    text: "Remova a Armadilha ativa da sala. Todos os heróis compram 1 carta."
  },
  "visao-do-futuro": {
    id: "visao-do-futuro",
    name: "Visão do Futuro",
    type: "control",
    cost: 2,
    text: "Olhe as próximas 3 cartas do topo do baralho de Intenções. Você pode descartar 1 delas (ela vai para o fundo do baralho). Recoloque as restantes no topo na ordem que preferir."
  },
  "luz-purificadora": {
    id: "luz-purificadora",
    name: "Luz Purificadora",
    type: "heal",
    cost: 2,
    text: "Remova Queimadura de todos os aliados. Para cada aliado cuja Queimadura foi removida desta forma, esse aliado cura 3 de Vida."
  },
  "descanso-breve": {
    id: "descanso-breve",
    name: "Descanso Breve",
    type: "energy",
    cost: 2,
    allEnergy: 1,
    text: "Todos os aliados recuperam 1 de Energia e compram 1 carta."
  },
  "renovacao": {
    id: "renovacao",
    name: "Renovação",
    type: "heal",
    target: "ally",
    cost: 3,
    heal: 8,
    text: "Cure 8 de Vida de um aliado. Esse aliado compra 1 carta."
  },
  "reanimar": {
    id: "reanimar",
    name: "Reanimar",
    type: "heal",
    target: "ally",
    cost: 3,
    revive: 6,
    text: "Traga um herói derrotado de volta com 6 de Vida e remova todos os status effects dele."
  },
  "julgamento-divino": {
    id: "julgamento-divino",
    name: "Julgamento Divino",
    type: "attack",
    cost: 3,
    damage: 4,
    text: "Cause 4 de dano a todos os inimigos. Remova 1 status effect de cada aliado (à escolha do Oráculo)."
  },
  "luz-da-esperanca": {
    id: "luz-da-esperanca",
    name: "Luz da Esperança",
    type: "heal",
    cost: 0,
    supremeEffects: true,
    text: "Suprema. Todos os aliados recebem: Cura 8, Escudo 5, todos os status effects removidos, Energia +2 e compram 1 carta."
  },
  "flechada-de-oportunidade": {
    id: "flechada-de-oportunidade",
    name: "Flechada de Oportunidade",
    type: "draw",
    cost: 1,
    text: "Compre 2 cartas. Se houver apenas 1 inimigo em jogo, esta carta custa 0 de Energia."
  },
  "flecha-relampago": {
    id: "flecha-relampago",
    name: "Flecha Relâmpago",
    type: "attack",
    cost: 0,
    text: "Cause 2 de dano a um inimigo. Compre 1 carta e depois descarte 1."
  },
  "flecha-precisa": {
    id: "flecha-precisa",
    name: "Flecha Precisa",
    type: "attack",
    cost: 1,
    damage: 5,
    text: "Cause 5 de dano a um inimigo."
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
  "disparo-rapido": {
    id: "disparo-rapido",
    name: "Disparo Rápido",
    type: "energy",
    cost: 1,
    energy: 1,
    draw: 1,
    text: "Recupere 1 de Energia. Compre 1 carta."
  },
  "flecha-envenenada": {
    id: "flecha-envenenada",
    name: "Flecha Envenenada",
    type: "attack",
    cost: 1,
    text: "Cause 3 de dano a um inimigo. Se o inimigo não possuir Escudo, cause 5 de dano em vez disso."
  },
  "marcar-alvo": {
    id: "marcar-alvo",
    name: "Marcar Alvo",
    type: "control",
    cost: 1,
    text: "Escolha um inimigo. O próximo ataque contra ele nesta rodada vindo de qualquer herói causará +3 de dano."
  },
  "cacada": {
    id: "cacada",
    name: "Reciclagem",
    type: "draw",
    cost: 3,
    text: "Descarte qualquer quantidade de cartas da sua mão. Para cada carta descartada, compre uma nova."
  },
  "flecha-de-abertura": {
    id: "flecha-de-abertura",
    name: "Flecha de Abertura",
    type: "attack",
    cost: 1,
    text: "Cause 3 de dano a um inimigo. Se esta for a primeira carta que você jogou nesta rodada, cause 6 de dano em vez disso."
  },
  "chuva-de-flechas": {
    id: "chuva-de-flechas",
    name: "Chuva de Flechas",
    type: "attack",
    cost: 2,
    text: "Dispare 3 flechas de 3 de dano cada. Você pode distribuir as flechas livremente entre os inimigos."
  },
  "flecha-explosiva": {
    id: "flecha-explosiva",
    name: "Flecha Explosiva",
    type: "attack",
    cost: 2,
    text: "Cause 4 de dano a um inimigo. Se houver outros inimigos em jogo, cause 2 de dano a cada um deles."
  },
  "flecha-atordoante": {
    id: "flecha-atordoante",
    name: "Desabilitador",
    type: "control",
    cost: 2,
    text: "Remova a armadilha ativa. Você começa a próxima rodada com 2 de Energia a menos."
  },
  "companheiro-animal": {
    id: "companheiro-animal",
    name: "Companheiro Animal",
    type: "attack",
    cost: 2,
    text: "No início do próximo turno dos heróis, cause 8 de dano a um inimigo."
  },
  "tiro-duplo": {
    id: "tiro-duplo",
    name: "Tiro Duplo",
    type: "attack",
    cost: 1,
    text: "Cause 3 de dano a um inimigo duas vezes. Você pode escolher alvos diferentes para cada tiro."
  },
  "concentracao": {
    id: "concentracao",
    name: "Concentração",
    type: "control",
    cost: 2,
    text: "Nesta rodada, todas as suas cartas de Ataque custam 1 de Energia a menos (mínimo 0). Você começa a próxima rodada com apenas 1 de Energia."
  },
  "flecha-perfurante": {
    id: "flecha-perfurante",
    name: "Flecha Perfurante",
    type: "attack",
    cost: 2,
    text: "Cause 5 de dano a um inimigo. Este dano ignora o Escudo do inimigo."
  },
  "rastrear": {
    id: "rastrear",
    name: "Rastrear",
    type: "utility",
    cost: 2,
    text: "Todos os aliados recuperam 1 de Energia. Você compra 1 carta."
  },
  "disparo-poderoso": {
    id: "disparo-poderoso",
    name: "Disparo Poderoso",
    type: "attack",
    cost: 3,
    damage: 8,
    text: "Cause 8 de dano a um inimigo."
  },
  "tiro-perfurante": {
    id: "tiro-perfurante",
    name: "Tiro Perfurante",
    type: "attack",
    cost: 3,
    damage: 7,
    ignoreShield: true,
    text: "Cause 7 de dano a um inimigo. Este dano ignora o Escudo do inimigo."
  },
  "cacada-implacavel": {
    id: "cacada-implacavel",
    name: "Caçada Implacável",
    type: "attack",
    cost: 3,
    text: "Cause 6 de dano a um inimigo. Se a Vida dele estiver abaixo de 50%, cause 10 de dano em vez disso."
  },
  "ultima-flecha": {
    id: "ultima-flecha",
    name: "Última Flecha",
    type: "attack",
    cost: 3,
    damage: 12,
    text: "Cause 12 de dano a um inimigo. Depois, descarte toda a sua mão."
  },
  "saraivada-venenosa": {
    id: "saraivada-venenosa",
    name: "Saraivada Venenosa",
    type: "attack",
    cost: 3,
    text: "Dispare 5 flechas de 2 de dano cada que podem ser distribuídas livremente. Compre 1 carta."
  },
  "flecha-letal": {
    id: "flecha-letal",
    name: "Flecha Letal",
    type: "attack",
    cost: 4,
    text: "Cause 8 de dano a um inimigo. Se a Vida dele estiver abaixo de 50%, cause 16 de dano em vez disso. Este ataque ignora o Escudo."
  },
  "tempestade-de-flechas": {
    id: "tempestade-de-flechas",
    name: "Tempestade de Flechas",
    type: "attack",
    cost: 0,
    text: "Suprema. Cause 14 de dano a um inimigo. Se a Vida dele estiver abaixo de 50%, cause 20 de dano em vez disso. Seus outros ataques nesta rodada não custam Energia."
  },
  "raio-arcano": {
    id: "raio-arcano",
    name: "Raio Arcano",
    type: "attack",
    cost: 1,
    text: "Cause 4 de dano a um inimigo. Se o inimigo possuir alguma Marca Arcana, cause +2 de dano. Se o inimigo não possuir nenhuma Marca Arcana, coloque 2 marcas arcanas no inimigo."
  },
  "bola-de-fogo": {
    id: "bola-de-fogo",
    name: "Bola de Fogo",
    type: "attack",
    cost: 2,
    text: "Cause 6 de dano a um inimigo. Se houver outros inimigos em jogo, cause 2 de dano a cada um deles. Aplique 2 Marcas Arcanas a todos os inimigos."
  },
  "raio-congelante": {
    id: "raio-congelante",
    name: "Raio Congelante",
    type: "attack",
    cost: 2,
    text: "Cause 6 de dano a um inimigo. Se ele tiver Marca Arcana, reduza o dano dele à metade nesta rodada."
  },
  "tempestade-eletrica": {
    id: "tempestade-eletrica",
    name: "Tempestade Elétrica",
    type: "attack",
    cost: 2,
    text: "Cause 4 de dano a um inimigo duas vezes. Você pode escolher alvos diferentes para cada raio."
  },
  "fluxo-arcano": {
    id: "fluxo-arcano",
    name: "Fluxo Arcano",
    type: "energy",
    cost: 1,
    text: "Outro herói aliado recupera 2 de Energia. Você compra 1 carta."
  },
  "manipular-energia": {
    id: "manipular-energia",
    name: "Transmutar Energia",
    type: "energy",
    cost: 1,
    text: "Troque a energia livremente entre 2 heróis."
  },
  "campo-antimagia": {
    id: "campo-antimagia",
    name: "Campo Antimagia",
    type: "control",
    cost: 2,
    text: "Remova a armadilha ativa e previna que novas armadilhas sejam ativadas por 2 rodadas."
  },
  "teleporte-arcano": {
    id: "teleporte-arcano",
    name: "Teleporte Arcano",
    type: "control",
    cost: 2,
    text: "Um herói aliado recupera 2 de Energia e você compra 1 carta."
  },
  "explosao-de-mana": {
    id: "explosao-de-mana",
    name: "Explosão de Mana",
    type: "attack",
    cost: 3,
    text: "Cause 10 de dano a um inimigo, ignorando Escudo. Se você tiver 3 ou mais cartas na mão, esta carta custa 1 de Energia a menos."
  },
  "eco-arcano": {
    id: "eco-arcano",
    name: "Eco Arcano",
    type: "control",
    cost: 3,
    text: "Escolha qualquer carta jogada nesta rodada por qualquer herói. Resolva novamente seus efeitos."
  },
  "distorcao-temporal": {
    id: "distorcao-temporal",
    name: "Distorção Temporal",
    type: "control",
    cost: 3,
    text: "Escolha um herói aliado. Ele pode jogar imediatamente uma carta de sua mão sem pagar o custo de Energia."
  },
  "cataclismo-arcano": {
    id: "cataclismo-arcano",
    name: "Cataclismo Arcano",
    type: "attack",
    cost: 0,
    text: "Suprema. Cause 15 de dano a um inimigo. Todos os aliados recuperam 3 de Energia."
  },
  "absorcao-arcana": {
    id: "absorcao-arcana",
    name: "Absorção Arcana",
    type: "control",
    cost: 1,
    text: "Desative a armadilha ativa."
  },
  "contra-feitico": {
    id: "contra-feitico",
    name: "Terreno Arcano",
    type: "terrain",
    cost: 3,
    text: "Terreno: Enquanto o terreno estiver ativo, todos os aliados ganham +1 de Energia máxima. Persiste até o fim da sala."
  },
  "chama-menor": {
    id: "chama-menor",
    name: "Terreno Montanhoso",
    type: "terrain",
    cost: 3,
    text: "Terreno: Enquanto este terreno estiver ativo, todos os inimigos causam 2 a menos de dano. Persiste até o fim da sala."
  },
  "toque-glacial": {
    id: "toque-glacial",
    name: "Toque Glacial",
    type: "attack",
    cost: 1,
    text: "Cause 4 de dano a um inimigo. Aplique 2 Marcas Arcanas nele."
  },
  "marca-arcana": {
    id: "marca-arcana",
    name: "Marca Arcana",
    type: "control",
    cost: 1,
    text: "Aplique 3 Marcas Arcanas a um inimigo. Compre 1 carta."
  },
  "espelho-arcano": {
    id: "espelho-arcano",
    name: "Foco de Poder",
    type: "control",
    cost: 2,
    text: "Escolha um herói. O próximo dano causado por ele nesta rodada será dobrado. Você começa a próxima rodada com apenas 1 de Energia."
  },
  "amplificar": {
    id: "amplificar",
    name: "Detonação Arcana",
    type: "attack",
    cost: 2,
    text: "Consuma todas as Marcas Arcanas de um inimigo. Cause 4 de dano para cada Marca consumida (ignora Escudo)."
  },
  "detonacao-arcana": {
    id: "detonacao-arcana",
    name: "Detonação Arcana",
    type: "attack",
    cost: 2,
    text: "Consuma todas as Marcas Arcanas de um inimigo. Cause 4 de dano para cada Marca consumida (ignora Escudo)."
  },
  "escudo-etereo": {
    id: "escudo-etereo",
    name: "Escudo Etéreo",
    type: "defense",
    cost: 2,
    text: "Escolha um aliado. Conceda 6 de Escudo a ele. Se o inimigo atacar este aliado nesta rodada, ele sofre 3 de dano de reflexo."
  },
  "no-temporal": {
    id: "no-temporal",
    name: "Nó Temporal",
    type: "control",
    cost: 1,
    text: "O inimigo alvo é atrasado: ele atacará por último nesta rodada, e seus ataques causam -2 de dano."
  },
  "sobrecarga-ignea": {
    id: "sobrecarga-ignea",
    name: "Sobrecarga Ígnea",
    type: "attack",
    cost: 3,
    text: "Cause 12 de dano a um inimigo, ignorando Escudo. Você começa a próxima rodada com apenas 1 de Energia."
  },
  "terreno-chao-de-gelo": {
    id: "terreno-chao-de-gelo",
    name: "Terreno Cósmico",
    type: "terrain",
    cost: 3,
    text: "Terreno: Enquanto ativo, todos os heróis aumentam o limite máximo de cartas na mão em +1. Persiste até o fim da sala."
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
    mysticEnemyDeck: makeEnemyDeck("mystic"),
    mysticEnemyDiscard: [],
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
      return 1;
    case "colosso":
    case "executor":
    case "basilisco":
      return 5;
    default:
      return 1;
  }
}

function drawEnemyId(session, category) {
  const unlocked = Object.values(monsterTemplates).filter(
    (m) => m.category === category
  );
  if (unlocked.length === 0) {
    if (category === "common") return "sentinela";
    if (category === "brutal") return "colosso";
    return "bruxa";
  }
  const chosen = unlocked[Math.floor(Math.random() * unlocked.length)];
  return chosen.id;
}

function drawTrap(session) {
  if (session.prevent_new_traps_round && session.round <= session.prevent_new_traps_round) {
    session.activeTrap = null;
    session.log.unshift("Nenhuma armadilha foi revelada devido ao efeito de Destruir Armadilha.");
    return;
  }

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
  const finalAttack = template.attack === 0 ? 0 : template.attack + attackMod;

  return {
    uid: randomUUID(),
    ...template,
    maxLife: finalLife,
    life: finalLife,
    shield: template.shield + shieldBonus,
    maxShield: template.shield + shieldBonus,
    attack: finalAttack,
    statusEffects: makeStatusEffects(),
    marcado: false,
    envenenamento: 0,
    atordoado_rodada_atual: false,
    marcas_arcanas: 0,
    queimadura: 0,
    queimadura_rodadas: 0,
    reduzir_ofensiva: 0,
    reducao_proximo_ataque: 0,
    bruxa_resolved_this_round: false,
    mistico_resolved_this_round: false,
    keyword_peconhenta_suprimida_rodada: false,
    keyword_paralisante_suprimida_rodada: false,
    keyword_curandeira_suprimida_rodada: false,
    keyword_guardia_suprimida_rodada: false,
    keyword_sanguinaria_suprimida_rodada: false,
    keyword_explodir_suprimida_rodada: false,
    keyword_invocar_suprimida_rodada: false
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
  const isCommonStage = roomNum <= 4;
  const category = isCommonStage ? "common" : "brutal";

  const setup = session.room.setup;
  const totalToSpawn = (setup.common || 0) + (setup.brutal || 0);

  const availableTemplates = Object.values(monsterTemplates).filter(
    (m) => m.category === category
  );

  if (availableTemplates.length === 0) return enemies;

  for (let i = 0; i < totalToSpawn; i++) {
    const chosen = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
    enemies.push(createEnemy(session, chosen.id));
  }

  return enemies;
}

function drawAndCreateMonster(session) {
  const isCommon = session.roomNumber <= 4;
  let deck = isCommon ? session.commonEnemyDeck : session.brutalEnemyDeck;
  let discard = isCommon ? session.commonEnemyDiscard : session.brutalEnemyDiscard;
  
  if (deck.length === 0) {
    if (discard.length > 0) {
      deck.push(...shuffle(discard));
      discard.length = 0;
    } else {
      deck.push(isCommon ? "sentinela" : "colosso");
    }
  }
  
  const templateId = deck.shift();
  return createEnemy(session, templateId);
}

function drawNextRoom(session) {
  session.roomRound = 1;
  session.roomRewardClaimed = false;
  session.roomNumber = (session.roomNumber || 1) + 1;

  if (session.roomNumber === 9) {
    session.status = "boss_selection";
    const keys = ["inquisidor", "bruxa", "colosso", "oraculo"];
    const chosen = shuffle(keys).slice(0, 2);
    session.bossSelectOptions = chosen.map(key => bossTemplates[key]);
    session.log.unshift("[Sala 9] A masmorra treme... Escolham o Chefe que irão enfrentar.");
    session.room = {
      id: "SALA_BOSS",
      name: "Câmara do Chefe",
      subtitle: "Confronte o Mal Supremo",
      theme: "sanctum",
      setup: { common: 0, brutal: 0 },
      objective: "Escolham o Chefe que irão enfrentar.",
      rule: "Sem regras especiais da sala.",
      reward: "",
      effect: "bossRoom"
    };
    return;
  }

  setupCurrentRoom(session);
}

function setupCurrentRoom(session) {
  session.roomRound = 1;
  session.roomRewardClaimed = false;
  
  const isCommon = session.roomNumber <= 4;
  session.room = {
    id: "SALA_" + session.roomNumber,
    name: isCommon ? "Masmorra - Setor Comum" : "Masmorra - Setor Brutal",
    subtitle: `Sala ${session.roomNumber}`,
    theme: isCommon ? "forest" : "crypt",
    setup: { common: isCommon ? 1 : 0, brutal: isCommon ? 0 : 1 },
    objective: isCommon ? "Derrote o monstro comum para avançar." : "Derrote o monstro brutal para avançar.",
    rule: "Dano em Área: O ataque deste monstro atinge todos os heróis ao mesmo tempo.",
    reward: "Escolha uma recompensa de fim de sala ao vencer.",
    effect: isCommon ? "commonRoom" : "brutalRoom"
  };

  drawTrap(session);
  session.enemies = [drawAndCreateMonster(session)];

  const roomNum = session.roomNumber || 1;
  const threatLevel = Math.max(0, roomNum - 1);
  const attackMod = threatLevel === 1 ? "+2" : (threatLevel >= 2 ? "+4" : "+0");
  const lifeMod = isCommon 
    ? (threatLevel === 1 ? "+4" : (threatLevel >= 2 ? "+8" : "+0"))
    : (threatLevel === 1 ? "+6" : (threatLevel >= 2 ? "+12" : "+0"));

  session.log.unshift(`[Sala ${roomNum}] Monstro revelado: ${session.enemies[0].name}. Nível de Ameaça: ${threatLevel} (Ataque: ${attackMod}, Vida: ${lifeMod}).`);
}

function isRoomComplete(session) {
  return session.enemies.length > 0 && session.enemies.every((enemy) => enemy.life <= 0);
}

function archiveCurrentEnemies(session) {
  session.enemies.forEach((enemy) => {
    if (enemy.category === "common") session.commonEnemyDiscard.push(enemy.id);
    if (enemy.category === "brutal") session.brutalEnemyDiscard.push(enemy.id);
    if (enemy.category === "mystic") session.mysticEnemyDiscard.push(enemy.id);
  });
}

function getRoundDrawCount(session) {
  if (session.skipNextDraw) {
    return 0;
  }
  const isTrapActive = session.activeTrap && !(session.activeTrapDisabledRounds && session.activeTrapDisabledRounds > 0);
  return (isTrapActive && session.activeTrap.effect === "drawTwo") ? 0 : 1;
}

function checkContraFeitico(session, enemy, keywordType, executeFn) {
  const vince = session.players.find(p => p.heroId === "mago" && p.life > 0 && !p.skipReactionsThisRound);
  const hasContra = vince && vince.hand.some(c => c.id === "contra-feitico");
  
  if (hasContra && !enemy[`keyword_${keywordType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}_suprimida_rodada`]) {
    session.pendingReaction = {
      id: randomUUID(),
      type: "keyword_activation",
      keywordType,
      enemyUid: enemy.uid,
      enemyName: enemy.name,
      eligiblePlayerIds: [vince.id],
      skippedPlayerIds: [],
      ruleText: `Contra-Feitico: ${enemy.name} esta prestes a ativar a keyword ${keywordType}.`,
      playableCardUids: {
        [vince.id]: vince.hand.filter(c => c.id === "contra-feitico").map(c => c.uid)
      }
    };
    session.pendingKeywordCallback = executeFn;
    session.log.unshift(`[Reação] Contra-Feitico pode ser usado para anular a keyword ${keywordType} de ${enemy.name}.`);
    return true; // paused
  }
  return false;
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
  const isTrapActive = session.activeTrap && !(session.activeTrapDisabledRounds && session.activeTrapDisabledRounds > 0);
  if (isTrapActive && !session.startRoundTrapApplied) {
    if (session.activeTrap.effect === "energyPenalty") {
      const affectedPlayerIds = session.players.filter(p => p.life > 0).map(p => p.id);
      const paused = triggerTrapEffect(session, session.activeTrap, affectedPlayerIds, (immuneIds) => {
        session.players.forEach((player) => {
          if (player.life > 0) {
            if (!immuneIds.includes(player.id)) {
              player.energy = Math.max(0, player.energy - 1);
              session.log.unshift(`${player.name} perdeu 1 de Energia devido à armadilha ${session.activeTrap.name}.`);
            }
          }
        });
        session.startRoundTrapApplied = true;
        applyStartOfRoundEffects(session);
      });
      if (paused) return;
    }
    if (session.activeTrap.effect === "shieldDecay") {
      const affectedPlayerIds = session.players.filter(p => p.life > 0 && p.shield > 0).map(p => p.id);
      const paused = triggerTrapEffect(session, session.activeTrap, affectedPlayerIds, (immuneIds) => {
        session.players.forEach((player) => {
          if (player.life > 0) {
            if (!immuneIds.includes(player.id)) {
              player.shield = Math.max(0, player.shield - 1);
              session.log.unshift(`${player.name} perdeu 1 de Escudo devido à armadilha ${session.activeTrap.name}.`);
            }
          }
        });
        session.startRoundTrapApplied = true;
        applyStartOfRoundEffects(session);
      });
      if (paused) return;
    }
  }
  session.startRoundTrapApplied = false;

  if (isTrapActive && session.activeTrap.effect === "discardBeforeDraw") {
    session.log.unshift("Armadilha: descarte antes da compra ja foi absorvido pela limpeza da mao no prototipo.");
  }

  // Trigger Curandeira and Guardiã keywords for monsters
  for (const enemy of session.enemies) {
    // Custom Bruxa do Breu healing
    if (enemy.life > 0 && enemy.id === "bruxa" && enemy.category === "mystic" && !enemy.bruxa_resolved_this_round) {
      enemy.bruxa_resolved_this_round = true;
      const otherEnemies = session.enemies.filter(e => e.uid !== enemy.uid && e.life > 0);
      if (otherEnemies.length > 0) {
        const healAmount = Math.floor(4 / otherEnemies.length);
        if (healAmount > 0) {
          otherEnemies.forEach(target => {
            const before = target.life;
            target.life = Math.min(target.maxLife, target.life + healAmount);
            const healed = target.life - before;
            if (target.statusEffects && target.statusEffects.veneno > 0) {
              target.statusEffects.veneno = 0;
            }
            if (healed > 0) {
              pushVisualEvent(session, {
                type: "heal",
                targetType: "enemy",
                targetId: target.uid,
                amount: healed,
                source: enemy.name
              });
              session.log.unshift(`Bruxa do Breu: Curou ${healed} de Vida em ${target.name}.`);
            }
          });
        }
      }
    }

    // Custom Místico Penumbra shielding
    if (enemy.life > 0 && enemy.id === "mistico" && enemy.category === "mystic" && !enemy.mistico_resolved_this_round) {
      enemy.mistico_resolved_this_round = true;
      const otherEnemies = session.enemies.filter(e => e.uid !== enemy.uid && e.life > 0);
      otherEnemies.forEach(target => {
        target.shield += 3;
        pushVisualEvent(session, {
          type: "shield",
          targetType: "enemy",
          targetId: target.uid,
          amount: 3,
          source: enemy.name
        });
        session.log.unshift(`Místico Penumbra: Concedeu 3 de Escudo para ${target.name}.`);
      });
    }

    // Default Curandeira triggering (for other custom/boss monsters if any)
    if (enemy.life > 0 && enemy.keywords?.includes("Curandeira") && !enemy.curandeira_resolved_this_round && !enemy.keyword_curandeira_suprimida_rodada) {
      const paused = checkContraFeitico(session, enemy, "Curandeira", (negated) => {
        enemy.curandeira_resolved_this_round = true;
        if (!negated) {
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
        applyStartOfRoundEffects(session);
      });
      if (paused) return;
    }

    // Default Guardiã triggering (for other custom/boss monsters if any)
    if (enemy.life > 0 && enemy.keywords?.includes("Guardiã") && !enemy.guardia_resolved_this_round && !enemy.keyword_guardia_suprimida_rodada) {
      const paused = checkContraFeitico(session, enemy, "Guardiã", (negated) => {
        enemy.guardia_resolved_this_round = true;
        if (!negated) {
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
        applyStartOfRoundEffects(session);
      });
      if (paused) return;
    }
  }
}

function adjustActiveShields(target) {
  if (!target.activeShields) target.activeShields = [];
  const currentTotal = target.activeShields.reduce((sum, s) => sum + s.amount, 0);
  if (currentTotal !== target.shield) {
    if (target.shield === 0) {
      target.activeShields = [];
    } else if (target.shield > currentTotal) {
      target.activeShields.push({
        id: randomUUID(),
        amount: target.shield - currentTotal,
        espinhoso: 0,
        reflect: 0,
        source: "Escudo"
      });
    } else {
      let diff = currentTotal - target.shield;
      for (let i = target.activeShields.length - 1; i >= 0; i--) {
        const shield = target.activeShields[i];
        if (diff <= 0) break;
        const toRemove = Math.min(shield.amount, diff);
        shield.amount -= toRemove;
        diff -= toRemove;
      }
      target.activeShields = target.activeShields.filter(s => s.amount > 0);
    }
  }
}

function addShieldToHero(session, target, amount, sourceCard, properties = {}) {
  target.shield += amount;
  target.roundStats.shieldReceived = (target.roundStats.shieldReceived || 0) + amount;
  
  if (!target.activeShields) {
    target.activeShields = [];
  }
  target.activeShields.push({
    id: randomUUID(),
    amount: amount,
    espinhoso: properties.espinhoso || 0,
    reflect: properties.reflect || 0,
    source: sourceCard.name
  });
  
  pushVisualEvent(session, {
    type: "shield",
    targetType: "hero",
    targetId: target.id,
    amount: amount,
    source: sourceCard.name
  });
}

function applyDamageToHero(session, target, amount, source, sourceEnemy = null, options = {}) {
  if (!target || target.life <= 0 || amount <= 0) return 0;

  if (sourceEnemy) {
    sourceEnemy.currentTargetId = target.id;
  }

  if (target.statusEffects?.exposto) {
    amount += 1;
  }

  if (!options.skipRedirect && sourceEnemy) {
    // Redirect all damage to Guardian if Bastião Supremo is active
    const guardian = session.players.find((player) => player.life > 0 && player.bastiaoSupremoActive && player.id !== target.id);
    if (guardian) {
      session.log.unshift(`Bastião Supremo: todo o dano a ${target.name} é redirecionado para ${guardian.name}.`);
      return applyDamageToHero(session, guardian, amount, source, sourceEnemy, { skipRedirect: true, isBastiaoSupremoRedirect: true });
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

    const salvaguardaCaster = session.players.find((player) => player.life > 0 && player.salvaguardaActive && player.id !== target.id);
    if (salvaguardaCaster) {
      const half = Math.floor(amount / 2);
      if (half > 0) {
        session.log.unshift(`Salvaguarda: metade do dano (${half}) que ${target.name} receberia de ${sourceEnemy.name} é redirecionado para ${salvaguardaCaster.name}.`);
        applyDamageToHero(session, salvaguardaCaster, half, source, sourceEnemy, { skipRedirect: true });
        amount = amount - half;
      }
    }
  }

  if (options.isBastiaoSupremoRedirect) {
    const reduced = Math.max(1, amount - 4);
    session.log.unshift(`Bastião Supremo: dano redirecionado reduzido de ${amount} para ${reduced}.`);
    amount = reduced;
  }

  if (sourceEnemy && sourceEnemy.challengedByGuardiao && target.heroId === "guardiao") {
    const reductionAmount = 2 * (sourceEnemy.desafio_guardiao_carga_reducao || 0);
    if (reductionAmount > 0) {
      const reduced = Math.max(0, amount - reductionAmount);
      session.log.unshift(`Desafio do Guardião: dano recebido de ${sourceEnemy.name} reduzido de ${amount} para ${reduced} (redução de ${reductionAmount} devido a ${sourceEnemy.desafio_guardiao_carga_reducao} de Carga).`);
      amount = reduced;
    }
  }

  const reduction = target.reduceDamage || 0;
  if (reduction > 0) {
    amount = Math.max(1, amount - reduction);
    session.log.unshift(`${target.name} reduziu o dano recebido em ${reduction}.`);
  }

  adjustActiveShields(target);

  const isInquisidorPhase2 = sourceEnemy?.isBoss && sourceEnemy.id === "inquisidor" && sourceEnemy.fase_atual === 2;
  const shouldIgnoreShield = options.ignoreShield || isInquisidorPhase2;

  let blocked = 0;
  const zeradoEspinhosos = [];

  if (!shouldIgnoreShield && target.shield > 0) {
    blocked = Math.min(target.shield, amount);
    target.shield -= blocked;

    let rem_dmg = blocked;
    if (target.activeShields && target.activeShields.length > 0) {
      for (const shield of target.activeShields) {
        if (rem_dmg <= 0) break;
        const to_block = Math.min(shield.amount, rem_dmg);
        const before = shield.amount;
        shield.amount -= to_block;
        rem_dmg -= to_block;

        if (before > 0 && shield.amount === 0) {
          if (shield.espinhoso > 0) {
            zeradoEspinhosos.push(shield.espinhoso);
          }
        }
      }
      target.activeShields = target.activeShields.filter(s => s.amount > 0);
    }
  }

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
  if (amount > 0) {
    pushVisualEvent(session, {
      type: "damage",
      targetType: "hero",
      targetId: target.id,
      amount: amount,
      source,
      enemyUid: sourceEnemy ? sourceEnemy.uid : null
    });
  }
  session.log.unshift(`${source} causou ${damage} de dano em ${target.name}${blocked ? ` (${blocked} bloqueado)` : ""}.${target.statusEffects?.exposto ? " (+1 por estar Exposto)" : ""}`);
  
  if (damage > 0 && sourceEnemy && sourceEnemy.life > 0 && sourceEnemy.keywords?.includes("Sanguinária") && !sourceEnemy.keyword_sanguinaria_suprimida_rodada) {
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

  // Trigger Espinhoso damage to the attacker
  if (zeradoEspinhosos.length > 0 && sourceEnemy && sourceEnemy.life > 0) {
    const totalEspinhoso = zeradoEspinhosos.reduce((sum, val) => sum + val, 0);
    session.log.unshift(`Espinhoso: ${target.name} zerou escudo espinhoso e causou ${totalEspinhoso} de dano em ${sourceEnemy.name}.`);
    applyDamageToEnemy(session, sourceEnemy, totalEspinhoso, `Escudo Espinhoso de ${target.name}`, false);
  }

  // Compute reflect including activeShields properties
  const totalReflect = (target.reflectDamage || 0) + (target.activeShields || []).reduce((sum, s) => sum + (s.reflect || 0), 0);
  if (damage > 0 && totalReflect > 0 && sourceEnemy?.life > 0) {
    applyDamageToEnemy(session, sourceEnemy, totalReflect, `${target.name} refletiu`, false);
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

  if (player) {
    if (player.heroId === "batedor" && player.foco_em === target.uid) {
      amount += (player.bonus_foco || 0);
      session.log.unshift(`[Concentração] +${player.bonus_foco} de dano no alvo focado.`);
    }
    if (session.alvo_rastreado === target.uid) {
      amount += (session.bonus_rastreado || 0);
      session.log.unshift(`[Rastrear] +${session.bonus_rastreado} de dano no alvo rastreado.`);
    }
    if (target.proximo_ataque_bonus_recebido && target.proximo_ataque_bonus_recebido > 0) {
      const bonus = target.proximo_ataque_bonus_recebido;
      amount += bonus;
      target.proximo_ataque_bonus_recebido = 0; // Consume the mark on first player attack
      session.log.unshift(`[Marcado] +${bonus} de dano pelo efeito de Marcar Alvo.`);
    }
  }

  if (player && player.proximo_dano_dobrado) {
    amount *= 2;
    player.proximo_dano_dobrado = false;
    session.log.unshift(`[Foco de Poder] Dano de ${player.name} dobrado!`);
  }

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
    session.log.unshift(`Pulso Reativo: ${target.name} sofreu 8+ de dano and ganhou 3 de Escudo.`);
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
    
    // Increment general round defeated counter
    session.inimigos_derrotados_esta_rodada = (session.inimigos_derrotados_esta_rodada || 0) + 1;
    
    // If it's dungeon phase, queue for reaction check
    if (session.turn === "dungeon") {
      session.enemiesDefeatedThisDungeonStep = session.enemiesDefeatedThisDungeonStep || [];
      session.enemiesDefeatedThisDungeonStep.push(target.uid);
      
      // Also add to player stats for Caçada/reactions
      session.players.forEach(p => {
        if (p.life > 0) {
          p.roundStats.enemiesDefeated = (p.roundStats.enemiesDefeated || 0) + 1;
        }
      });
    }

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
  session.activeIntention = null;
}

function applyIntentionPresagio(session) {
  // No-op
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
    profecia_tokens: [],
    sobrecarga_pendente: 0,
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
  const session = Array.from(sessions.values()).find(s => s.players.some(p => p.id === player.id));
  let limit = player.maxHandSize || 5;
  if (session && session.terreno_ativo === "TERRENO_COSMICO") {
    limit += 1;
  }
  const maxDrawn = Math.max(0, limit - player.hand.length);
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
  session.mysticEnemyDeck = makeEnemyDeck("mystic");
  session.mysticEnemyDiscard = [];
  session.trapDeck = shuffle(trapCards);
  session.trapDiscard = [];
  session.activeTrap = null;
  session.visualEvents = [];
  session.roomDeck = [];
  session.roomDiscard = [];
  session.intentionDeck = [];
  session.intentionDiscard = [];
  session.activeIntention = null;
  setupCurrentRoom(session);
  session.dungeonQueue = [];
  session.pendingReaction = null;
  session.pendingShieldAllocation = null;
  session.todos_inimigos_forcam_guardiao = false;
  session.alvo_rastreado = null;
  session.bonus_rastreado = 0;
  session.inimigos_derrotados_esta_rodada = 0;
  session.players.forEach((player) => {
    const hero = heroes[player.heroId];
    player.maxLife = hero.life;
    player.life = hero.life;
    player.maxEnergy = hero.energy;
    player.energy = hero.energy;
    player.shield = 0;
    player.activeShields = [];
    player.carga_de_batalha = 0;
    player.protectingId = null;
    player.interceptReady = false;
    player.reflectDamage = 0;
    player.reduceDamage = 0;
    player.statusEffects = makeStatusEffects();
    player.profecia_tokens = [];
    player.sobrecarga_pendente = 0;
    player.nextAttackBonus = 0;
    player.foco_em = null;
    player.bonus_foco = 0;
    player.ataques_jogados_esta_rodada = 0;
    player.bastiaoSupremoActive = false;
    player.salvaguardaActive = false;
    player.turnEnded = false;
    player.roundStats = makeRoundStats();
    player.deck = makeDeck(player.heroId);
    player.hand = [];
    player.played = [];
    player.discard = [];
    player.pendingDiscard = 0;
    player.supremeUsed = false;
    player.skipReactionsThisRound = false;
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

  // Resolve delayed damage (like Batedor's Companheiro Animal)
  session.players.forEach((player) => {
    if (player.life > 0 && player.delayed_damages && player.delayed_damages.length > 0) {
      player.delayed_damages.forEach((delayed) => {
        let enemy = session.enemies.find(e => e.uid === delayed.targetUid && e.life > 0);
        if (!enemy) {
          enemy = session.enemies.find(e => e.life > 0);
        }
        if (enemy) {
          applyDamageToEnemy(session, enemy, delayed.damage, delayed.source, false, player);
        }
      });
      player.delayed_damages = [];
    }
  });

  session.round += 1;
  session.turn = "players";
  session.dungeonResolved = false;
  session.dungeonQueue = [];
  session.pendingReaction = null;
  session.enemies.forEach(e => {
    e.currentTargetId = null;
  });
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
  session.espelhos_arcanos_ativos = 0;
  session.cartas_jogadas_esta_rodada = [];
  session.enemies.forEach((enemy) => {
    enemy.isStunned = false;
    enemy.atordoado_rodada_atual = false;
    enemy.reduzir_ofensiva = 0;
    enemy.reducao_proximo_ataque = 0;
    enemy.dano_reduzido_metade_esta_rodada = false;
    enemy.atacar_por_ultimo_esta_rodada = false;
    enemy.curandeira_resolved_this_round = false;
    enemy.guardia_resolved_this_round = false;
    enemy.bruxa_resolved_this_round = false;
    enemy.mistico_resolved_this_round = false;
    enemy.keyword_peconhenta_suprimida_rodada = false;
    enemy.keyword_paralisante_suprimida_rodada = false;
    enemy.keyword_curandeira_suprimida_rodada = false;
    enemy.keyword_guardia_suprimida_rodada = false;
    enemy.keyword_sanguinaria_suprimida_rodada = false;
    enemy.keyword_explodir_suprimida_rodada = false;
    enemy.keyword_invocar_suprimida_rodada = false;
    if (enemy.statusEffects) {
      enemy.statusEffects.vacuo = false;
    }
  });
  session.todos_inimigos_forcam_guardiao = false;
  session.alvo_rastreado = null;
  session.bonus_rastreado = 0;
  session.players.forEach((player) => {
    const toDiscard = player.played.filter(c => !c.exhausted);
    player.discard.push(...toDiscard);
    player.played = [];
    
    let effMaxEnergy = player.maxEnergy + (session.terreno_ativo === "TERRENO_ARCANO" ? 1 : 0);
    let finalEnergy = Math.max(1, effMaxEnergy - (player.sobrecarga_pendente || 0));
    if (player.force_next_round_energy_1) {
      finalEnergy = 1;
      player.force_next_round_energy_1 = false;
    } else if (session.terreno_ativo === "VORTICE_ARCANO") {
      finalEnergy = Math.min(effMaxEnergy + 2, finalEnergy + 1);
    }
    player.energy = finalEnergy;
    player.sobrecarga_pendente = 0;
    player.protectingId = null;
    player.interceptReady = false;
    player.reflectDamage = 0;
    player.reduceDamage = 0;
    player.nextAttackBonus = 0;
    player.foco_em = null;
    player.bonus_foco = 0;
    player.ataques_jogados_esta_rodada = 0;
    player.concentracao_ativa = false;
    player.ataques_gratuitos_esta_rodada = false;
    player.bastiaoSupremoActive = false;
    player.salvaguardaActive = false;
    player.proximo_dano_dobrado = false;
    player.activeShields = [];
    player.turnEnded = player.life <= 0;
    player.roundStats = makeRoundStats();
    player.skipReactionsThisRound = false;
    player.profecia_tokens = [];
    player.proxima_carta_desconto_1 = false;
    
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
    enemy.challengedByGuardiao = false;
    enemy.desafio_guardiao_carga_reducao = 0;
    enemy.protecao_divina_reduction = 0;
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
    if (card.cost > 3) {
      throw new Error("Apenas cartas de custo 3 ou menos podem ser jogadas com Distorcao Temporal.");
    }
  }

  let finalCost = isFreePlay ? 0 : card.cost;
  if (!isFreePlay) {
    // Flechada de Oportunidade discount
    if (card.id === "flechada-de-oportunidade") {
      const enemyCount = session.enemies.filter(e => e.life > 0).length;
      if (enemyCount === 1) {
        finalCost = 0;
      }
    }
    
    // Free attacks from ultimate
    if (player.heroId === "batedor" && player.ataques_gratuitos_esta_rodada && card.type === "attack") {
      finalCost = 0;
    } else {
      // Concentração discount for attacks
      if (player.heroId === "batedor" && player.concentracao_ativa && card.type === "attack") {
        finalCost = Math.max(0, finalCost - 1);
      }
      // Oraculo's Bênção Arcana discount
      if (player.proxima_carta_desconto_1) {
        finalCost = Math.max(0, finalCost - 1);
      }
    }
  }
  if (player.energy < finalCost) throw new Error("Energia insuficiente.");

  if (card.lifeCost) {
    if (player.life <= card.lifeCost) {
      throw new Error(`Vida insuficiente para usar esta carta (custo: ${card.lifeCost} PV).`);
    }
  }

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

  if (card.id === "manipular-energia") {
    const alivePlayers = session.players.filter(p => p.life > 0);
    if (alivePlayers.length < 2) {
      throw new Error("Voce precisa de pelo menos 2 herois vivos para usar Manipular Energia.");
    }
    const hasEnergySource = alivePlayers.some(p => {
      const postPlayEnergy = (p.id === player.id) ? (p.energy - finalCost) : p.energy;
      return postPlayEnergy >= 1;
    });
    if (!hasEnergySource) {
      throw new Error("Nenhum heroi vivo possui energia suficiente para ser transferida.");
    }
  }

  if (card.id === "redistribuir-escudos") {
    const alivePlayers = session.players.filter(p => p.life > 0);
    if (alivePlayers.length < 2) {
      throw new Error("Voce precisa de pelo menos 2 herois vivos para usar Redistribuir Escudos.");
    }
  }

  if (card.id === "escudo-compartilhado") {
    const alivePlayers = session.players.filter(p => p.life > 0);
    if (alivePlayers.length < 2) {
      throw new Error("Voce precisa de pelo menos 2 herois vivos para usar Escudo Compartilhado.");
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
  if (player.proxima_carta_desconto_1 && !isFreePlay) {
    player.proxima_carta_desconto_1 = false;
  }
  if (card.lifeCost) {
    player.life -= card.lifeCost;
    session.log.unshift(`${player.name} pagou o custo de ${card.lifeCost} de Vida para usar ${card.name}.`);
    pushVisualEvent(session, {
      type: "damage",
      targetType: "hero",
      targetId: player.id,
      amount: card.lifeCost,
      source: card.name
    });
  }
  player.roundStats.cardsPlayed += 1;
  if (card.type === "attack") {
    player.roundStats.attackCardsPlayed += 1;
    player.ataques_jogados_esta_rodada = (player.ataques_jogados_esta_rodada || 0) + 1;
  }

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
  const isAttackCard = (card.type === "attack" || card.damage || card.areaDamage || card.id === "flecha-explosiva" || card.id === "execucao" || card.id === "tempestade-eletrica") && card.id !== "companheiro-animal";
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

function executeCardEffects(session, player, card, payload, attackBuff, isCopied = false) {
  if (!isCopied) {
    if (!session.cartas_jogadas_esta_rodada) {
      session.cartas_jogadas_esta_rodada = [];
    }
    session.cartas_jogadas_esta_rodada.push({
      cardId: card.id,
      casterId: player.id,
      targetId: payload.targetId
    });

    if (card.sobrecarga) {
      player.sobrecarga_pendente = Math.max(player.sobrecarga_pendente || 0, card.sobrecarga);
      session.log.unshift(`${player.name} desencadeou Sobrecarga ${card.sobrecarga} (aplicará na próxima rodada).`);
    }
  }

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
    addShieldToHero(session, player, card.selfBlock, card);
    session.log.unshift(`${player.name} recebeu ${card.selfBlock} de Escudo com ${card.name}.`);
  }

  if (card.allBlock) {
    session.players.filter((ally) => ally.life > 0).forEach((ally) => {
      addShieldToHero(session, ally, card.allBlock, card);
    });
    session.log.unshift(`${card.name}: todos os aliados receberam ${card.allBlock} de Escudo.`);
  }

  if (card.block) {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    addShieldToHero(session, target, card.block, card);
    session.log.unshift(`${target.name} recebeu ${card.block} de Escudo com ${card.name}.`);
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
  if (card.id === "reanimar") {
    const target = session.players.find((p) => p.id === payload.targetId && p.life <= 0)
      || session.players.find((p) => p.life <= 0);
    if (!target) throw new Error("Nao ha aliados derrotados para reanimar.");
    target.life = 6;
    target.turnEnded = false;
    if (target.statusEffects) {
      target.statusEffects.veneno = 0;
      target.statusEffects.queimadura = { value: 0, duration: 0 };
      target.statusEffects.vacuo = false;
      target.statusEffects.enfraquecido = 0;
      target.statusEffects.exposto = false;
    }
    pushVisualEvent(session, { type: "heal", targetType: "hero", targetId: target.id, amount: 6, source: card.name });
    session.log.unshift(`${target.name} foi reanimado com 6 de Vida e livre de status!`);
  }

  // redistribuir-escudos: move shield from one ally to another
  if (card.moveShield) {
    const fromPlayer = session.players.find((p) => p.id === payload.fromId && p.life > 0) || player;
    const toPlayer = getCardPlayerTarget(session, player, payload.targetId, card);
    const amount = Math.min(fromPlayer.shield, Number(payload.shieldAmount) || fromPlayer.shield);
    if (amount > 0 && fromPlayer.id !== toPlayer.id) {
      fromPlayer.shield -= amount;
      adjustActiveShields(fromPlayer);
      addShieldToHero(session, toPlayer, amount, card);
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
      applyHealToHero(session, ally, 8, card.name);
      addShieldToHero(session, ally, 5, card);
      if (ally.statusEffects) {
        ally.statusEffects.veneno = 0;
        ally.statusEffects.queimadura = { value: 0, duration: 0 };
        ally.statusEffects.vacuo = false;
        ally.statusEffects.enfraquecido = 0;
        ally.statusEffects.exposto = false;
      }
      ally.energy = Math.min(ally.maxEnergy, ally.energy + 2);
      drawCards(ally, 1);
    });
    session.log.unshift(`${player.name} usou ${card.name}! Todos os aliados receberam Cura 8, Escudo 5, remoção de status, Energia +2 e compraram 1 carta.`);
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

  // Donovan Custom Cards
  if (card.id === "bastiao-supremo") {
    player.bastiaoSupremoActive = true;
    addShieldToHero(session, player, 10, card);
    if (player.heroId === "guardiao") {
      player.carga_de_batalha = (player.carga_de_batalha || 0) + 3;
      session.log.unshift(`${player.name} acumulou +3 de Carga de Batalha.`);
    }
    session.log.unshift(`${player.name} usou Bastião Supremo.`);
  }

  if (card.id === "provocar") {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    player.protectingId = target.id;
    if (player.heroId === "guardiao") {
      player.carga_de_batalha = (player.carga_de_batalha || 0) + 1;
      session.log.unshift(`${player.name} acumulou +1 de Carga de Batalha.`);
    }
    session.log.unshift(`${player.name} provocou ataques contra ${target.name}.`);
  }

  if (card.id === "salvaguarda") {
    player.salvaguardaActive = true;
    session.log.unshift(`${player.name} usou Salvaguarda! Ele redirecionará metade de todo o dano que os aliados receberiam de ataques inimigos para si nesta rodada.`);
  }

  if (card.id === "desafio-do-guardiao") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (!target) throw new Error("Não há monstros vivos para desafiar.");
    target.forcedTargetId = player.id;
    target.challengedByGuardiao = true;
    const currentCarga = player.carga_de_batalha || 0;
    target.desafio_guardiao_carga_reducao = currentCarga;
    player.carga_de_batalha = 0; // Consume charges!
    session.log.unshift(`${target.name} foi desafiado por ${player.name} e só atacará ele. Dano sofrido por Donovan será reduzido em 2x(${currentCarga}) = ${2 * currentCarga} (Carga consumida).`);
  }

  if (card.id === "corte-do-escudo") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const dmg = getHeroAttackDamage(player, 3, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, false, player);
      target.shield = 0;
      session.log.unshift(`${player.name} usou Corte do Escudo em ${target.name}, removendo todo o seu escudo.`);
    }
  }

  if (card.id === "grito-de-guerra") {
    session.players.filter((ally) => ally.life > 0).forEach((ally) => {
      addShieldToHero(session, ally, 2, card);
    });
    const drawn = drawCards(player, 1);
    if (player.heroId === "guardiao") {
      player.carga_de_batalha = (player.carga_de_batalha || 0) + 1;
      session.log.unshift(`${player.name} usou Grito de Guerra, concedendo 2 de Escudo a todos, comprando ${drawn} carta(s) e acumulando +1 de Carga de Batalha.`);
    } else {
      session.log.unshift(`${player.name} usou Grito de Guerra, concedendo 2 de Escudo a todos e comprando ${drawn} carta.`);
    }
  }

  if (card.id === "ultima-resistencia") {
    if (player.heroId === "guardiao") {
      player.carga_de_batalha = (player.carga_de_batalha || 0) + 2;
      session.log.unshift(`${player.name} acumulou +2 de Carga de Batalha.`);
    }
  }

  if (card.id === "troca-de-escudos") {
    const activeAllies = session.players.filter((p) => p.life > 0);
    const totalShield = activeAllies.reduce((sum, p) => sum + (p.shield || 0), 0);
    const dividedShield = Math.floor(totalShield / activeAllies.length);
    
    activeAllies.forEach((p) => {
      p.shield = dividedShield;
      p.activeShields = [{
        id: randomUUID(),
        amount: dividedShield,
        espinhoso: 0,
        reflect: 0,
        source: "Troca de Escudos"
      }];
    });
    session.log.unshift(`${player.name} usou Troca de Escudos. Escudo total de ${totalShield} foi distribuído igualmente (${dividedShield} para cada herói).`);
  }

  if (card.id === "golpe-pesado") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const baseDmg = player.shield >= 4 ? 9 : 6;
      const dmg = getHeroAttackDamage(player, baseDmg, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, false, player);
      session.log.unshift(`${player.name} usou Golpe Pesado (base: ${baseDmg}) e causou ${dmg} de dano em ${target.name}.`);
    }
  }

  if (card.id === "avalanche-de-ferro") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const baseDmg = 4;
      const dmg = getHeroAttackDamage(player, baseDmg, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, false, player);
      
      const carga = player.carga_de_batalha || 0;
      const blockAmount = carga;
      if (blockAmount > 0) {
        session.players.filter((p) => p.life > 0).forEach((ally) => {
          addShieldToHero(session, ally, blockAmount, card);
        });
        session.log.unshift(`${player.name} usou Avalanche de Ferro em ${target.name} causando ${dmg} de dano. Todos os aliados receberam ${blockAmount} de Escudo (Carga consumida: ${carga}).`);
      } else {
        session.log.unshift(`${player.name} usou Avalanche de Ferro em ${target.name} causando ${dmg} de dano (0 Carga).`);
      }
      player.carga_de_batalha = 0; // Consume charges!
    }
  }

  if (card.id === "provocacao-em-massa") {
    session.todos_inimigos_forcam_guardiao = true;
    addShieldToHero(session, player, 3, card);
    if (player.heroId === "guardiao") {
      player.carga_de_batalha = (player.carga_de_batalha || 0) + 1;
      session.log.unshift(`${player.name} acumulou +1 de Carga de Batalha.`);
    }
    session.log.unshift(`${player.name} usou Provocação em Massa! Todos os inimigos focarão Donovan.`);
  }

  if (card.id === "escudo-refletor") {
    if (player.heroId === "guardiao") {
      player.carga_de_batalha = (player.carga_de_batalha || 0) + 1;
      session.log.unshift(`${player.name} acumulou +1 de Carga de Batalha.`);
    }
  }

  if (card.id === "protecao-divina") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const currentCarga = player.carga_de_batalha || 0;
      const reduction = 2 * currentCarga;
      target.protecao_divina_reduction = (target.protecao_divina_reduction || 0) + reduction;
      player.carga_de_batalha = 0; // Consume charges!
      session.log.unshift(`${player.name} usou Proteção Divina em ${target.name}, reduzindo o dano total do monstro nesta rodada em ${reduction} (Carga consumida: ${currentCarga}).`);
    }
  }

  if (card.id === "destruir-armadilha") {
    if (session.activeTrap) {
      session.trapDiscard.push(session.activeTrap);
      session.activeTrap = null;
    }
    session.prevent_new_traps_round = session.round + 1;
    session.log.unshift(`${player.name} usou Destruir Armadilha. A armadilha atual foi destruída e novas armadilhas não poderão entrar até a próxima rodada.`);
  }

  if (card.id === "rugido-feroz") {
    session.enemies.forEach((enemy) => {
      if (enemy.life > 0) {
        enemy.shield = 0;
      }
    });
    if (player.heroId === "guardiao") {
      player.carga_de_batalha = (player.carga_de_batalha || 0) + 1;
      session.log.unshift(`${player.name} usou Rugido Feroz. Todos os inimigos perderam seus Escudos. Donovan acumulou +1 de Carga de Batalha.`);
    } else {
      session.log.unshift(`${player.name} usou Rugido Feroz. Todos os inimigos perderam seus Escudos.`);
    }
  }

  if (card.id === "benevolencia") {
    if (player.heroId === "guardiao") {
      player.carga_de_batalha = (player.carga_de_batalha || 0) + 3;
      session.log.unshift(`${player.name} usou Benevolência e acumulou +3 de Carga de Batalha.`);
    }
  }

  // Oraculo Lunar custom cards
  if (card.id === "cura-menor") {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    if (target.statusEffects && target.statusEffects.veneno > 0) {
      target.statusEffects.veneno = 0;
      session.log.unshift(`${target.name} teve todo o Veneno removido por Cura Menor.`);
    }
  }

  if (card.id === "absolvicao") {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    if (target.statusEffects) {
      target.statusEffects.veneno = 0;
      target.statusEffects.queimadura = { value: 0, duration: 0 };
      target.statusEffects.vacuo = false;
      target.statusEffects.enfraquecido = 0;
      target.statusEffects.exposto = false;
      session.log.unshift(`${target.name} teve todos os efeitos de status removidos por Absolvição.`);
    }
  }

  if (card.id === "profecia-menor") {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    if (!target.profecia_tokens) target.profecia_tokens = [];
    target.profecia_tokens.push(5);
    session.log.unshift(`${player.name} colocou Profecia de 5 em ${target.name}.`);
  }

  if (card.id === "pressagio") {
    const isCommon = session.roomNumber <= 4;
    const currentDeck = isCommon ? session.commonEnemyDeck : session.brutalEnemyDeck;
    const cardsList = currentDeck.slice(0, 2);
    session.pendingIntentionLook = {
      cardUid: card.uid,
      casterId: player.id,
      maxCards: Math.min(2, currentDeck.length),
      cards: cardsList.map(id => {
        const temp = monsterTemplates[id];
        return {
          id: temp.id,
          name: temp.name,
          presagioText: `Vida: ${temp.maxLife} | ATK: ${temp.attack} | Categoria: ${temp.category === 'brutal' ? 'Brutal' : 'Comum'}`
        };
      }),
      canDiscard: false
    };
    session.log.unshift(`${player.name} jogou Presságio. Aguardando reordenar o topo do baralho de Monstros.`);
  }

  if (card.id === "toque-sagrado") {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    applyHealToHero(session, target, 6, card.name);
    if (target.statusEffects) {
      target.statusEffects.veneno = 0;
      target.statusEffects.queimadura = { value: 0, duration: 0 };
      target.statusEffects.vacuo = false;
      target.statusEffects.enfraquecido = 0;
      target.statusEffects.exposto = false;
    }
    session.log.unshift(`${player.name} usou Toque Sagrado em ${target.name}: curou 6 de Vida e removeu todos os status.`);
  }

  if (card.id === "cura-de-alma") {
    session.players.filter(ally => ally.life > 0).forEach(ally => {
      const hasStatus = ally.statusEffects && (
        ally.statusEffects.veneno > 0 ||
        ally.statusEffects.queimadura.duration > 0 ||
        ally.statusEffects.vacuo ||
        ally.statusEffects.enfraquecido > 0 ||
        ally.statusEffects.exposto
      );
      const amount = hasStatus ? 6 : 3;
      applyHealToHero(session, ally, amount, card.name);
    });
    session.log.unshift(`${player.name} usou Cura de Alma!`);
  }

  if (card.id === "luz-sagrada") {
    const target = session.enemies.find(e => e.uid === payload.targetId && e.life > 0) || session.enemies.find(e => e.life > 0);
    if (target) {
      const hasAnyStatus = session.players.some(ally => ally.life > 0 && ally.statusEffects && (
        ally.statusEffects.veneno > 0 ||
        ally.statusEffects.queimadura.duration > 0 ||
        ally.statusEffects.vacuo ||
        ally.statusEffects.enfraquecido > 0 ||
        ally.statusEffects.exposto
      ));
      const baseDmg = hasAnyStatus ? 8 : 5;
      const dmg = getHeroAttackDamage(player, baseDmg, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, false, player);
      session.log.unshift(`${player.name} usou Luz Sagrada em ${target.name} e causou ${dmg} de dano (base: ${baseDmg}).`);
    }
  }

  if (card.id === "profecia-dupla") {
    const target1 = getCardPlayerTarget(session, player, payload.targetId, card);
    if (!target1.profecia_tokens) target1.profecia_tokens = [];
    target1.profecia_tokens.push(4);
    
    const otherAllies = session.players.filter(p => p.life > 0 && p.id !== target1.id);
    if (otherAllies.length > 0) {
      otherAllies.sort((a, b) => a.life - b.life);
      const target2 = otherAllies[0];
      if (!target2.profecia_tokens) target2.profecia_tokens = [];
      target2.profecia_tokens.push(4);
      session.log.unshift(`${player.name} colocou Profecia de 4 em ${target1.name} e ${target2.name} com Profecia Dupla.`);
    } else {
      session.log.unshift(`${player.name} colocou Profecia de 4 em ${target1.name} com Profecia Dupla (nenhum outro aliado vivo).`);
    }
  }

  if (card.id === "bencao-arcana") {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    target.proxima_carta_desconto_1 = true;
    session.log.unshift(`${player.name} concedeu Bênção Arcana para ${target.name} (desconto de 1 de energia na próxima carta).`);
  }

  if (card.id === "purificar") {
    if (session.activeTrap) {
      const trapName = session.activeTrap.name;
      session.trapDiscard.push(session.activeTrap);
      session.activeTrap = null;
      session.log.unshift(`${player.name} purificou a armadilha ${trapName}!`);
    }
    session.players.forEach(p => {
      if (p.life > 0) {
        drawCards(p, 1);
      }
    });
    session.log.unshift(`Purificar: Todos os aliados vivos compraram 1 carta.`);
  }

  if (card.id === "visao-do-futuro") {
    const isCommon = session.roomNumber <= 4;
    const currentDeck = isCommon ? session.commonEnemyDeck : session.brutalEnemyDeck;
    const cardsList = currentDeck.slice(0, 3);
    session.pendingIntentionLook = {
      cardUid: card.uid,
      casterId: player.id,
      maxCards: Math.min(3, currentDeck.length),
      cards: cardsList.map(id => {
        const temp = monsterTemplates[id];
        return {
          id: temp.id,
          name: temp.name,
          presagioText: `Vida: ${temp.maxLife} | ATK: ${temp.attack} | Categoria: ${temp.category === 'brutal' ? 'Brutal' : 'Comum'}`
        };
      }),
      canDiscard: true
    };
    session.log.unshift(`${player.name} jogou Visão do Futuro. Aguardando descarte e reorganização do topo de Monstros.`);
  }

  if (card.id === "luz-purificadora") {
    session.players.forEach(p => {
      if (p.life > 0 && p.statusEffects && p.statusEffects.queimadura?.duration > 0) {
        p.statusEffects.queimadura = { value: 0, duration: 0 };
        applyHealToHero(session, p, 3, card.name);
        session.log.unshift(`Luz Purificadora removeu Queimadura de ${p.name} e curou-o em 3.`);
      }
    });
  }

  if (card.id === "descanso-breve") {
    session.players.filter(p => p.life > 0).forEach(p => {
      p.energy = Math.min(p.maxEnergy, p.energy + 1);
      drawCards(p, 1);
    });
    session.log.unshift(`${player.name} jogou Descanso Breve: todos os aliados recuperaram 1 de Energia e compraram 1 carta.`);
  }

  if (card.id === "renovacao") {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    applyHealToHero(session, target, 8, card.name);
    drawCards(target, 1);
    session.log.unshift(`${player.name} usou Renovação em ${target.name}: curou 8 e fez ${target.name} comprar 1 carta.`);
  }

  if (card.id === "julgamento-divino") {
    const targets = session.enemies.filter((enemy) => enemy.life > 0);
    targets.forEach((enemy) =>
      applyDamageToEnemy(session, enemy, getHeroAttackDamage(player, 4, attackBuff, getHeroAttackPenalty(session)), card.name, false, player)
    );
    session.players.filter(p => p.life > 0).forEach(p => {
      if (p.statusEffects) {
        let removed = "";
        if (p.statusEffects.vacuo) {
          p.statusEffects.vacuo = false;
          removed = "Vácuo";
        } else if (p.statusEffects.exposto) {
          p.statusEffects.exposto = false;
          removed = "Exposto";
        } else if (p.statusEffects.queimadura.duration > 0) {
          p.statusEffects.queimadura = { value: 0, duration: 0 };
          removed = "Queimadura";
        } else if (p.statusEffects.veneno > 0) {
          p.statusEffects.veneno = 0;
          removed = "Veneno";
        } else if (p.statusEffects.enfraquecido > 0) {
          p.statusEffects.enfraquecido = 0;
          removed = "Enfraquecido";
        }
        if (removed) {
          session.log.unshift(`Julgamento Divino removeu ${removed} de ${p.name}.`);
        }
      }
    });
  }

  // Batedor (Archer) custom cards
  if (card.nextAttackBonus) {
    player.nextAttackBonus = (player.nextAttackBonus || 0) + card.nextAttackBonus;
    session.log.unshift(`${player.name} jogou ${card.name}. Proxima carta de ataque causara +${card.nextAttackBonus} de dano.`);
  }

  if (card.id === "flechada-de-oportunidade") {
    drawCards(player, 2);
    session.log.unshift(`${player.name} usou Flechada de Oportunidade e comprou 2 cartas.`);
  }

  if (card.id === "flecha-relampago") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const dmg = getHeroAttackDamage(player, 2, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, false, player);
      session.log.unshift(`${player.name} usou Flecha Relâmpago em ${target.name} causando ${dmg} de dano.`);
    }
    drawCards(player, 1);
    player.pendingDiscard = (player.pendingDiscard || 0) + 1;
    session.log.unshift(`${player.name} comprou 1 carta e deve descartar 1 com Flecha Relâmpago.`);
  }

  if (card.id === "flecha-envenenada") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const baseVal = target.shield <= 0 ? 5 : 3;
      const dmg = getHeroAttackDamage(player, baseVal, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, false, player);
      session.log.unshift(`${player.name} usou Flecha Envenenada em ${target.name} causando ${dmg} de dano (base: ${baseVal}).`);
    }
  }

  if (card.id === "marcar-alvo") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      target.proximo_ataque_bonus_recebido = (target.proximo_ataque_bonus_recebido || 0) + 3;
      session.log.unshift(`${player.name} marcou ${target.name}. O próximo ataque contra ele nesta rodada vindo de qualquer herói causará +3 de dano.`);
    }
  }

  if (card.id === "cacada") {
    session.pendingReciclagem = {
      playerId: player.id,
      discardedCount: 0
    };
    session.log.unshift(`${player.name} usou Reciclagem. Escolhendo cartas para trocar.`);
  }

  if (card.id === "flecha-de-abertura") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const cardsPlayedByMe = session.cartas_jogadas_esta_rodada.filter(item => item.casterId === player.id).length;
      const baseVal = (cardsPlayedByMe === 1) ? 6 : 3;
      const dmg = getHeroAttackDamage(player, baseVal, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, false, player);
      session.log.unshift(`${player.name} usou Flecha de Abertura em ${target.name} causando ${dmg} de dano (base: ${baseVal}).`);
    }
  }

  if (card.id === "chuva-de-flechas") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      for (let i = 0; i < 3; i++) {
        let currentTarget = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0);
        if (!currentTarget) {
          currentTarget = session.enemies.find((enemy) => enemy.life > 0);
        }
        if (currentTarget) {
          const dmg = getHeroAttackDamage(player, 3, i === 0 ? attackBuff : 0, getHeroAttackPenalty(session));
          applyDamageToEnemy(session, currentTarget, dmg, `${card.name} (Flecha ${i+1})`, false, player);
        }
      }
    }
  }

  if (card.id === "flecha-explosiva") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const dmgTarget = getHeroAttackDamage(player, 4, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmgTarget, card.name, false, player);
      const otherEnemies = session.enemies.filter((enemy) => enemy.uid !== target.uid && enemy.life > 0);
      otherEnemies.forEach((other) => {
        const dmgOther = getHeroAttackDamage(player, 2, 0, getHeroAttackPenalty(session));
        applyDamageToEnemy(session, other, dmgOther, `${card.name} (Explosão)`, false, player);
      });
      session.log.unshift(`${player.name} usou Flecha Explosiva em ${target.name} causando ${dmgTarget} de dano, e 2 de dano nos outros inimigos.`);
    }
  }

  if (card.id === "flecha-atordoante") {
    if (session.activeTrap) {
      const trapName = session.activeTrap.name;
      session.trapDiscard.push(session.activeTrap);
      session.activeTrap = null;
      session.log.unshift(`${player.name} usou Desabilitador e desarmou a armadilha ${trapName}!`);
    } else {
      session.log.unshift(`${player.name} usou Desabilitador, mas não havia nenhuma armadilha ativa.`);
    }
    player.sobrecarga_pendente = (player.sobrecarga_pendente || 0) + 2;
  }

  if (card.id === "companheiro-animal") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      player.delayed_damages = player.delayed_damages || [];
      player.delayed_damages.push({
        targetUid: target.uid,
        damage: 8,
        source: "Companheiro Animal (Efeito Atrasado)"
      });
      session.log.unshift(`${player.name} chamou o Companheiro Animal! Ele atacará ${target.name} com 8 de dano no início da próxima rodada.`);
    }
  }

  if (card.id === "tiro-duplo") {
    const target1 = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target1) {
      const dmg1 = getHeroAttackDamage(player, 3, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target1, dmg1, card.name, false, player);
      
      const otherEnemies = session.enemies.filter((enemy) => enemy.uid !== target1.uid && enemy.life > 0);
      if (otherEnemies.length > 0) {
        const target2 = otherEnemies[0];
        const dmg2 = getHeroAttackDamage(player, 3, 0, getHeroAttackPenalty(session));
        applyDamageToEnemy(session, target2, dmg2, card.name, false, player);
        session.log.unshift(`${player.name} usou Tiro Duplo: ${dmg1} de dano em ${target1.name} e ${dmg2} de dano em ${target2.name}.`);
      } else {
        const dmg2 = getHeroAttackDamage(player, 3, 0, getHeroAttackPenalty(session));
        applyDamageToEnemy(session, target1, dmg2, card.name, false, player);
        session.log.unshift(`${player.name} usou Tiro Duplo no mesmo alvo: ${dmg1} + ${dmg2} de dano em ${target1.name}.`);
      }
    }
  }

  if (card.id === "concentracao") {
    player.concentracao_ativa = true;
    player.force_next_round_energy_1 = true;
    session.log.unshift(`${player.name} usou Concentração! Suas cartas de ataque custarão 1 a menos esta rodada, mas começará a próxima rodada com apenas 1 de Energia.`);
  }

  if (card.id === "flecha-perfurante") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const dmg = getHeroAttackDamage(player, 5, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, true, player);
      session.log.unshift(`${player.name} usou Flecha Perfurante em ${target.name} causando ${dmg} de dano ignorando Escudo.`);
    }
  }

  if (card.id === "rastrear") {
    session.players.filter((p) => p.life > 0).forEach((p) => {
      p.energy = Math.min(p.maxEnergy, p.energy + 1);
    });
    drawCards(player, 1);
    session.log.unshift(`${player.name} usou Rastrear. Todos os aliados recuperaram 1 de Energia e Elerion comprou 1 carta.`);
  }

  if (card.id === "cacada-implacavel") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const baseVal = target.life <= target.maxLife / 2 ? 10 : 6;
      const dmg = getHeroAttackDamage(player, baseVal, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, false, player);
      session.log.unshift(`${player.name} usou Caçada Implacável em ${target.name} e causou ${dmg} de dano.`);
    }
  }

  if (card.id === "ultima-flecha") {
    const count = player.hand.length;
    if (count > 0) {
      player.discard.push(...player.hand);
      player.hand = [];
      session.log.unshift(`${player.name} descartou toda a mao (${count} cartas) devido ao efeito de Ultima Flecha.`);
    }
  }

  if (card.id === "saraivada-venenosa") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      for (let i = 0; i < 5; i++) {
        let currentTarget = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0);
        if (!currentTarget) {
          currentTarget = session.enemies.find((enemy) => enemy.life > 0);
        }
        if (currentTarget) {
          const dmg = getHeroAttackDamage(player, 2, i === 0 ? attackBuff : 0, getHeroAttackPenalty(session));
          applyDamageToEnemy(session, currentTarget, dmg, `${card.name} (Flecha ${i+1})`, false, player);
        }
      }
    }
    drawCards(player, 1);
    session.log.unshift(`${player.name} usou Saraivada Venenosa e comprou 1 carta.`);
  }

  if (card.id === "flecha-letal") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const baseVal = target.life <= target.maxLife / 2 ? 16 : 8;
      const dmg = getHeroAttackDamage(player, baseVal, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, true, player);
      session.log.unshift(`${player.name} usou Flecha Letal em ${target.name} e causou ${dmg} de dano (base: ${baseVal}) ignorando Escudo.`);
    }
  }

  // Vince (Mage) custom cards
  if (card.id === "raio-arcano") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const marks = target.marcas_arcanas || 0;
      const baseVal = marks > 0 ? 6 : 4;
      const dmg = getHeroAttackDamage(player, baseVal, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, false, player);
      if (marks === 0) {
        target.marcas_arcanas = 2;
        session.log.unshift(`${player.name} colocou 2 Marcas Arcanas em ${target.name}.`);
      }
      session.log.unshift(`${player.name} usou Raio Arcano em ${target.name} causando ${dmg} de dano (base: ${baseVal}).`);
    }
  }

  if (card.id === "bola-de-fogo") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const dmgTarget = getHeroAttackDamage(player, 6, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmgTarget, card.name, false, player);
      const otherEnemies = session.enemies.filter((enemy) => enemy.uid !== target.uid && enemy.life > 0);
      otherEnemies.forEach((other) => {
        const dmgOther = getHeroAttackDamage(player, 2, 0, getHeroAttackPenalty(session));
        applyDamageToEnemy(session, other, dmgOther, `${card.name} (Explosão)`, false, player);
      });
      // Apply 2 Arcana Marks to all enemies
      session.enemies.filter(e => e.life > 0).forEach(e => {
        e.marcas_arcanas = Math.min(5, (e.marcas_arcanas || 0) + 2);
      });
      session.log.unshift(`${player.name} usou Bola de Fogo em ${target.name} causando ${dmgTarget} de dano (e 2 de dano em área). Aplicou 2 Marcas Arcanas a todos os inimigos.`);
    }
  }

  if (card.id === "raio-congelante") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const dmg = getHeroAttackDamage(player, 6, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, false, player);
      if (target.marcas_arcanas && target.marcas_arcanas > 0) {
        target.dano_reduzido_metade_esta_rodada = true;
        session.log.unshift(`${player.name} reduziu o dano de ${target.name} pela metade nesta rodada com Raio Congelante.`);
      }
      session.log.unshift(`${player.name} usou Raio Congelante em ${target.name} causando ${dmg} de dano.`);
    }
  }

  if (card.id === "tempestade-eletrica") {
    const target1 = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target1) {
      const dmg1 = getHeroAttackDamage(player, 4, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target1, dmg1, card.name, false, player);
      
      const otherEnemies = session.enemies.filter((enemy) => enemy.uid !== target1.uid && enemy.life > 0);
      if (otherEnemies.length > 0) {
        const target2 = otherEnemies[0];
        const dmg2 = getHeroAttackDamage(player, 4, 0, getHeroAttackPenalty(session));
        applyDamageToEnemy(session, target2, dmg2, card.name, false, player);
        session.log.unshift(`${player.name} usou Tempestade Elétrica: ${dmg1} de dano em ${target1.name} e ${dmg2} de dano em ${target2.name}.`);
      } else {
        const dmg2 = getHeroAttackDamage(player, 4, 0, getHeroAttackPenalty(session));
        applyDamageToEnemy(session, target1, dmg2, card.name, false, player);
        session.log.unshift(`${player.name} usou Tempestade Elétrica no mesmo alvo: ${dmg1} + ${dmg2} de dano em ${target1.name}.`);
      }
    }
  }

  if (card.id === "fluxo-arcano") {
    const target = session.players.find((candidate) => candidate.id === payload.targetId && candidate.id !== player.id && candidate.life > 0) || session.players.find((candidate) => candidate.id !== player.id && candidate.life > 0);
    if (target) {
      target.energy = Math.min(getPlayerMaxEnergy(session, target) + 2, target.energy + 2);
      session.log.unshift(`${player.name} usou Fluxo Arcano e concedeu 2 de Energia para ${target.name}.`);
    }
    drawCards(player, 1);
  }

  if (card.id === "manipular-energia") {
    session.pendingEnergyAllocation = { cardUid: card.uid, casterId: player.id };
    session.log.unshift(`${player.name} jogou Transmutar Energia. Escolhendo jogadores para transferir energia.`);
  }

  if (card.id === "campo-antimagia") {
    if (session.activeTrap) {
      const trapName = session.activeTrap.name;
      session.trapDiscard.push(session.activeTrap);
      session.activeTrap = null;
      session.log.unshift(`${player.name} usou Campo Antimagia e desarmou a armadilha ${trapName}!`);
    }
    session.activeTrapDisabledRounds = (session.activeTrapDisabledRounds || 0) + 2;
    session.log.unshift(`${player.name} ativou proteção de armadilhas por 2 rodadas.`);
  }

  if (card.id === "teleporte-arcano") {
    const target = session.players.find((candidate) => candidate.id === payload.targetId && candidate.life > 0) || player;
    target.energy = Math.min(getPlayerMaxEnergy(session, target) + 2, target.energy + 2);
    drawCards(player, 1);
    session.log.unshift(`${player.name} usou Teleporte Arcano: ${target.name} recuperou 2 de Energia e o Arcanista comprou 1 carta.`);
  }

  if (card.id === "explosao-de-mana") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const dmg = getHeroAttackDamage(player, 10, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, true, player);
      session.log.unshift(`${player.name} usou Explosão de Mana em ${target.name} causando ${dmg} de dano ignorando Escudo.`);
    }
  }

  if (card.id === "eco-arcano") {
    const eligible = (session.cartas_jogadas_esta_rodada || []).filter(c => c.cardId !== "eco-arcano" && cards[c.cardId]?.cost !== 0);
    if (eligible.length === 0) {
      throw new Error("Nenhuma carta elegível foi jogada nesta rodada ainda.");
    }
    session.pendingEcoArcano = { cardUid: card.uid, casterId: player.id };
    session.log.unshift(`${player.name} jogou Eco Arcano. Escolhendo qual carta copiar.`);
  }

  if (card.id === "distorcao-temporal") {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    session.pendingDistorcaoTemporal = { casterId: player.id, targetId: target.id };
    session.log.unshift(`${player.name} jogou Distorção Temporal em ${target.name}. Aguardando escolha de carta gratuita.`);
  }

  if (card.id === "cataclismo-arcano") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      applyDamageToEnemy(session, target, 15, "Cataclismo Arcano", false, player);
    }
    session.players.filter((ally) => ally.life > 0).forEach((ally) => {
      ally.energy = Math.min(getPlayerMaxEnergy(session, ally) + 3, ally.energy + 3);
    });
    session.log.unshift(`${player.name} ativou Suprema: Cataclismo Arcano! Concedeu 3 de energia a aliados e causou 15 de dano.`);
  }

  if (card.id === "absorcao-arcana") {
    if (session.activeTrap) {
      const trapName = session.activeTrap.name;
      session.trapDiscard.push(session.activeTrap);
      session.activeTrap = null;
      session.log.unshift(`${player.name} usou Absorção Arcana e desativou a armadilha ${trapName}!`);
    } else {
      session.log.unshift(`${player.name} usou Absorção Arcana, mas não havia armadilha ativa.`);
    }
  }

  if (card.id === "contra-feitico") {
    session.terreno_ativo = "TERRENO_ARCANO";
    session.log.unshift(`${player.name} ativou o Terreno Arcano! Todos os aliados ganham +1 de Energia máxima.`);
  }

  if (card.id === "chama-menor") {
    session.terreno_ativo = "TERRENO_MONTANHOSO";
    session.log.unshift(`${player.name} ativou o Terreno Montanhoso! Todos os inimigos causam 2 a menos de dano.`);
  }

  if (card.id === "toque-glacial") {
    const enemy = session.enemies.find(e => e.uid === payload.targetId && e.life > 0);
    if (enemy) {
      const dmg = getHeroAttackDamage(player, 4, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, enemy, dmg, card.name, false, player);
      enemy.marcas_arcanas = Math.min(5, (enemy.marcas_arcanas || 0) + 2);
      session.log.unshift(`${player.name} usou Toque Glacial: causou ${dmg} de dano e aplicou 2 Marcas Arcanas em ${enemy.name}.`);
    }
  }

  if (card.id === "marca-arcana") {
    const enemy = session.enemies.find(e => e.uid === payload.targetId && e.life > 0);
    if (enemy) {
      enemy.marcas_arcanas = Math.min(5, (enemy.marcas_arcanas || 0) + 3);
      session.log.unshift(`${player.name} aplicou 3 Marcas Arcanas em ${enemy.name} (Total: ${enemy.marcas_arcanas}/5).`);
    }
    const drawn = drawCards(player, 1);
    session.log.unshift(`${player.name} comprou ${drawn} carta(s) com Marca Arcana.`);
  }

  if (card.id === "espelho-arcano") {
    const target = session.players.find((candidate) => candidate.id === payload.targetId && candidate.life > 0) || player;
    target.proximo_dano_dobrado = true;
    player.force_next_round_energy_1 = true;
    session.log.unshift(`${player.name} usou Foco de Poder em ${target.name}. O próximo dano dele será dobrado, e o Arcanista começará a próxima rodada com apenas 1 de Energia.`);
  }

  if (card.id === "amplificar") {
    // Detonação Arcana 2nd copy
    const enemy = session.enemies.find(e => e.uid === payload.targetId && e.life > 0);
    if (enemy) {
      const marks = enemy.marcas_arcanas || 0;
      enemy.marcas_arcanas = 0;
      const dmg = marks * 4;
      applyDamageToEnemy(session, enemy, dmg, "Detonação Arcana", true, player);
      session.log.unshift(`${player.name} consumiu ${marks} Marcas Arcanas de ${enemy.name} e causou ${dmg} de dano com Detonação Arcana (ignora Escudo).`);
    } else {
      throw new Error("Alvo inválido para Detonação Arcana.");
    }
  }

  if (card.id === "detonacao-arcana") {
    const enemy = session.enemies.find(e => e.uid === payload.targetId && e.life > 0);
    if (enemy) {
      const marks = enemy.marcas_arcanas || 0;
      enemy.marcas_arcanas = 0;
      const dmg = marks * 4;
      applyDamageToEnemy(session, enemy, dmg, "Detonação Arcana", true, player);
      session.log.unshift(`${player.name} consumiu ${marks} Marcas Arcanas de ${enemy.name} e causou ${dmg} de dano (ignora Escudo).`);
    } else {
      throw new Error("Alvo inválido para Detonação Arcana.");
    }
  }

  if (card.id === "escudo-etereo") {
    const target = getCardPlayerTarget(session, player, payload.targetId, card);
    addShieldToHero(session, target, 6, card, { reflect: 3 });
    session.log.unshift(`${player.name} usou Escudo Etéreo: concedeu 6 de Escudo com Refletir 3 para ${target.name}.`);
  }

  if (card.id === "no-temporal") {
    const enemy = session.enemies.find(e => e.uid === payload.targetId && e.life > 0);
    if (enemy) {
      enemy.atacar_por_ultimo_esta_rodada = true;
      enemy.reduzir_ofensiva = (enemy.reduzir_ofensiva || 0) + 2;
      session.log.unshift(`${player.name} usou Nó Temporal em ${enemy.name}: ele atacará por último e causará -2 de dano.`);
    } else {
      throw new Error("Alvo inválido para Nó Temporal.");
    }
  }

  if (card.id === "sobrecarga-ignea") {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
      const dmg = getHeroAttackDamage(player, 12, attackBuff, getHeroAttackPenalty(session));
      applyDamageToEnemy(session, target, dmg, card.name, true, player);
      player.force_next_round_energy_1 = true;
      session.log.unshift(`${player.name} usou Sobrecarga Ígnea em ${target.name} causando ${dmg} de dano ignorando Escudo. Começará a próxima rodada com apenas 1 de Energia.`);
    }
  }

  if (card.id === "terreno-chao-de-gelo") {
    session.terreno_ativo = "TERRENO_COSMICO";
    session.log.unshift(`${player.name} ativou o Terreno Cósmico! Todos os heróis aumentam o limite de cartas na mão em +1.`);
  }
}

function applyHealToHero(session, target, amount, source) {
  if (session.activeTrap?.effect === "noHealing") return;

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

function getPlayerMaxEnergy(session, player) {
  return player.maxEnergy + (session.terreno_ativo === "TERRENO_ARCANO" ? 1 : 0);
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

function resolveEnvenenamentoTick(session) {
  session.enemies.forEach((enemy) => {
    if (enemy.life > 0 && enemy.statusEffects?.envenenamento > 0) {
      const damage = enemy.statusEffects.envenenamento;
      applyDamageToEnemy(session, enemy, damage, "Envenenamento", true, null);
    }
  });
}

function startDungeonTurn(session) {
  session.turn = "dungeon";
  session.dungeonResolved = false;
  session.pendingReaction = null;
  session.dungeonQueue = [];
  session.represaliaChecked = false;
  session.enemiesDefeatedThisDungeonStep = [];
  session.inimigos_derrotados_esta_rodada = 0;
  session.enemies.forEach(e => {
    e.currentTargetId = null;
  });
  session.log.unshift("Turno da masmorra iniciado. Os monstros se preparam para atacar.");

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

  // Resolve Envenenamento
  resolveEnvenenamentoTick(session);

  const continueTurn = () => {
    queueEnemyAttacks(session);
    // Sort session.dungeonQueue so that attacks from enemies with reduzir_ofensiva > 0 go to the end
    session.dungeonQueue.sort((a, b) => {
      if (a.type !== "enemyAttack" || b.type !== "enemyAttack") return 0;
      const enemyA = session.enemies.find(e => e.uid === a.enemyUid);
      const enemyB = session.enemies.find(e => e.uid === b.enemyUid);
      const lastA = enemyA?.atacar_por_ultimo_esta_rodada ? 1 : 0;
      const lastB = enemyB?.atacar_por_ultimo_esta_rodada ? 1 : 0;
      if (lastA !== lastB) return lastA - lastB;
      const roA = enemyA?.reduzir_ofensiva || 0;
      const roB = enemyB?.reduzir_ofensiva || 0;
      if (roA === 0 && roB > 0) return -1;
      if (roA > 0 && roB === 0) return 1;
      return 0;
    });
    advanceDungeonTurn(session);
  };

  continueTurn();
}

function queueEnemyAttacks(session) {
  if (isRoomComplete(session)) return;

  session.enemies.forEach((enemy) => {
    if (enemy.life <= 0 || enemy.isStunned || enemy.atordoado_rodada_atual) return;
    if (enemy.attack <= 0) return; // Support/Mystic monsters with 0 attack do not perform attacks

    // Check if there is a forced target (taunt)
    const forcedTarget = session.players.find(p => p.id === enemy.forcedTargetId && p.life > 0)
      || (session.todos_inimigos_forcam_guardiao ? session.players.find(p => p.heroId === "guardiao" && p.life > 0) : null);

    if (forcedTarget) {
      session.dungeonQueue.push({
        type: "enemyAttack",
        enemyUid: enemy.uid,
        category: enemy.category,
        targetId: forcedTarget.id,
        ruleText: `${enemy.name} ataca ${forcedTarget.name} (Provocado)`
      });
    } else {
      session.players.forEach((player) => {
        if (player.life > 0) {
          session.dungeonQueue.push({
            type: "enemyAttack",
            enemyUid: enemy.uid,
            category: enemy.category,
            targetId: player.id,
            ruleText: `${enemy.name} ataca ${player.name} (Dano em Área)`
          });
        }
      });
    }
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
    const target = forcedTarget
      || (step.targetId ? session.players.find(p => p.id === step.targetId && p.life > 0) : null)
      || selectTarget(session.players, step.targetCriterion || "minLife");
    if (!target) continue;

    const attack = step.overrideAttack ?? computeEnemyAttack(session, enemy, target, true);
    const isRetaliacaoBrutal = enemy.category === "brutal" && session.activeIntention?.id === "INT_007";
    const isBossReactionImmune = enemy.isBoss && session.bossReactionImmune;
    const isReactionSkipped = isRetaliacaoBrutal || isBossReactionImmune;

    const tempPending = {
      enemyUid: enemy.uid,
      enemyName: enemy.name,
      enemyCategory: enemy.category,
      targetId: target.id,
      targetName: target.name,
      attack,
      ruleText: step.ruleText
    };
    const eligiblePlayerIds = isReactionSkipped ? [] : getReactionEligiblePlayers(session, tempPending).map((player) => player.id);

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
      enemy.currentTargetId = target.id;
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

function proceedToStandardReactions(session, pending) {
  const enemy = session.enemies.find((candidate) => candidate.uid === pending.enemyUid && candidate.life > 0);
  if (!enemy) {
    session.pendingReaction = null;
    advanceDungeonTurn(session);
    return;
  }
  const target = session.players.find((candidate) => candidate.id === pending.targetId && candidate.life > 0);
  if (!target) {
    session.pendingReaction = null;
    advanceDungeonTurn(session);
    return;
  }
  const isRetaliacaoBrutal = pending.enemyCategory === "brutal" && session.activeIntention?.id === "INT_007";
  const isBossReactionImmune = enemy.isBoss && session.bossReactionImmune;
  const isReactionSkipped = isRetaliacaoBrutal || isBossReactionImmune;

  const tempPending = {
    enemyUid: pending.enemyUid,
    enemyName: pending.enemyName,
    enemyCategory: pending.enemyCategory,
    targetId: pending.targetId,
    targetName: pending.targetName,
    attack: pending.attack,
    ruleText: pending.ruleText
  };
  const eligiblePlayerIds = isReactionSkipped ? [] : getReactionEligiblePlayers(session, tempPending).map((player) => player.id);

  if (eligiblePlayerIds.length > 0) {
    session.pendingReaction = {
      id: randomUUID(),
      enemyUid: pending.enemyUid,
      enemyName: pending.enemyName,
      enemyCategory: pending.enemyCategory,
      targetId: pending.targetId,
      targetName: pending.targetName,
      attack: pending.attack,
      ruleText: pending.ruleText,
      eligiblePlayerIds,
      skippedPlayerIds: []
    };
    enemy.currentTargetId = pending.targetId;
    session.log.unshift(`${pending.enemyName} esta prestes a atacar ${pending.targetName} com ${pending.attack} de dano. Reacoes abertas.`);
  } else {
    session.pendingReaction = null;
    session.log.unshift(`${pending.ruleText} Alvo: ${pending.targetName}.`);
    
    resolveEnemyAttack(session, enemy, target, pending.attack);
  }
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
    if (enemy.life > 0 && enemy.queimadura_rodadas > 0) {
      const damage = enemy.queimadura;
      applyDamageToEnemy(session, enemy, damage, "Queimadura", true, null);
      
      enemy.queimadura_rodadas -= 1;
      if (enemy.queimadura_rodadas === 0) {
        enemy.queimadura = 0;
      }
      
      session.log.unshift(`Queimadura de inimigo causou ${damage} de dano em ${enemy.name}. Duração restante: ${enemy.queimadura_rodadas} rodadas.`);
    }
  });
}

function finishDungeonTurn(session) {
  if (!session.represaliaApplied) {
    applyIntentionRepresalia(session);
    session.represaliaApplied = true;
  }
  if (!session.queimaduraTickApplied) {
    applyQueimaduraTick(session);
    session.queimaduraTickApplied = true;
  }
  if (!session.endDungeonEffectsApplied) {
    const paused = applyEndOfDungeonEffects(session);
    if (paused) return; // Keep paused
    session.endDungeonEffectsApplied = true;
  }
  if (!session.roomRewardApplied) {
    applyRoomReward(session);
    session.roomRewardApplied = true;
  }

  session.dungeonResolved = true;
  session.pendingReaction = null;
  session.dungeonQueue = [];
  
  // Reset flags for next round
  session.represaliaApplied = false;
  session.endDungeonEffectsApplied = false;
  session.queimaduraTickApplied = false;
  session.roomRewardApplied = false;
  
  session.log.unshift("Turno da dungeon resolvido. Os jogadores podem iniciar a proxima rodada.");
}

function canPlayReactionCard(session, player, card, pending) {
  const isSolo = session.players.filter(p => p.life > 0).length === 1;

  if (card.id === "voz-do-oraculo" || card.id === "absorcao-arcana") {
    return pending.type === "trap";
  }
  if (card.id === "contra-feitico") {
    if (pending.type === "keyword_activation") return true;
    if (pending.enemyUid) {
      const enemy = session.enemies.find(e => e.uid === pending.enemyUid);
      if (enemy) {
        const hasActiveKeywords = enemy.keywords?.some(kw => 
          ["Peçonhenta", "Paralisante", "Sanguinária", "Curandeira", "Guardiã", "Explodir", "Invocar"].includes(kw) &&
          !enemy[`keyword_${kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}_suprimida_rodada`]
        );
        return !!hasActiveKeywords;
      }
    }
    return false;
  }
  if (card.id === "bencao-protetora") {
    return pending.type === "status_apply";
  }
  if (card.id === "cura-de-emergencia") {
    return pending.type === "cura_emergencia";
  }
  return false;
}

function getReactionEligiblePlayers(session, tempPending) {
  const pending = tempPending || session.pendingReaction;
  if (!pending) return [];
  return session.players.filter(
    (player) => player.life > 0 && !player.skipReactionsThisRound && player.hand.some((card) => card.type === "reaction" && canPlayReactionCard(session, player, card, pending))
  );
}

function resolvePendingSpecialReaction(session) {
  if (session.pendingReaction && session.pendingReaction.type === "flechada_oportunidade") {
    session.pendingReaction = null;
    const callback = session.pendingFlechadaCallback;
    session.pendingFlechadaCallback = null;
    if (callback) {
      callback();
    }
    return true;
  }
  if (session.pendingReaction && session.pendingReaction.type === "flecha_relampago") {
    const pending = session.pendingReaction;
    session.pendingReaction = null;
    proceedToStandardReactions(session, pending);
    return true;
  }
  if (session.pendingTrapCallback) {
    const callback = session.pendingTrapCallback;
    session.pendingTrapCallback = null;
    session.pendingReaction = null;
    callback([]); // no immune players
    return true;
  }
  if (session.pendingStatusCallback) {
    const callback = session.pendingStatusCallback;
    session.pendingStatusCallback = null;
    session.pendingReaction = null;
    callback(false); // not negated
    return true;
  }
  if (session.pendingKeywordCallback) {
    const callback = session.pendingKeywordCallback;
    session.pendingKeywordCallback = null;
    session.pendingReaction = null;
    callback(false); // not negated
    return true;
  }
  if (session.pendingCuraCallback) {
    const callback = session.pendingCuraCallback;
    session.pendingCuraCallback = null;
    session.pendingReaction = null;
    callback(null); // no heal
    return true;
  }
  return false;
}

function skipReaction(session, player) {
  const pending = session.pendingReaction;
  if (!pending) throw new Error("Nao ha reacao pendente.");
  if (!pending.eligiblePlayerIds.includes(player.id)) throw new Error("Voce nao tem reacao disponivel para este ataque.");
  if (!pending.skippedPlayerIds.includes(player.id)) pending.skippedPlayerIds.push(player.id);
  session.log.unshift(`${player.name} nao usou reacao.`);

  const remaining = pending.eligiblePlayerIds.filter((id) => !pending.skippedPlayerIds.includes(id));
  if (remaining.length === 0) {
    if (resolvePendingSpecialReaction(session)) return;
    const paused = resolvePendingReactionAttack(session);
    if (paused) return;
    advanceDungeonTurn(session);
  }
}

function skipReactionsThisRound(session, player) {
  player.skipReactionsThisRound = true;
  session.log.unshift(`${player.name} decidiu nao reagir nesta rodada.`);

  const pending = session.pendingReaction;
  if (pending && pending.eligiblePlayerIds.includes(player.id)) {
    if (!pending.skippedPlayerIds.includes(player.id)) {
      pending.skippedPlayerIds.push(player.id);
    }
    const remaining = pending.eligiblePlayerIds.filter((id) => !pending.skippedPlayerIds.includes(id));
    if (remaining.length === 0) {
      if (resolvePendingSpecialReaction(session)) return;
      const paused = resolvePendingReactionAttack(session);
      if (paused) return;
      advanceDungeonTurn(session);
    }
  }
}

function playReaction(session, player, payload) {
  const pending = session.pendingReaction;
  if (!pending) throw new Error("Nao ha reacao pendente.");
  if (!pending.eligiblePlayerIds.includes(player.id)) throw new Error("Voce nao tem reacao disponivel para este ataque.");

  const cardIndex = player.hand.findIndex((card) => card.uid === payload.cardUid && card.type === "reaction");
  if (cardIndex === -1) throw new Error("Carta de reacao nao encontrada na mao.");
  const card = player.hand[cardIndex];
  
  let finalCost = card.cost;
  if (player.proxima_carta_desconto_1) {
    finalCost = Math.max(0, finalCost - 1);
  }
  if (player.energy < finalCost) throw new Error("Energia insuficiente para a reacao.");
  if (!canPlayReactionCard(session, player, card, pending)) {
    throw new Error(`Nao e possivel jogar ${card.name} nesta situacao.`);
  }

  player.hand.splice(cardIndex, 1);
  player.energy -= finalCost;
  player.roundStats.energySpent += finalCost;
  player.roundStats.cardsPlayed += 1;
  player.played.push(card);
  session.arena.unshift({
    uid: card.uid,
    heroId: card.heroId,
    name: card.name,
    type: card.type,
    cost: finalCost,
    intercept: card.intercept,
    reflect: card.reflect,
    text: card.text,
    playedBy: player.name
  });

  if (player.proxima_carta_desconto_1) {
    player.proxima_carta_desconto_1 = false;
  }

  // Oráculo and Arcanista reaction handlers continue below...

  if (card.id === "voz-do-oraculo") {
    const targetId = payload.targetId;
    session.pendingReaction = null;
    const callback = session.pendingTrapCallback;
    session.pendingTrapCallback = null;
    session.log.unshift(`${player.name} usou Voz do Oráculo e tornou um herói imune.`);
    if (callback) {
      callback([targetId]);
    }
    return;
  }

  if (card.id === "absorcao-arcana") {
    session.pendingReaction = null;
    const callback = session.pendingTrapCallback;
    session.pendingTrapCallback = null;
    player.energy = Math.min(player.maxEnergy, player.energy + 2);
    session.log.unshift(`${player.name} usou Absorção Arcana! Negou o efeito de ${pending.trapName} para todos os heróis e recuperou 2⚡.`);
    if (callback) {
      const allHeroIds = session.players.map(p => p.id);
      callback(allHeroIds);
    }
    return;
  }

  if (card.id === "contra-feitico") {
    if (pending.type === "keyword_activation") {
      session.pendingReaction = null;
      const callback = session.pendingKeywordCallback;
      session.pendingKeywordCallback = null;
      const keywordType = pending.keywordType;
      const enemyUid = pending.enemyUid;
      const enemy = session.enemies.find(e => e.uid === enemyUid);
      if (enemy) {
        const normalizedKw = keywordType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        enemy[`keyword_${normalizedKw}_suprimida_rodada`] = true;
        session.log.unshift(`${player.name} usou Contra-Feitiço! A keyword ${keywordType} de ${enemy.name} foi anulada nesta rodada.`);
      }
      if (callback) {
        callback(true);
      }
      return;
    }
    
    const enemy = session.enemies.find(e => e.uid === pending.enemyUid);
    if (enemy) {
      enemy.keywords?.forEach(kw => {
        const normalizedKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        enemy[`keyword_${normalizedKw}_suprimida_rodada`] = true;
      });
      session.log.unshift(`${player.name} usou Contra-Feitiço! Todas as keywords de ${enemy.name} foram anuladas nesta rodada.`);
    }
    proceedToStandardReactions(session, pending);
    return;
  }

  if (card.id === "bencao-protetora") {
    session.pendingReaction = null;
    const callback = session.pendingStatusCallback;
    session.pendingStatusCallback = null;
    session.log.unshift(`${player.name} usou Bênção Protetora e negou a aplicação de status.`);
    if (callback) {
      callback(true); // negated = true
    }
    return;
  }

  if (card.id === "cura-de-emergencia") {
    const targetId = payload.targetId;
    session.pendingReaction = null;
    const callback = session.pendingCuraCallback;
    session.pendingCuraCallback = null;
    if (callback) {
      callback(targetId);
    }
    return;
  }

  const enemy = session.enemies.find((candidate) => candidate.uid === pending.enemyUid && candidate.life > 0);
  const target = session.players.find((candidate) => candidate.id === pending.targetId && candidate.life > 0);
  session.pendingReaction = null;

  if (!enemy || !target) {
    session.log.unshift(`${player.name} usou ${card.name}, mas o ataque nao tinha mais alvo valido.`);
    advanceDungeonTurn(session);
    return;
  }

  session.log.unshift(`${player.name} usou ${card.name}.`);
  resolveEnemyAttack(session, enemy, target, pending.attack);
  advanceDungeonTurn(session);
}

function resolvePendingReactionAttack(session) {
  const pending = session.pendingReaction;
  if (!pending) return false;
  const enemy = session.enemies.find((candidate) => candidate.uid === pending.enemyUid && candidate.life > 0);
  const target = session.players.find((candidate) => candidate.id === pending.targetId && candidate.life > 0);
  session.pendingReaction = null;
  if (!enemy || !target) return false;



  session.log.unshift(`${enemy.name} atacou ${target.name}.`);
  resolveEnemyAttack(session, enemy, target, pending.attack);
  return false;
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
  if (enemy.currentTargetId) {
    return session.players.find(p => p.id === enemy.currentTargetId) || null;
  }
  if (session.status !== "playing" || enemy.life <= 0) {
    return null;
  }
  const forcedTarget = session.players.find((player) => player.id === enemy.forcedTargetId && player.life > 0)
    || (session.todos_inimigos_forcam_guardiao && session.players.find((player) => player.heroId === "guardiao" && player.life > 0));
  if (forcedTarget) return forcedTarget;

  return { name: "Área", heroId: "all" };
}

function computeEnemyAttack(session, enemy, target, commitFirstBonus) {
  if (enemy.attack <= 0) return 0;

  const forcedTarget = session.players.find((player) => player.id === enemy.forcedTargetId && player.life > 0)
    || (session.todos_inimigos_forcam_guardiao && session.players.find((player) => player.heroId === "guardiao" && player.life > 0));
  if (forcedTarget) target = forcedTarget;
  
  let attack = enemy.attack;
  
  // Arauto Cinza alive passive boost: +3 damage to other enemies
  const hasAliveArauto = session.enemies.some(e => e.id === "arauto" && e.life > 0);
  if (hasAliveArauto) {
    attack += 3;
  }

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

  // Apply Terrain: Chao de Gelo effect
  if (session.terreno_ativo === "CHAO_DE_GELO") {
    attack = Math.max(1, attack - 1);
  }

  // Apply Reduzir Ofensiva
  if (enemy.reduzir_ofensiva && enemy.reduzir_ofensiva > 0) {
    attack = Math.max(1, attack - enemy.reduzir_ofensiva);
  }

  // Apply Toque Glacial next attack reduction
  if (enemy.reducao_proximo_ataque && enemy.reducao_proximo_ataque > 0) {
    attack = Math.max(1, attack - enemy.reducao_proximo_ataque);
    if (commitFirstBonus) {
      enemy.reducao_proximo_ataque = 0;
    }
  }

  // Apply Proteção Divina reduction
  if (enemy.protecao_divina_reduction && enemy.protecao_divina_reduction > 0) {
    const aliveHeroesCount = session.players.filter(p => p.life > 0).length || 1;
    const reductionPerAttack = Math.floor(enemy.protecao_divina_reduction / aliveHeroesCount);
    attack = Math.max(0, attack - reductionPerAttack);
  }

  // Apply Terreno Montanhoso (-2 damage)
  if (session.terreno_ativo === "TERRENO_MONTANHOSO") {
    attack = Math.max(0, attack - 2);
  }

  // Apply Raio Congelante half-damage effect
  if (enemy.dano_reduzido_metade_esta_rodada) {
    attack = Math.floor(attack / 2);
  }

  return attack;
}

function triggerTrapEffect(session, trap, affectedPlayerIds, executeEffectFn) {
  const oraculo = session.players.find(p => p.heroId === "oraculo" && p.life > 0 && !p.skipReactionsThisRound);
  const hasVoz = oraculo && oraculo.hand.some(c => c.id === "voz-do-oraculo");
  
  const vince = session.players.find(p => p.heroId === "mago" && p.life > 0 && !p.skipReactionsThisRound);
  const hasAbsorcao = vince && vince.hand.some(c => c.id === "absorcao-arcana");
  
  if (hasVoz || hasAbsorcao) {
    const eligiblePlayerIds = [];
    const playableCardUids = {};
    
    if (hasVoz) {
      eligiblePlayerIds.push(oraculo.id);
      playableCardUids[oraculo.id] = oraculo.hand.filter(c => c.id === "voz-do-oraculo").map(c => c.uid);
    }
    if (hasAbsorcao) {
      eligiblePlayerIds.push(vince.id);
      playableCardUids[vince.id] = vince.hand.filter(c => c.id === "absorcao-arcana").map(c => c.uid);
    }
    
    session.pendingReaction = {
      id: randomUUID(),
      type: "trap",
      trapId: trap.id,
      trapName: trap.name,
      ruleText: trap.text,
      eligiblePlayerIds,
      skippedPlayerIds: [],
      affectedPlayerIds,
      playableCardUids
    };
    session.pendingTrapCallback = executeEffectFn;
    session.log.unshift(`[Armadilha] Reações abertas contra ${trap.name}.`);
    return true; // indicates paused
  }
  
  executeEffectFn([]);
  return false;
}

function triggerStatusApplyReaction(session, enemy, target, statusType, statusValue, executeApplyFn) {
  const oraculo = session.players.find(p => p.heroId === "oraculo" && p.life > 0 && !p.skipReactionsThisRound);
  const hasBencao = oraculo && oraculo.hand.some(c => c.id === "bencao-protetora");
  
  if (hasBencao) {
    session.pendingReaction = {
      id: randomUUID(),
      type: "status_apply",
      enemyUid: enemy.uid,
      enemyName: enemy.name,
      targetId: target.id,
      targetName: target.name,
      statusType,
      statusValue,
      ruleText: `Bênção Protetora: Nega a aplicação de ${statusType} em ${target.name}.`,
      eligiblePlayerIds: [oraculo.id],
      skippedPlayerIds: [],
      playableCardUids: {
        [oraculo.id]: oraculo.hand.filter(c => c.id === "bencao-protetora").map(c => c.uid)
      }
    };
    session.pendingStatusCallback = executeApplyFn;
    session.log.unshift(`[Status] Bênção Protetora pode ser usada para negar o status ${statusType} em ${target.name}. Reações abertas.`);
    return true; // indicates paused
  }
  
  executeApplyFn(false); // apply normally (not negated)
  return false;
}

function resolveEnemyAttack(session, enemy, target, overrideAttack = null) {
  const forcedTarget = session.players.find((player) => player.id === enemy.forcedTargetId && player.life > 0)
    || (session.todos_inimigos_forcam_guardiao && session.players.find((player) => player.heroId === "guardiao" && player.life > 0));
  if (forcedTarget) target = forcedTarget;
  const attack = overrideAttack ?? computeEnemyAttack(session, enemy, target, true);
  const damage = applyDamageToHero(session, target, attack, enemy.name, enemy);

  resolveEnemyAttackStage1(session, enemy, target, damage);
}

function resolveEnemyAttackStage1(session, enemy, target, damage) {
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

  resolveEnemyAttackStage2(session, enemy, target, damage);
}

function resolveEnemyAttackStage2(session, enemy, target, damage) {
  // Peçonhenta trigger
  if (damage > 0 && enemy.keywords?.includes("Peçonhenta") && !enemy.keyword_peconhenta_suprimida_rodada) {
    if (target.statusEffects) {
      const pausedContra = checkContraFeitico(session, enemy, "Peçonhenta", (negated) => {
        if (!negated) {
          const pausedTrap = triggerStatusApplyReaction(session, enemy, target, "Veneno", 1, (negatedTrap) => {
            if (!negatedTrap) {
              target.statusEffects.veneno = (target.statusEffects.veneno || 0) + 1;
              session.log.unshift(`Peçonhenta: ${enemy.name} aplicou Veneno 1 em ${target.name}.`);
            }
            resolveEnemyAttackStage3(session, enemy, target, damage);
          });
          if (!pausedTrap) {
            resolveEnemyAttackStage3(session, enemy, target, damage);
          }
        } else {
          resolveEnemyAttackStage3(session, enemy, target, damage);
        }
      });
      if (pausedContra) return;
    } else {
      resolveEnemyAttackStage3(session, enemy, target, damage);
    }
  } else {
    resolveEnemyAttackStage3(session, enemy, target, damage);
  }
}

function resolveEnemyAttackStage3(session, enemy, target, damage) {
  // Paralisante trigger
  if (damage > 0 && enemy.keywords?.includes("Paralisante") && !enemy.keyword_paralisante_suprimida_rodada) {
    if (target.statusEffects) {
      const pausedContra = checkContraFeitico(session, enemy, "Paralisante", (negated) => {
        if (!negated) {
          const pausedTrap = triggerStatusApplyReaction(session, enemy, target, "Vácuo", 1, (negatedTrap) => {
            if (!negatedTrap) {
              target.statusEffects.vacuo = true;
              session.log.unshift(`Paralisante: ${enemy.name} aplicou Vácuo em ${target.name}.`);
            }
            resolveEnemyAttackStage4(session, enemy, target, damage);
          });
          if (!pausedTrap) {
            resolveEnemyAttackStage4(session, enemy, target, damage);
          }
        } else {
          resolveEnemyAttackStage4(session, enemy, target, damage);
        }
      });
      if (pausedContra) return;
    } else {
      resolveEnemyAttackStage4(session, enemy, target, damage);
    }
  } else {
    resolveEnemyAttackStage4(session, enemy, target, damage);
  }
}

function resolveEnemyAttackStage4(session, enemy, target, damage) {
  if (damage > 0 && session.activeTrap?.effect === "splashLowestLife") {
    const splashTarget = selectTarget(
      session.players.filter((player) => player.id !== target.id),
      "minLife"
    );
    if (splashTarget) {
      const paused = triggerTrapEffect(session, session.activeTrap, [splashTarget.id], (immuneIds) => {
        if (!immuneIds.includes(splashTarget.id)) {
          applyDamageToHero(session, splashTarget, 1, session.activeTrap.name);
        }
        resolveEnemyAttackStage5(session, enemy, target, damage);
      });
      if (paused) return;
    } else {
      resolveEnemyAttackStage5(session, enemy, target, damage);
    }
  } else {
    resolveEnemyAttackStage5(session, enemy, target, damage);
  }
}

function resolveEnemyAttackStage5(session, enemy, target, damage) {
  if (damage > 0) {
    const lowLifeHeroes = session.players.filter(p => p.life > 0 && p.life <= 8);
    if (lowLifeHeroes.length > 0) {
      const oraculo = session.players.find(p => p.heroId === "oraculo" && p.life > 0 && !p.skipReactionsThisRound);
      const hasCuraEmergencia = oraculo && oraculo.hand.some(c => c.id === "cura-de-emergencia");
      if (hasCuraEmergencia) {
        session.pendingReaction = {
          id: randomUUID(),
          type: "cura_emergencia",
          enemyUid: enemy.uid,
          enemyName: enemy.name,
          eligiblePlayerIds: [oraculo.id],
          skippedPlayerIds: [],
          lowLifeHeroIds: lowLifeHeroes.map(p => p.id),
          ruleText: `Cura de Emergência: Cura 5 de Vida em um herói com 8 ou menos de Vida.`,
          playableCardUids: {
            [oraculo.id]: oraculo.hand.filter(c => c.id === "cura-de-emergencia").map(c => c.uid)
          }
        };
        session.pendingCuraCallback = (chosenHeroId) => {
          if (chosenHeroId) {
            const h = session.players.find(p => p.id === chosenHeroId);
            if (h && h.life > 0 && h.life <= 8) {
              applyHealToHero(session, h, 5, "Cura de Emergência");
              session.log.unshift(`[Reação] Cura de Emergência: ${h.name} curou 5 de Vida.`);
            }
          }
          resolveEnemyAttackStage6(session, enemy, target, damage);
        };
        session.log.unshift(`[Reação] Cura de Emergência pode ser usada. Reações abertas.`);
        return;
      }
    }
  }
  
  resolveEnemyAttackStage6(session, enemy, target, damage);
}

function resolveEnemyAttackStage6(session, enemy, target, damage) {
  if (damage > 0 && target.life > 0 && target.profecia_tokens && target.profecia_tokens.length > 0) {
    const totalHeal = target.profecia_tokens.reduce((a, b) => a + b, 0);
    applyHealToHero(session, target, totalHeal, "Profecia");
    session.log.unshift(`[Profecia] ${target.name} curou ${totalHeal} de Vida.`);
    target.profecia_tokens = [];
  }

  advanceDungeonTurn(session);
}

function aliveEnemyCount(session) {
  return session.enemies.filter((enemy) => enemy.life > 0).length;
}

function applyEndOfDungeonEffects(session) {
  if (isRoomComplete(session)) return false;

  if (!session.roomEffectsApplied) {
    if (session.room.effect === "endRoundDamageIfTwoEnemies" && aliveEnemyCount(session) >= 2) {
      session.players.forEach((player) => applyDamageToHero(session, player, 1, session.room.name));
    }
    if (session.room.effect === "endRoundLowestLifeDamage") {
      const target = selectTarget(session.players, "minLife");
      if (target) applyDamageToHero(session, target, 1, session.room.name);
    }
    session.roomEffectsApplied = true;
  }

  const isTrapActive = session.activeTrap && !(session.activeTrapDisabledRounds && session.activeTrapDisabledRounds > 0);
  if (isTrapActive) {
    if (session.activeTrap.effect === "endDungeonAllDamage" && !session.trapEffectApplied) {
      const affectedPlayerIds = session.players.filter(p => p.life > 0).map(p => p.id);
      const paused = triggerTrapEffect(session, session.activeTrap, affectedPlayerIds, (immuneIds) => {
        session.players.forEach((player) => {
          if (player.life > 0 && !immuneIds.includes(player.id)) {
            applyDamageToHero(session, player, 1, session.activeTrap.name);
          }
        });
        session.trapEffectApplied = true;
        finishDungeonTurn(session);
      });
      if (paused) return true;
    }
    if (session.activeTrap.effect === "endRoundLowestLifeDamage" && !session.trapEffectApplied) {
      const target = selectTarget(session.players, "minLife");
      if (target) {
        const paused = triggerTrapEffect(session, session.activeTrap, [target.id], (immuneIds) => {
          if (!immuneIds.includes(target.id)) {
            applyDamageToHero(session, target, 1, session.activeTrap.name);
          }
          session.trapEffectApplied = true;
          finishDungeonTurn(session);
        });
        if (paused) return true;
      }
    }
    if (session.activeTrap.effect === "endDungeonDamageIfTwoEnemies" && aliveEnemyCount(session) >= 2 && !session.trapEffectApplied) {
      const affectedPlayerIds = session.players.filter(p => p.life > 0).map(p => p.id);
      const paused = triggerTrapEffect(session, session.activeTrap, affectedPlayerIds, (immuneIds) => {
        session.players.forEach((player) => {
          if (player.life > 0 && !immuneIds.includes(player.id)) {
            applyDamageToHero(session, player, 1, session.activeTrap.name);
          }
        });
        session.trapEffectApplied = true;
        finishDungeonTurn(session);
      });
      if (paused) return true;
    }
  }
  
  session.roomEffectsApplied = false;
  session.trapEffectApplied = false;
  return false;
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
    pendingEspelhoArcano: session.pendingEspelhoArcano,
    pendingAmplificar: session.pendingAmplificar,
    pendingCataclismoArcano: session.pendingCataclismoArcano,
    pendingTempestadeEletrica: session.pendingTempestadeEletrica,
    terreno_ativo: session.terreno_ativo,
    cartas_jogadas_esta_rodada: session.cartas_jogadas_esta_rodada || [],
    pendingIntentionLook: session.pendingIntentionLook,
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
      carga_de_batalha: player.carga_de_batalha !== undefined ? player.carga_de_batalha : null,
      statusEffects: player.statusEffects,
      sobrecarga_pendente: player.sobrecarga_pendente || 0,
      profecia_tokens: player.profecia_tokens || [],
      proxima_carta_desconto_1: player.proxima_carta_desconto_1 || false,
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
      skipReactionsThisRound: player.skipReactionsThisRound || false,
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
            isBoss: true,
            marcado: false,
            envenenamento: 0,
            atordoado_rodada_atual: false,
            marcas_arcanas: 0,
            queimadura: 0,
            queimadura_rodadas: 0,
            reduzir_ofensiva: 0,
            reducao_proximo_ataque: 0,
            keyword_peconhenta_suprimida_rodada: false,
            keyword_paralisante_suprimida_rodada: false,
            keyword_curandeira_suprimida_rodada: false,
            keyword_guardia_suprimida_rodada: false,
            keyword_sanguinaria_suprimida_rodada: false,
            keyword_explodir_suprimida_rodada: false,
            keyword_invocar_suprimida_rodada: false
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
          session.terreno_ativo = null;
          session.espelhos_arcanos_ativos = 0;
          session.cartas_jogadas_esta_rodada = [];

          // Clean old round state
          session.players.forEach((player) => {
            player.discard.push(...player.played);
            player.played = [];
            player.sobrecarga_pendente = 0;
            player.energy = player.maxEnergy;
            player.shield = 0;
            player.protectingId = null;
            player.interceptReady = false;
            player.reflectDamage = 0;
            player.reduceDamage = 0;
            player.nextAttackBonus = 0;
            player.bastiaoSupremoActive = false;
            player.salvaguardaActive = false;
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
            p.skipReactionsThisRound = false;
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
          let maxHand = player.maxHandSize || 5;
          if (session.terreno_ativo === "TERRENO_COSMICO") {
            maxHand += 1;
          }
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
        } else if (body.type === "skipReactionsThisRound") {
          skipReactionsThisRound(session, player);
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
              applyHealToHero(session, ally, 8, sc.name);
              ally.shield += 5;
              ally.roundStats.shieldReceived = (ally.roundStats.shieldReceived || 0) + 5;
              if (ally.statusEffects) {
                ally.statusEffects.veneno = 0;
                ally.statusEffects.queimadura = { value: 0, duration: 0 };
                ally.statusEffects.vacuo = false;
                ally.statusEffects.enfraquecido = 0;
                ally.statusEffects.exposto = false;
              }
              ally.energy = Math.min(ally.maxEnergy, ally.energy + 2);
              pushVisualEvent(session, { type: "shield", targetType: "hero", targetId: ally.id, amount: 5, source: sc.name });
              drawCards(ally, 1);
            });
            session.log.unshift(`${player.name} usou ${sc.name}! Todos os aliados receberam Cura 8, Escudo 5, remoção de status, Energia +2 e compraram 1 carta.`);
          } else if (sc.id === "tempestade-de-flechas") {
            const targets = session.enemies.filter((enemy) => enemy.life > 0);
            const penalty = getHeroAttackPenalty(session);
            const dmgAll = getHeroAttackDamage(player, 5, 0, penalty);
            
            // 5 area damage
            targets.forEach((enemy) =>
              applyDamageToEnemy(session, enemy, dmgAll, sc.name, false, player)
            );
            
            // 10 single target damage (15 if marked/poisoned, consumes marked, applies Poison 3 to others)
            const selectedTargetId = body.targetId;
            const singleTarget = session.enemies.find((enemy) => enemy.uid === selectedTargetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
            
            if (singleTarget) {
              const hasMarcado = Boolean(singleTarget.statusEffects.marcado);
              const hasEnvenenamento = (singleTarget.statusEffects.envenenamento || 0) > 0;
              const hasBonus = hasMarcado || hasEnvenenamento;
              const baseVal = hasBonus ? 15 : 10;
              const dmgSingle = getHeroAttackDamage(player, baseVal, 0, penalty);
              
              applyDamageToEnemy(session, singleTarget, dmgSingle, sc.name, false, player);
              
              if (hasBonus) {
                if (hasMarcado) {
                  singleTarget.statusEffects.marcado = false;
                  session.log.unshift(`Tempestade de Flechas consumiu o Marcado de ${singleTarget.name}.`);
                }
                const otherEnemies = session.enemies.filter((enemy) => enemy.uid !== singleTarget.uid && enemy.life > 0);
                otherEnemies.forEach((other) => {
                  other.statusEffects.envenenamento = (other.statusEffects.envenenamento || 0) + 3;
                });
                if (otherEnemies.length > 0) {
                  session.log.unshift(`Tempestade de Flechas aplicou Envenenamento 3 em todos os outros ${otherEnemies.length} inimigo(s).`);
                }
              }
              session.log.unshift(`${player.name} usou Tempestade de Flechas! Causou 5 de dano (modificado para ${dmgAll}) em todos os inimigos e ${baseVal} de dano adicional (modificado para ${dmgSingle}) em ${singleTarget.name}.`);
            } else {
              session.log.unshift(`${player.name} usou Tempestade de Flechas! Causou 5 de dano (modificado para ${dmgAll}) em todos os inimigos.`);
            }
            
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
            executeCardEffects(session, player, sc, {}, 0);
          }
        } else if (body.type === "discardCard") {
          // Resolve a pending discard (from planejamento)
          if (!(player.pendingDiscard > 0)) throw new Error("Nao ha descarte pendente.");
          const idx = player.hand.findIndex((c) => c.uid === body.cardUid);
          if (idx === -1) throw new Error("Carta nao encontrada na mao.");
          player.discard.push(player.hand.splice(idx, 1)[0]);
          player.pendingDiscard -= 1;
          session.log.unshift(`${player.name} descartou uma carta.`);
        } else if (body.type === "reciclagemDiscard") {
          if (!session.pendingReciclagem || session.pendingReciclagem.playerId !== player.id) {
            throw new Error("Voce nao esta em um processo de reciclagem.");
          }
          const idx = player.hand.findIndex((c) => c.uid === body.cardUid);
          if (idx === -1) throw new Error("Carta nao encontrada na mao.");
          const discarded = player.hand.splice(idx, 1)[0];
          player.discard.push(discarded);
          drawCards(player, 1);
          session.pendingReciclagem.discardedCount += 1;
          session.log.unshift(`${player.name} descartou ${discarded.name} e comprou 1 nova com Reciclagem.`);
        } else if (body.type === "finishReciclagem") {
          if (!session.pendingReciclagem || session.pendingReciclagem.playerId !== player.id) {
            throw new Error("Voce nao esta em um processo de reciclagem.");
          }
          const count = session.pendingReciclagem.discardedCount;
          session.pendingReciclagem = null;
          session.log.unshift(`${player.name} finalizou a Reciclagem (trocou ${count} cartas).`);
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
          session.players.forEach((p) => {
            p.shield = 0;
            p.activeShields = [];
          });
          Object.entries(allocation).forEach(([pid, amount]) => {
            const target = session.players.find((p) => p.id === pid);
            if (target) {
              const val = Number(amount);
              if (val > 0 && target.life <= 0) {
                throw new Error("Nao e possivel alocar escudo para um heroi derrotado.");
              }
              target.shield = val;
              if (val > 0) {
                target.activeShields = [{ id: randomUUID(), amount: val, espinhoso: 0, reflect: 0, source: "Escudo redistribuido" }];
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
          if (fromPlayer.life <= 0 || toPlayer.life <= 0) throw new Error("Os jogadores de origem e destino devem estar vivos.");
          if (fromPlayer.id === toPlayer.id) throw new Error("A origem nao pode ser igual ao destino.");
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
          executeCardEffects(session, player, copiedCard, { targetId }, 0, true);



        } else if (body.type === "confirmIntentionLook") {
          if (!session.pendingIntentionLook) throw new Error("Não há visualização de monstros pendente.");
          if (session.pendingIntentionLook.casterId !== player.id) throw new Error("Apenas o conjurador do efeito pode responder.");

          const { discardedCardId, reorderedCardIds } = body;
          const look = session.pendingIntentionLook;

          const isCommon = session.roomNumber <= 4;
          const currentDeck = isCommon ? session.commonEnemyDeck : session.brutalEnemyDeck;

          if (look.canDiscard && discardedCardId) {
            const discardedIdx = currentDeck.findIndex(id => id === discardedCardId);
            if (discardedIdx === -1 || discardedIdx >= look.maxCards) {
              throw new Error("Monstro para descarte inválido.");
            }
            const [discardedCard] = currentDeck.splice(discardedIdx, 1);
            currentDeck.push(discardedCard);
            session.log.unshift(`${player.name} colocou o monstro ${monsterTemplates[discardedCard].name} no fundo do baralho.`);
          }

          const remainingCount = look.canDiscard && discardedCardId ? look.maxCards - 1 : look.maxCards;
          const originalRemaining = currentDeck.slice(0, remainingCount);
          if (reorderedCardIds.length !== remainingCount) {
            throw new Error(`Deve reordenar exatamente ${remainingCount} monstros.`);
          }

          const newTop = [];
          for (const id of reorderedCardIds) {
            const idx = originalRemaining.findIndex(x => x === id);
            if (idx === -1) throw new Error("ID de monstro reordenado inválido.");
            newTop.push(originalRemaining[idx]);
            originalRemaining.splice(idx, 1);
          }

          currentDeck.splice(0, remainingCount, ...newTop);
          session.pendingIntentionLook = null;
          session.log.unshift(`${player.name} reorganizou o topo do baralho de Monstros.`);
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
