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
    reward: "Ao vencer, todos os herois compram 1 carta.",
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
    reward: "Ao vencer, um heroi recupera 2 de Vida.",
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
    reward: "Ao vencer, todos os herois recuperam 1 de Vida.",
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
    reward: "Ao vencer, reduza o Perigo em 1.",
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
    reward: "Ao vencer, cada heroi compra 1 carta e depois descarta 1 carta.",
    effect: "firstRoomRoundEnergyPenalty"
  },
  {
    id: "SALA_006",
    name: "Salao das Correntes",
    subtitle: "Armadilha dominante",
    theme: "crypt",
    setup: { common: 2, brutal: 1 },
    objective: "Derrote todos os inimigos.",
    rule: "Enquanto a Armadilha estiver ativa, herois nao podem comprar cartas extras usando Perigo.",
    reward: "Ao vencer, todos os herois podem descartar 1 carta e comprar 1 carta.",
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
    reward: "Ao vencer, todos os herois recuperam 2 de Vida.",
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
    reward: "Ao vencer, compre 1 Tesouro menor.",
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
    reward: "Ao vencer, todos os herois compram 1 carta.",
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
    reward: "Ao vencer, todos recuperam 2 de Vida.",
    effect: "ritualStartDamage"
  }
];

const trapCards = [
  { id: "TRAP_001", name: "Espinhos no Piso", text: "No final de cada turno da dungeon, todos os herois sofrem 1 de dano.", effect: "endDungeonAllDamage" },
  { id: "TRAP_002", name: "Fome Arcana", text: "No inicio da rodada, herois compram apenas 1 carta.", effect: "drawTwo" },
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

const monsterTemplates = {
  sentinela: {
    id: "sentinela",
    name: "Sentinela Oco",
    category: "common",
    role: "Comum",
    maxLife: 22,
    attack: 3,
    shield: 1,
    icon: "blade"
  },
  salteador: {
    id: "salteador",
    name: "Salteador Cinzento",
    category: "common",
    role: "Comum",
    maxLife: 16,
    attack: 4,
    shield: 0,
    icon: "fang"
  },
  bruxa: {
    id: "bruxa",
    name: "Bruxa do Breu",
    category: "common",
    role: "Comum",
    maxLife: 18,
    attack: 2,
    shield: 3,
    icon: "moon"
  },
  carcereiro: {
    id: "carcereiro",
    name: "Carcereiro Ferrugem",
    category: "common",
    role: "Comum",
    maxLife: 26,
    attack: 3,
    shield: 2,
    icon: "stone"
  },
  colosso: {
    id: "colosso",
    name: "Colosso das Cinzas",
    category: "brutal",
    role: "Brutal",
    maxLife: 42,
    attack: 5,
    shield: 4,
    icon: "stone"
  },
  executor: {
    id: "executor",
    name: "Executor Sombrio",
    category: "brutal",
    role: "Brutal",
    maxLife: 34,
    attack: 6,
    shield: 2,
    icon: "blade"
  },
  basilisco: {
    id: "basilisco",
    name: "Basilisco Azul",
    category: "brutal",
    role: "Brutal",
    maxLife: 30,
    attack: 4,
    shield: 6,
    icon: "moon"
  }
};

const intentionCards = [
  {
    id: "INT_001",
    name: "Pressao Frontal",
    commonText: "Comuns atacam o heroi com mais Vida atual.",
    brutalText: "Brutais atacam o heroi com menos Vida atual.",
    commonTarget: "maxLife",
    brutalTarget: "minLife",
    design: "Divide a pressao entre o heroi saudavel e o vulneravel."
  },
  {
    id: "INT_002",
    name: "Quebra de Defesa",
    commonText: "Comuns atacam o heroi com mais Escudo atual.",
    brutalText: "Brutais atacam o heroi com menos Escudo atual.",
    commonTarget: "maxShield",
    brutalTarget: "minShield",
    design: "Remove protecao e busca o alvo exposto."
  },
  {
    id: "INT_003",
    name: "Cacada ao Exausto",
    commonText: "Comuns atacam o heroi com menos Energia atual.",
    brutalText: "Brutais atacam o heroi que gastou mais Energia nesta rodada.",
    commonTarget: "minEnergy",
    brutalTarget: "maxEnergySpent",
    design: "Pune quem terminou esgotado ou fez uma rodada intensa."
  },
  {
    id: "INT_004",
    name: "Maos Cheias",
    commonText: "Comuns atacam o heroi com mais cartas na mao.",
    brutalText: "Brutais atacam o heroi com menos cartas na mao.",
    commonTarget: "maxHand",
    brutalTarget: "minHand",
    design: "Pressiona quem guardou opcoes e quem esvaziou a mao."
  },
  {
    id: "INT_005",
    name: "Sangue Recente",
    commonText: "Comuns atacam o heroi que recebeu mais Cura nesta rodada.",
    brutalText: "Brutais atacam o heroi com menos Vida atual.",
    commonTarget: "maxHealingReceived",
    brutalTarget: "minLife",
    design: "Cria risco ao concentrar cura em um alvo."
  },
  {
    id: "INT_006",
    name: "Retaliacao",
    commonText: "Comuns atacam o heroi que causou mais dano nesta rodada.",
    brutalText: "Brutais atacam o heroi que derrotou mais inimigos nesta rodada.",
    commonTarget: "maxDamageDealt",
    brutalTarget: "maxEnemiesDefeated",
    design: "Faz o jogador ofensivo chamar a atencao da dungeon."
  },
  {
    id: "INT_007",
    name: "Cerco Simples",
    commonText: "Comuns atacam o heroi com menos Vida atual.",
    brutalText: "Brutais atacam o heroi com menos Vida atual.",
    commonTarget: "minLife",
    brutalTarget: "minLife",
    design: "Concentra todo o dano no alvo mais ferido."
  },
  {
    id: "INT_008",
    name: "Golpe nos Fortes",
    commonText: "Comuns atacam o heroi com mais Vida atual.",
    brutalText: "Brutais atacam o heroi com mais Vida atual.",
    commonTarget: "maxLife",
    brutalTarget: "maxLife",
    design: "Mira o heroi mais resistente."
  },
  {
    id: "INT_009",
    name: "Panico nas Sombras",
    commonText: "Comuns atacam o heroi com menos cartas na mao.",
    brutalText: "Brutais atacam o heroi com menos Energia atual.",
    commonTarget: "minHand",
    brutalTarget: "minEnergy",
    design: "Pune quem se esvaziou demais."
  },
  {
    id: "INT_010",
    name: "Oportunismo",
    commonText: "Comuns atacam o heroi com menos Escudo atual.",
    brutalText: "Brutais atacam o heroi com menos Vida atual.",
    commonTarget: "minShield",
    brutalTarget: "minLife",
    design: "Pressiona defesas baixas e vida baixa."
  },
  {
    id: "INT_011",
    name: "Avanco Pesado",
    commonText: "Comuns atacam o heroi com mais Escudo atual.",
    brutalText: "Brutais atacam o heroi com mais Vida atual.",
    commonTarget: "maxShield",
    brutalTarget: "maxLife",
    design: "Quebra os herois preparados para absorver dano."
  },
  {
    id: "INT_012",
    name: "Cacada ao Preparado",
    commonText: "Comuns atacam o heroi com mais cartas na mao.",
    brutalText: "Brutais atacam o heroi com mais Energia atual.",
    commonTarget: "maxHand",
    brutalTarget: "maxEnergy",
    design: "Mira quem ainda tem recursos guardados."
  },
  {
    id: "INT_013",
    name: "Furia Contra o Atacante",
    commonText: "Comuns atacam o heroi que jogou mais cartas de Ataque nesta rodada.",
    brutalText: "Brutais atacam o heroi que causou mais dano nesta rodada.",
    commonTarget: "maxAttackCardsPlayed",
    brutalTarget: "maxDamageDealt",
    design: "Responde a rodadas muito ofensivas."
  },
  {
    id: "INT_014",
    name: "Ruptura do Ritmo",
    commonText: "Comuns atacam o heroi que jogou mais cartas nesta rodada.",
    brutalText: "Brutais atacam o heroi que jogou menos cartas nesta rodada.",
    commonTarget: "maxCardsPlayed",
    brutalTarget: "minCardsPlayed",
    design: "Agir demais ou se esconder pode ser perigoso."
  },
  {
    id: "INT_015",
    name: "Execucao Coordenada",
    commonText: "Comuns atacam o heroi com menos Escudo atual.",
    brutalText: "Brutais atacam o heroi que sofreu mais dano nesta rodada.",
    commonTarget: "minShield",
    brutalTarget: "maxDamageTaken",
    design: "Prepara um alvo vulneravel e tenta finalizar quem ja sofreu dano."
  }
];

const heroes = {
  guardiao: {
    id: "guardiao",
    name: "Guardiao Solar",
    life: 32,
    energy: 3,
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
    energy: 4,
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
    energy: 3,
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
    cost: 1,
    removeTrap: true,
    text: "Remova a armadilha ativa."
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
    damageTaken: 0
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

function drawEnemyId(session, category) {
  if (category === "common") {
    return drawFromDeck(session, "commonEnemyDeck", "commonEnemyDiscard", makeEnemyDeck("common"));
  }
  return drawFromDeck(session, "brutalEnemyDeck", "brutalEnemyDiscard", makeEnemyDeck("brutal"));
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
  const lifeMultiplier = 0.7 + (roomNum - 1) * 0.3;
  const baseLifeWithBonus = template.maxLife + lifeBonus;
  const finalLife = Math.max(1, Math.floor(baseLifeWithBonus * lifeMultiplier));
  const finalAttack = Math.max(1, template.attack * roomNum);

  return {
    uid: randomUUID(),
    ...template,
    maxLife: finalLife,
    life: finalLife,
    shield: template.shield + shieldBonus,
    maxShield: template.shield + shieldBonus,
    attack: finalAttack
  };
}

function createEnemiesForRoom(session) {
  const enemies = [];
  for (let i = 0; i < session.room.setup.common; i += 1) {
    enemies.push(createEnemy(session, drawEnemyId(session, "common")));
  }
  for (let i = 0; i < session.room.setup.brutal; i += 1) {
    enemies.push(createEnemy(session, drawEnemyId(session, "brutal")));
  }
  return enemies;
}

function drawNextRoom(session) {
  if (session.roomDeck.length === 0) {
    session.roomDeck = shuffle(session.roomDiscard.length ? session.roomDiscard : roomCards);
    session.roomDiscard = [];
  }
  if (session.room) session.roomDiscard.push(session.room);
  session.room = session.roomDeck.shift() || roomCards[0];
  session.roomRound = 1;
  session.roomRewardClaimed = false;
  session.roomNumber = (session.roomNumber || 1) + 1;
  drawTrap(session);
  session.enemies = createEnemiesForRoom(session);
  const roomNum = session.roomNumber;
  const lifePct = Math.round((0.7 + (roomNum - 1) * 0.3) * 100);
  session.log.unshift(`[Sala ${roomNum}] Sala revelada: ${session.room.name}. Vida Inimiga: ${lifePct}%, Dano Inimigo: x${roomNum}. ${session.room.objective}`);
}

function setupCurrentRoom(session) {
  session.roomRound = 1;
  session.roomRewardClaimed = false;
  drawTrap(session);
  session.enemies = createEnemiesForRoom(session);
  const roomNum = session.roomNumber || 1;
  const lifePct = Math.round((0.7 + (roomNum - 1) * 0.3) * 100);
  session.log.unshift(`[Sala ${roomNum}] Sala revelada: ${session.room.name}. Vida Inimiga: ${lifePct}%, Dano Inimigo: x${roomNum}. ${session.room.objective}`);
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
  return session.activeTrap?.effect === "drawTwo" ? 1 : 2;
}

function applyStartOfRoundEffects(session) {
  session.firstEnemyDamageApplied = false;
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
}

function applyDamageToHero(session, target, amount, source, sourceEnemy = null, options = {}) {
  if (!target || target.life <= 0 || amount <= 0) return 0;
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

  const blocked = Math.min(target.shield, amount);
  target.shield -= blocked;
  const damage = amount - blocked;
  target.life = Math.max(0, target.life - damage);
  target.roundStats.damageTaken += damage;
  if (damage > 0) {
    pushVisualEvent(session, {
      type: "damage",
      targetType: "hero",
      targetId: target.id,
      amount: damage,
      source
    });
  }
  session.log.unshift(`${source} causou ${damage} de dano em ${target.name}${blocked ? ` (${blocked} bloqueado)` : ""}.`);
  if (damage > 0 && target.reflectDamage > 0 && sourceEnemy?.life > 0) {
    applyDamageToEnemy(session, sourceEnemy, target.reflectDamage, `${target.name} refletiu`, false);
  }
  return damage;
}

function applyDamageToEnemy(session, target, amount, source, ignoreShield = false, player = null) {
  if (!target || target.life <= 0 || amount <= 0) return 0;
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
    `${source}: ${shieldDamage} no escudo e ${lifeDamage} de dano em ${target.name}${ignoreShield ? " (ignorou Escudo)" : ""}.`
  );
  if (target.life === 0) {
    if (player) player.roundStats.enemiesDefeated += 1;
    session.log.unshift(`${target.name} foi derrotado.`);
    if (player && session.activeTrap?.effect === "damageOnKill") {
      applyDamageToHero(session, player, 1, session.activeTrap.name);
    }
    applyRoomReward(session);
  }
  return lifeDamage;
}

function applyRoomReward(session) {
  if (session.roomRewardClaimed || !isRoomComplete(session)) return;
  session.roomRewardClaimed = true;
  const activePlayers = session.players.filter((player) => player.life > 0);

  if (["SALA_001", "SALA_009"].includes(session.room.id)) {
    activePlayers.forEach((player) => drawCards(player, 1));
    session.log.unshift("Recompensa da sala: todos os herois compraram 1 carta.");
    return;
  }
  if (session.room.id === "SALA_002") {
    const target = selectTarget(session.players, "minLife");
    if (target) {
      const before = target.life;
      target.life = Math.min(target.maxLife, target.life + 2);
      const healed = target.life - before;
      if (healed > 0) {
        pushVisualEvent(session, {
          type: "heal",
          targetType: "hero",
          targetId: target.id,
          amount: healed,
          source: "Recompensa da sala"
        });
      }
    }
    session.log.unshift(`Recompensa da sala: ${target?.name || "um heroi"} recuperou 2 de Vida.`);
    return;
  }
  if (session.room.id === "SALA_003") {
    activePlayers.forEach((player) => {
      const before = player.life;
      player.life = Math.min(player.maxLife, player.life + 1);
      const healed = player.life - before;
      if (healed > 0) {
        pushVisualEvent(session, {
          type: "heal",
          targetType: "hero",
          targetId: player.id,
          amount: healed,
          source: "Recompensa da sala"
        });
      }
    });
    session.log.unshift("Recompensa da sala: todos recuperaram 1 de Vida.");
    return;
  }
  if (session.room.id === "SALA_007" || session.room.id === "SALA_010") {
    activePlayers.forEach((player) => {
      player.life = Math.min(player.maxLife, player.life + 2);
    });
    session.log.unshift("Recompensa da sala: todos recuperaram 2 de Vida.");
    return;
  }
  if (session.room.id === "SALA_005" || session.room.id === "SALA_006") {
    activePlayers.forEach((player) => drawCards(player, 1));
    session.log.unshift("Recompensa da sala: cada heroi comprou 1 carta. O descarte opcional fica para uma acao futura.");
    return;
  }
  session.log.unshift(`Recompensa da sala registrada: ${session.room.reward}`);
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
    roundStats: makeRoundStats(),
    deck: [],
    hand: [],
    played: [],
    discard: [],
    supremeCard: null,
    supremeUsed: false,
    pendingDiscard: 0
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
  const maxDrawn = Math.max(0, 5 - player.hand.length);
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
  drawIntention(session);
  session.log.unshift("A partida comecou. Cada heroi comprou exatamente 5 cartas.");
}

function startNextRound(session) {
  if (session.status !== "playing") throw new Error("A partida ainda nao comecou.");
  if (session.turn !== "dungeon" || !session.dungeonResolved) {
    throw new Error("A proxima rodada so comeca depois do turno da dungeon.");
  }
  session.round += 1;
  session.turn = "players";
  session.dungeonResolved = false;
  session.dungeonQueue = [];
  session.pendingReaction = null;
  const completedRoom = isRoomComplete(session);
  if (completedRoom) {
    archiveCurrentEnemies(session);
    drawNextRoom(session);
  } else {
    session.roomRound += 1;
  }
  session.arena = [];
  session.enemies.forEach((enemy) => {
    enemy.isStunned = false;
  });
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
    const cardsToDraw = getRoundDrawCount(session);
    const drawn = drawCards(player, cardsToDraw);
    session.log.unshift(`${player.name} comprou ${drawn} de ${cardsToDraw} cartas na rodada ${session.round}.`);
  });
  applyStartOfRoundEffects(session);
  session.enemies.forEach((enemy) => {
    enemy.forcedTargetId = null;
  });
  drawIntention(session);
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
  if (player.energy < card.cost) throw new Error("Energia insuficiente.");
  if (card.lowLifeMax && player.life > card.lowLifeMax) {
    throw new Error(`${card.name} so pode ser usada com ${card.lowLifeMax} de Vida ou menos.`);
  }
  if (card.type === "heal" && session.activeTrap?.effect === "noHealing") {
    throw new Error(`Cura bloqueada pela armadilha ${session.activeTrap.name}.`);
  }
  if (card.type === "draw" && session.activeTrap?.effect === "noExtraDraw") {
    throw new Error(`Compra extra bloqueada pela armadilha ${session.activeTrap.name}.`);
  }

  player.hand.splice(cardIndex, 1);
  player.energy -= card.cost;
  player.roundStats.energySpent += card.cost;
  player.roundStats.cardsPlayed += 1;
  if (card.type === "attack") player.roundStats.attackCardsPlayed += 1;
  player.played.push(card);

  const arenaCard = {
    uid: card.uid,
    id: card.id,
    heroId: card.heroId,
    name: card.name,
    type: card.type,
    cost: card.cost,
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
    playedBy: player.name
  };
  session.arena.unshift(arenaCard);

  // Consume next attack bonus if it's an attack card
  let attackBuff = 0;
  if (player.nextAttackBonus && (card.damage || card.areaDamage || card.id === "flecha-explosiva" || card.id === "execucao")) {
    attackBuff = player.nextAttackBonus;
    player.nextAttackBonus = 0;
  }

  if (card.areaDamage) {
    const targets = session.enemies.filter((enemy) => enemy.life > 0);
    targets.forEach((enemy) =>
      applyDamageToEnemy(session, enemy, Math.max(0, card.areaDamage + attackBuff - getHeroAttackPenalty(session)), card.name, false, player)
    );
  }

  if (card.damage) {
    resolveHeroAttack(session, player, card, payload.targetId, attackBuff);
  }

  if (card.selfBlock) {
    player.shield += card.selfBlock;
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

  // energy to an ally (inspiracao)
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
    session.log.unshift(`${player.name} purificou a armadilha ${trapName}!`);
  }

  // suprema: luz-da-esperanca
  if (card.supremeEffects) {
    session.players.filter((ally) => ally.life > 0).forEach((ally) => {
      applyHealToHero(session, ally, 5, card.name);
      ally.shield += 5;
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
      applyDamageToEnemy(session, target, Math.max(0, 4 + attackBuff - getHeroAttackPenalty(session)), card.name, false, player);
      session.enemies.filter((enemy) => enemy.uid !== target.uid && enemy.life > 0).forEach((other) => {
        applyDamageToEnemy(session, other, Math.max(0, 2 - getHeroAttackPenalty(session)), card.name, false, player);
      });
      session.log.unshift(`${player.name} jogou Flecha Explosiva! 4 de dano (modificado para ${Math.max(0, 4 + attackBuff - getHeroAttackPenalty(session))}) em ${target.name} e 2 de dano em area nos demais.`);
    }
  }

  if (card.stun) {
    const target = session.enemies.find((enemy) => enemy.uid === payload.targetId && enemy.life > 0) || session.enemies.find((enemy) => enemy.life > 0);
    if (target) {
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
        applyDamageToEnemy(session, target, Math.max(0, 5 + attackBuff - getHeroAttackPenalty(session)), card.name, false, player);
        session.log.unshift(`${player.name} usou Execucao em ${target.name} (Brutal) e causou ${Math.max(0, 5 + attackBuff - getHeroAttackPenalty(session))} de dano.`);
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
}

function applyHealToHero(session, target, amount, source) {
  if (session.activeTrap?.effect === "noHealing") return;
  const before = target.life;
  target.life = Math.min(target.maxLife, target.life + amount);
  const healed = target.life - before;
  if (healed > 0) {
    target.roundStats.healingReceived += healed;
    pushVisualEvent(session, { type: "heal", targetType: "hero", targetId: target.id, amount: healed, source });
  }
}

function resolveHeroAttack(session, player, card, targetId, attackBuff = 0) {
  const target =
    session.enemies.find((enemy) => enemy.uid === targetId && enemy.life > 0) ||
    session.enemies.find((enemy) => enemy.life > 0);
  if (!target) throw new Error("Nao ha monstros vivos para atacar.");

  const totalDamage = Math.max(0, card.damage + attackBuff - getHeroAttackPenalty(session));
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
  const intention = session.activeIntention;
  session.log.unshift(`Turno da dungeon: ${intention.name}.`);

  if (!isRoomComplete(session)) {
    const brutalsFirst = session.room.effect === "brutalsFirst" || session.activeTrap?.effect === "brutalsFirst";
    if (brutalsFirst) {
      queueEnemyGroup(session, "brutal", intention.brutalTarget, intention.brutalText);
      queueEnemyGroup(session, "common", intention.commonTarget, intention.commonText);
    } else {
      queueEnemyGroup(session, "common", intention.commonTarget, intention.commonText);
      queueEnemyGroup(session, "brutal", intention.brutalTarget, intention.brutalText);
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
    const attack = computeEnemyAttack(session, enemy, target, true);
    const eligiblePlayerIds = getReactionEligiblePlayers(session).map((player) => player.id);

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
    resolveEnemyAttack(session, enemy, target);
  }

  finishDungeonTurn(session);
}

function finishDungeonTurn(session) {
  applyEndOfDungeonEffects(session);
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
    maxDamageTaken: player.roundStats.damageTaken
  };
  return values[criterion] ?? 0;
}

function universalTieBreak(a, b, allPlayers) {
  if (a.life !== b.life) return a.life - b.life;
  if (a.shield !== b.shield) return a.shield - b.shield;
  if (a.hand.length !== b.hand.length) return a.hand.length - b.hand.length;
  return allPlayers.indexOf(a) - allPlayers.indexOf(b);
}

function computeEnemyAttack(session, enemy, target, commitFirstBonus) {
  const forcedTarget = session.players.find((player) => player.id === enemy.forcedTargetId && player.life > 0);
  if (forcedTarget) target = forcedTarget;
  let attack = enemy.attack;
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

  return attack;
}

function resolveEnemyAttack(session, enemy, target, overrideAttack = null) {
  const forcedTarget = session.players.find((player) => player.id === enemy.forcedTargetId && player.life > 0);
  if (forcedTarget) target = forcedTarget;
  const attack = overrideAttack ?? computeEnemyAttack(session, enemy, target, true);
  const damage = applyDamageToHero(session, target, attack, enemy.name, enemy);
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
    room: session.room,
    enemies: session.enemies,
    activeTrap: session.activeTrap,
    roomDeckCount: session.roomDeck.length,
    trapDeckCount: session.trapDeck.length,
    activeIntention: session.activeIntention,
    intentionDeckCount: session.intentionDeck.length,
    intentionDiscardCount: session.intentionDiscard.length,
    pendingReaction: session.pendingReaction,
    pendingShieldAllocation: session.pendingShieldAllocation,
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
      roundStats: player.roundStats,
      deckCount: player.deck.length,
      handCount: player.hand.length,
      discardCount: player.discard.length,
      supremeCard: player.id === viewerId ? player.supremeCard : null,
      supremeUsed: player.supremeUsed,
      pendingDiscard: player.id === viewerId ? (player.pendingDiscard || 0) : 0,
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
        } else if (body.type === "startNextRound" || body.type === "newRound") {
          startNextRound(session);
        } else if (body.type === "playCard") {
          playCard(session, player, body);
        } else if (body.type === "buyCard") {
          if (session.status !== "playing") throw new Error("A partida ainda nao comecou.");
          if (session.turn !== "players") throw new Error("Agora e o turno da dungeon.");
          if (player.turnEnded) throw new Error("Voce ja finalizou seu turno.");
          if (player.hand.length >= 5) throw new Error("Mao cheia! O limite maximo e de 5 cartas.");
          if (player.energy < 1) throw new Error("Energia insuficiente para comprar carta.");

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
              ally.energy = Math.min(ally.maxEnergy + 2, ally.energy + 2);
              pushVisualEvent(session, { type: "shield", targetType: "hero", targetId: ally.id, amount: 5, source: sc.name });
              drawCards(ally, 1);
            });
            session.log.unshift(`${player.name} usou ${sc.name}! Todos receberam Cura 5, Escudo 5, Energia +2 e compraram 1 carta.`);
          } else if (sc.id === "tempestade-de-flechas") {
            const targets = session.enemies.filter((enemy) => enemy.life > 0);
            // 6 area damage
            targets.forEach((enemy) =>
              applyDamageToEnemy(session, enemy, Math.max(0, 6 - getHeroAttackPenalty(session)), sc.name, false, player)
            );
            // 8 single target damage to highest current life enemy
            const aliveTargets = session.enemies.filter((enemy) => enemy.life > 0);
            let singleTarget = null;
            if (aliveTargets.length > 0) {
              aliveTargets.sort((a, b) => b.life - a.life);
              singleTarget = aliveTargets[0];
              applyDamageToEnemy(session, singleTarget, Math.max(0, 8 - getHeroAttackPenalty(session)), sc.name, false, player);
            }
            session.log.unshift(`${player.name} usou ${sc.name}! Causou 6 de dano em todos os inimigos e 8 de dano adicional em ${singleTarget ? singleTarget.name : "nenhum inimigo"}.`);
          } else if (sc.id === "bastiao-supremo") {
            player.shield += 8;
            player.bastiaoSupremoActive = true;
            pushVisualEvent(session, { type: "shield", targetType: "hero", targetId: player.id, amount: 8, source: sc.name });
            session.log.unshift(`${player.name} usou ${sc.name}! Recebeu 8 de Escudo, redirecionara todo o dano aliado a si mesmo e reduzira todo o dano sofrido pela metade ate a proxima rodada.`);
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
              target.shield = Number(amount);
              if (Number(amount) > 0) pushVisualEvent(session, { type: "shield", targetType: "hero", targetId: pid, amount: Number(amount), source: "Escudo redistribuido" });
            }
          });
          session.pendingShieldAllocation = null;
          session.log.unshift(`${player.name} redistribuiu os escudos entre os aliados.`);
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
