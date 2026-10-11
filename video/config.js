// Content for the Save the Date reel. Edit this file, then run `node video/render.cjs`.
window.CONFIG = {
  couple: {
    // Intro title, exactly as requested: "Shantanu weds Pragati".
    groom: "Shantanu",
    bride: "Pragati",
    // Names as shown in "Meet the couple" and the closing.
    groomFull: "Shantanu",
    brideFull: "Dr. Pragati",
    groomRole: "Product Manager",
    groomOrg: "Paytm",
    brideRole: "Pediatrician",
    brideOrg: "AIIMS New Delhi",
    groomParents: "Son of Shri. Pradeep Jain & Smt. Sanjana Jain",
    brideParents: "Daughter of Shri. Santosh Jain & Smt. Sarita Jain",
  },
  hashtag: "#SchoolmatesToSoulmates",
  dates: { range: "17 – 20", monthYear: "December 2026" },
  region: "Vidisha & Sanchi · Madhya Pradesh",

  // The six functions, in this order. `art` is the clean plate prep.py makes
  // from that function's invitation (the printed card is replaced by this text).
  events: [
    { name: "Mehndi", day: "Thursday", date: "17 December 2026", time: "3 PM onwards", place: "Home", town: "Vidisha", art: "mehndi" },
    { name: "Dev Darshan", day: "Friday", date: "18 December 2026", time: "8 AM onwards", place: "Home", town: "Vidisha", art: "dev-darshan" },
    { name: "Haldi", day: "Saturday", date: "19 December 2026", time: "Noon onwards", place: "Magadham Grande", town: "Sanchi", art: "haldi" },
    { name: "Sangeet Night", day: "Saturday", date: "19 December 2026", time: "7 PM onwards", place: "Magadham Grande", town: "Sanchi", art: "sangeet" },
    { name: "Reception", day: "Sunday", date: "20 December 2026", time: "Noon onwards", place: "Magadham Grande", town: "Sanchi", art: "reception" },
    { name: "Shaadi", day: "Sunday", date: "20 December 2026", time: "2 PM onwards", place: "Magadham Grande", town: "Sanchi", art: "shaadi" },
  ],

  cta: {
    instagramTitle: "Follow us on Instagram",
    instagramHandles: ["@hello.shantanu", "@jainpragati23"],
    whatsappTitle: "Join the WhatsApp community",
    whatsappSub: "for virtual or in-person celebrations",
    // Shown under the WhatsApp line when set, e.g. "chat.whatsapp.com/AbC123"; left out when empty.
    whatsappLink: "",
  },
  closing: "Awaiting your presence",
};
