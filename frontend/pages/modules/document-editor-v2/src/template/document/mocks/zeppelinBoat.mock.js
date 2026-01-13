export default {
  _id: "boat_001",
  brand: "Zeppelin",
  model: "Z850",
  year: 2024,

  engine: {
    brand: "Mercury",
    type: "V8",
    power: "300 HP",
    consumption: "45 L/h"
  },

  dimensions: {
    length: "8.5 m",
    width: "3.1 m"
  },

  annexes: [
    {
      title: "Certificat CE",
      type: "pdf",
      url: "/docs/certificat-ce.pdf"
    },
    {
      title: "Plan moteur",
      type: "image",
      url: "/docs/engine-plan.png"
    }
  ]
};
