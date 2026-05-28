window.APP_CONFIG = {
  managerPassword: "2026",
  sellerPassword: "vendas",
  trialDays: 3,
  contactPerson: "Thiago Ventura Valêncio",
  contactChannel: "WhatsApp",

  campaign: {
    name: "Copa do Mundo das Vendas",
    store: "Tênis One — Shopping Cidade Norte",
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    productsRule: "Todos os produtos da loja contam.",
    bonusRuleNote: "A regra 'maior meta batida' ainda precisa ser confirmada pelo Saulo. Nesta demonstração, o gerente escolhe se o bônus será automático por faturamento da dezena ou manual.",
    prizes: {
      teamChampion: "R$ 100,00 via PIX para cada integrante + 1 folga premiada para cada um.",
      topSeller: "R$ 100,00 via PIX para o artilheiro individual."
    },
    teams: {
      verde: { id: "verde", name: "Time Verde", color: "#0b7f49" },
      azul: { id: "azul", name: "Time Azul", color: "#143f91" }
    },
    vendors: [
      {
        id: "isack",
        name: "Isack",
        shortName: "Isack",
        team: "verde",
        shirtNumber: 10,
        rarity: "legendary",
        title: "Craque da Rodada",
        subtitle: "Rumo à taça de vendas",
        albumOrder: 1,
        specialType: "normal",
        showInAlbum: true,
        active: true
      },
      {
        id: "viviane",
        name: "Viviane",
        shortName: "Viviane",
        team: "verde",
        shirtNumber: 8,
        rarity: "gold",
        title: "Camisa 10",
        subtitle: "Força do Time Verde",
        albumOrder: 2,
        specialType: "normal",
        showInAlbum: true,
        active: true
      },
      {
        id: "matheus",
        name: "Matheus",
        shortName: "Matheus",
        team: "azul",
        shirtNumber: 7,
        rarity: "silver",
        title: "Artilheiro",
        subtitle: "Pontaria nas vendas",
        albumOrder: 3,
        specialType: "normal",
        showInAlbum: true,
        active: true
      },
      {
        id: "brian",
        name: "Brian",
        shortName: "Brian",
        team: "azul",
        shirtNumber: 11,
        rarity: "classic",
        title: "Capitão",
        subtitle: "Liderança em campo",
        albumOrder: 4,
        specialType: "normal",
        showInAlbum: true,
        active: true
      }
    ]
  },

  firebase: {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },

  cloudinary: {
    cloudName: "",
    uploadPreset: ""
  }
};