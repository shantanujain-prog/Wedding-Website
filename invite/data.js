// Content of the e-invite. Edit, then run `node invite/build.cjs`.
//
// PH(id) marks a detail that is not supplied yet. It prints as a clearly marked
// placeholder, and the last page lists every one. Replace each PH(...) with the
// real text (a string) — or, for map links, a URL string, or a list of them
// (["https://…", "https://…"] or [["Groom's residence", "https://…"], …]) — then build again.
// `node invite/build.cjs --final` refuses to build while any placeholder is left.
const PH = (id) => ({ placeholder: id });

window.PLACEHOLDERS = {
  RES_ADDR: "Bride & Groom Residences — full address(es) in Vidisha, and which residence guests should attend (or both)",
  RES_MAP: "Map link(s) — Bride & Groom Residences (one per residence)",
  RES_LOCAL: "Directions within Vidisha to the Bride & Groom Residences (landmark / route)",
  TEMPLE_ADDR: "Jain Temple, Vidisha — full address",
  TEMPLE_MAP: "Map link — Jain Temple, Vidisha",
  TEMPLE_LOCAL: "Directions within Vidisha to the Jain Temple (landmark / route)",
  BHOPAL_VIDISHA: "Distance and drive time, Bhopal to Vidisha",
  VENUE_MAP: "Map link — Magadham Grande, Sanchi",
  BHOPAL_SANCHI: "Distance and drive time, Bhopal to Magadham Grande, Sanchi",
  VIDISHA_SANCHI: "Distance and drive time, Vidisha to Magadham Grande, Sanchi",
  VIDISHA_TRANSPORT: "Transport for the Vidisha functions (Mehndi, Dev Darshan), if any",
};

// Taken as supplied, but worth a yes before printing (listed on the placeholder page, with the
// website's travel lines and the route sentences below, which were written from the address).
window.CONFIRM = [
  ["Wording", "is kept exactly as supplied: Mehndi “…where love glooms.” (blooms?); Reception “Two of us & all you join us…” (all of you?)."],
  ["Dress code", "lists “Groom” and “Bride” for each function, as supplied. Is that what the couple will wear, or the dress code for men and women guests (or for the groom’s and bride’s sides)? The heading and labels can then be worded to match."],
];

const SANCHI = {
  name: "Magadham Grande (Magdham Resort)",
  address: ["Plot No. 6/2, near Kamapar Mandir, Nonakhedi", "Bhopal–Vidisha Road, Sanchi, Raisen", "Madhya Pradesh 464551"],
  map: PH("VENUE_MAP"),
};
const TO_SANCHI = {
  fromBhopal: ["Take the Bhopal–Vidisha Road towards Vidisha to Sanchi; Magadham Grande is at Nonakhedi, near Kamapar Mandir.", PH("BHOPAL_SANCHI")],
  fromVidisha: ["Take the Bhopal–Vidisha Road towards Bhopal to Sanchi; Magadham Grande is at Nonakhedi, near Kamapar Mandir.", PH("VIDISHA_SANCHI")],
};

window.INVITE = {
  couple: {
    groom: "Shantanu",
    bride: "Dr. Pragati",
    groomParents: "Son of Shri. Pradeep Jain & Smt. Sanjana Jain",
    brideParents: "Daughter of Shri. Santosh Jain & Smt. Sarita Jain",
  },
  // wording of the website's invitation
  invitation: "Jain’s cordially invites you to the wedding celebration of our beloved son and daughter",
  dates: "17 – 20 December 2026",
  places: "Vidisha & Sanchi · Madhya Pradesh",
  hashtag: "#SchoolmatesToSoulmates",
  closing: "Awaiting your presence",
  sanchi: SANCHI,
  // arriving from out of town, as on the website's "How to Reach"
  travel: [
    ["By air", "Fly into Raja Bhoj Airport, Bhopal"],
    ["By train", "Arrive at Vidisha Railway Station"],
    ["Pickup", "Private vehicles from Bhopal Airport and Vidisha Railway Station on arrival"],
  ],

  // the six functions, in this order
  events: [
    {
      name: "Mehndi", art: "mehndi",
      day: "Thursday", date: "17 December 2026", time: "3 PM onward",
      subtitle: "A mystical afternoon of Heena Carnival where love glooms.",
      theme: "Blue and green", swatches: [["Blue", "#2B4FA0"], ["Green", "#2F7A4E"]],
      attire: [["", "Ethnic wear for bride and groom"]],
      venue: { place: "Bride & Groom Residences", town: "Vidisha", address: [PH("RES_ADDR")], map: PH("RES_MAP") },
      directions: {
        fromBhopal: ["Travel to Vidisha on the Bhopal–Vidisha Road.", PH("BHOPAL_VIDISHA")],
        fromVidisha: [PH("RES_LOCAL"), PH("VIDISHA_TRANSPORT")],
      },
    },
    {
      name: "Dev Darshan", tag: "Temple", art: "dev-darshan",
      day: "Friday", date: "18 December 2026", time: "8 AM onward",
      subtitle: "A morning starting with blessing from almighty.",
      theme: "White and golden", swatches: [["White", "#FFFFFF"], ["Golden", "#D4A84B"]],
      attire: [["Groom", "Ethnic wear"], ["Bride", "Saree"]],
      venue: { place: "Jain Temple", town: "Vidisha", address: [PH("TEMPLE_ADDR")], map: PH("TEMPLE_MAP") },
      directions: {
        fromBhopal: ["Travel to Vidisha on the Bhopal–Vidisha Road.", PH("BHOPAL_VIDISHA")],
        fromVidisha: [PH("TEMPLE_LOCAL"), PH("VIDISHA_TRANSPORT")],
      },
    },
    {
      name: "Haldi", art: "haldi",
      day: "Saturday", date: "19 December 2026", time: "Noon onward",
      subtitle: "A golden glow for the happiest beginning.",
      theme: "Shades of bright pink, orange, or yellow", swatches: [["Bright pink", "#E8458B"], ["Orange", "#F28C28"], ["Yellow", "#F7C531"]],
      attire: [["Groom", "Ethnic wear"], ["Bride", "Saree, lehenga, or suit"]],
      venue: { place: "Poolside", town: "Magadham Grande Resort, Sanchi", sanchi: true },
      directions: TO_SANCHI,
    },
    {
      name: "Sangeet", art: "sangeet",
      day: "Saturday", date: "19 December 2026", time: "7 PM onward",
      subtitle: "Night of enchantment filled with music, dance and the celebration of love awaits.",
      theme: "Black for men, glitter and glam for women", swatches: [["Black", "#151213"], ["Glitter & glam", "glitter"]],
      attire: [["Groom", "Suits"], ["Bride", "Lehenga or saree"]],
      venue: { place: "Under the stars, Big Lawn", town: "Magadham Grande Resort, Sanchi", sanchi: true },
      directions: TO_SANCHI,
    },
    {
      name: "Reception", art: "reception",
      day: "Sunday", date: "20 December 2026", time: "Noon onward",
      subtitle: "Two of us & all you join us for a flavourful Indian feast.",
      theme: "Royal traditional Indian", swatches: [],
      attire: [["Groom", "Indo-western"], ["Bride", "Lehenga"]],
      venue: { place: "Big Lawn under the sun", town: "Magadham Grande Resort, Sanchi", sanchi: true },
      directions: TO_SANCHI,
    },
    {
      name: "Shaadi", art: "shaadi",
      day: "Sunday", date: "20 December 2026", time: "2 PM onward",
      subtitle: "7 steps towards lifetime of togetherness.",
      theme: "Royal South Indian", swatches: [],
      attire: [["Groom", "Kurta pyjama"], ["Bride", "Lehenga or saree"]],
      venue: { place: "Imperial Hall", town: "Magadham Grande Resort, Sanchi", sanchi: true },
      directions: TO_SANCHI,
    },
  ],
};
