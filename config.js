window.APP_CONFIG = {
  demoPin: "2026",
  trialDays: 3,
  contactPerson: "Thiago Ventura Valêncio",
  contactChannel: "WhatsApp",


  campaign: {
    name: "Copa do Mundo das Vendas",
    store: "Tênis One — Shopping Cidade Norte",
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    teams: {
      verde: { id: "verde", name: "Time Verde", color: "#0e8f56" },
      azul: { id: "azul", name: "Time Azul", color: "#143f91" }
    },
    vendors: [
      { id: "isack", name: "Isack", team: "verde", nickname: "Craque de vendas" },
      { id: "viviane", name: "Viviane", team: "verde", nickname: "Camisa 10" },
      { id: "matheus", name: "Matheus", team: "azul", nickname: "Artilheiro" },
      { id: "brian", name: "Brian", team: "azul", nickname: "Capitão" }
    ],
    prizes: {
      teamChampion: "R$ 100,00 via PIX para cada integrante + 1 folga premiada para cada um.",
      topSeller: "R$ 100,00 via PIX para o artilheiro individual."
    }
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
