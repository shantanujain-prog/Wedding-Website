# Shantanu weds Dr. Pragati: wedding website video brief

Everything on the wedding website that a video needs: the wording, dates, venues, colours, fonts, the order of the sections, the motion, the music and the image files. All of it was read from the live site on 11 Oct 2026.

Reference screenshots of every scroll position are in [`screens/`](screens/). Phone frames are 390×844 at 2× (780×1688 px) and desktop frames are 1440×900. The countdown digits in them show the time of capture, not the wedding.

---

## 1. At a glance

| | |
|---|---|
| Couple | **Shantanu** and **Dr. Pragati** |
| Hero line | Shantanu *weds* Dr. Pragati |
| Hashtag | **#SchoolmatesToSoulmates** |
| Wedding days | Thu 17 Dec to Sun 20 Dec 2026 |
| Main venue | Magadham Grande Resort & Banquets, Sanchi (Madhya Pradesh) |
| Other venue | Home, Vidisha (Mehndi, Dev Darshan) |
| Faith | Jain: Shri Mahaviraya Namah emblem, swastik lotus, Mangalam shlok |
| Look and feel | Warm cream and copper, gold ornaments, hanging temple bells, marigold torans, Sanchi stupa, peacocks, lotus pond with a decorated elephant |
| Website | Runs locally at `http://localhost:8080/` (`cd ~/Wedding-Website && npm start`). It is not online yet. |

---

## 2. Wording on the site (exact text)

### Loader (first screen)
- `॥ शुभ विवाह ॥`
- `TAP TO OPEN THE INVITATION`
- Button: `OPEN INVITATION`
- A progress ring counts 0 → 100% in the middle of a mandala.

### Hero
- `Shantanu` / `weds` / `Dr. Pragati`
- `#SchoolmatesToSoulmates`

### Invitation card
- Emblem image: **श्री महावीराय नमः**
- Swastik lotus icon
- Shlok (image, two lines):
  > मंगलं भगवान वीरो, मंगलं गौतमो गणी।
  > मंगलं कुन्दकुन्दार्यो, जैनधर्मोऽस्तु मंगलम्॥
- `Jain’s cordially invites you`
- `to the wedding celebration of`
- `our beloved son and daughter`
- **Shantanu**, `Son of`, `Shri. Pradeep Jain & Smt. Sanjana Jain`
- *and*
- **Dr. Pragati**, `Daughter of`, `Shri. Santosh Jain & Smt. Sarita Jain`
- `On The Following Events` (desktop: `On the following events`)

### Wedding Timeline
Heading: `Wedding Timeline` (desktop: `Wedding Celebration Timeline`). Subtext: `Mark Your Calendars, We Can’t Wait to Celebrate`.

| # | Event | Day | Date | Venue (as on card) | Time |
|---|---|---|---|---|---|
| 1 | Mehndi | Thursday | 17th Dec, 2026 | Home, Vidisha | 3 PM Onwards |
| 2 | Dev Darshan | Friday | 18th Dec, 2026 | Home, Vidisha | 8 AM Onwards |
| 3 | Haldi | Saturday | 19th Dec, 2026 | Magadham Grande, Sanchi | 12 PM Onwards |
| 4 | Sangeet Night | Saturday | 19th Dec, 2026 | Magadham Grande, Sanchi | 7 PM Onwards |
| 5 | Reception | Sunday | 20th Dec, 2026 | Magadham Grande, Sanchi | 12 PM Onwards |
| 6 | Shaadi | Sunday | 20th Dec, 2026 | Magadham Grande, Sanchi | 2 PM Onwards |

Each card ends with `More details below`. On the cards, the venue sits on two lines (e.g. "Magadham Grande" / "Sanchi").

### Meet the Bride & Groom
- `Meet the` / `BRIDE & GROOM`
- Message card (template text, see section 9):
  > Our hearts are full and our smiles wide, we can hardly believe our dreamy eyed teen selves made it here! We’re ready to make memories that last a lifetime, and they’ll be incomplete without you by our side. Come celebrate our love, share our joy, eat . till you can’t move and help us make this day a beautiful, laughter-filled blur we’ll never forget!
- `Almost time` / `to celebrate`, with a circle of floating photos

### Looking forward to seeing you (map)
- Heading: `Looking forward to seeing you`
- Two location buttons:

| Button | Map label | Address shown | Pin |
|---|---|---|---|
| Magadham Grande | Haldi · Sangeet · Reception · Shaadi | Magadham Grande Resort & Banquets. Plot No. 6/2, near Kamapar Mandir, Nonakhedi, Bhopal–Vidisha Road, Sanchi, Raisen, Madhya Pradesh 464551 | 23.495654, 77.760716 |
| Home, Vidisha | Mehndi · Dev Darshan | Vidisha, Madhya Pradesh | 23.5251, 77.8081 (town centre) |

- Map overlays: `Tap to interact with map`, `Open in Google Maps`, plus a copy-address button.

### RSVP
- Header: `RSVP via WhatsApp` (desktop: `Please confirm your presence`)
- Fields: `Full Name`, `Select Event`, `No. of People`
- Button: `Send via WhatsApp`

### How to Reach
- `How to Reach`
- `Our celebrations will be held at Magadham Grande Resort & Banquets, Sanchi, on the Bhopal–Vidisha Road. We have arranged private vehicles to bring you to the venue on your arrival.`
- **Venue:** Magadham Grande Resort & Banquets, Sanchi. Plot No. 6/2, near Kamapar Mandir, Nonakhedi, Bhopal–Vidisha Road, Sanchi, Raisen, Madhya Pradesh 464551
- **By Air:** Fly into Raja Bhoj Airport, Bhopal
- **By Train:** Arrive at Vidisha Railway Station
- **Pickup:** Private vehicles from Bhopal Airport and Vidisha Railway Station on arrival
- Button: `Get Directions` (opens Google Maps)

### Things to know
- `Things to know`
- `To help you feel at ease and enjoy every moment of the celebrations, we’ve gathered a few thoughtful details we’d love for you to know before the big day`
- **Hashtag:** While posting photos on social media please use #SchoolmatesToSoulmates
- **Weather:** It will be cold, with temperatures dropping to around 10°C. Please carry warm clothes
- **Parking:** Valet parking for all our guests will be available at the venue

### Countdown
- `The countdown begins`
- `Our families are excited that you are able to join us in celebrating what we hope will be one of the happiest days of our lives`
- Live counter: `DAYS · HOURS · MINUTES · SECONDS`
- Counts down to **19 Dec 2026, 00:00 IST** (`2026-12-18T18:30:00Z`).

---

## 3. Section order (storyboard)

The two layouts order the later sections differently.

### Phone (390 px wide, page height ≈ 6,550 px)

| Frame | Screenshot | What's on screen |
|---|---|---|
| 0 | `phone-00-loader.png` | Loader: marigold toran, mandala ring at 100%, ॥ शुभ विवाह ॥, Open Invitation |
| 1 | `phone-01.png` | Hero: floral arch with hanging bells, names, hashtag, Sanchi stupa, illustrated couple walking down a carpeted path |
| 2 | `phone-02.png` | Invitation card: emblem, swastik, shlok, Jain's invite, Son of / Daughter of, gazebos and peacock bridge |
| 3 | `phone-03.png` | Wedding Timeline: Mehndi, Dev Darshan, Haldi, Sangeet Night cards |
| 4 | `phone-04.png` | Reception and Shaadi cards, lotus divider, decorated mandap |
| 5 | `phone-05.png` | Meet the Bride & Groom message card; "Almost time to celebrate" photo circle |
| 6 | `phone-06.png` | Stock couple photo (see section 9), Looking forward to seeing you, map, location buttons |
| 7 | `phone-07.png` | Things to know (Hashtag, Weather, Parking), RSVP via WhatsApp, How to Reach heading |
| 8 | `phone-08.png` | How to Reach, Get Directions, The countdown begins with live counter, elephant in a lotus pond |

### Desktop (1440 px wide, page height ≈ 13,000 px)

| Frame | Screenshot | What's on screen |
|---|---|---|
| 0 | `desktop-00-loader.png` | Loader |
| 1 | `desktop-01.png` | Hero: names, hashtag, bells, top of the Sanchi stupa in clouds |
| 2 | `desktop-02.png` | Stupa base, couple walking down the carpet between flower urns and gold gates |
| 3 | `desktop-03.png` | Invitation card top: shlok, Jain's invite, Shantanu |
| 4 | `desktop-04.png` | Dr. Pragati, Daughter of, peacock bridge with gazebos |
| 5 | `desktop-05.png` | Garden terrace, "Wedding Celebration Timeline", start of the six cards |
| 6 | `desktop-06.png` | All six cards in one row, lotus divider, mandap |
| 7 | `desktop-07.png` | Mandap seating, "Meet the BRIDE & GROOM" |
| 8 | `desktop-08.png` | Message card |
| 9 | `desktop-09.png` | "Almost time to celebrate" photo circle |
| 10 | `desktop-10.png` | Stock couple photo (see section 9) |
| 11 | `desktop-11.png` | Looking forward to seeing you: map, location buttons, RSVP card |
| 12 | `desktop-12.png` | How to Reach |
| 13 | `desktop-13.png` | Things to know, "The countdown begins" |
| 14 | `desktop-14.png` | Countdown digits, gazebo and elephant |
| 15 | `desktop-15.png` | Elephant in the lotus pond (end of page) |

### Suggested video flow (about 60 seconds, 9:16)
1. **0–5 s:** Loader. Mandala spins, ring fills, tap on Open Invitation. The music starts here on the site.
2. **5–12 s:** Hero. Bells sway, names and hashtag fade in, slow push down the stupa and the walking couple.
3. **12–20 s:** Invitation card. Hold on the shlok, then Son of / Daughter of.
4. **20–32 s:** Timeline. About 2 s per event card.
5. **32–38 s:** Mandap, then Meet the Bride & Groom.
6. **38–46 s:** Venue: map pin at Magadham Grande, then the How to Reach row.
7. **46–52 s:** Things to know: hashtag and weather.
8. **52–60 s:** Countdown ticking, end on the elephant and lotus pond with the hashtag.

---

## 4. Visual identity

### Colour palette
| Role | Hex | Where it shows |
|---|---|---|
| Cream background | `#FFEFE0` | Page and loader background |
| Light cream | `#FFF6EE` | Loader centre, card insides |
| Deep brown (main text) | `#5F250F` | Headings, body text |
| Copper (names, accents) | `#AB5626` | Couple names (at 72% opacity), parents' names, hashtag |
| Gold | `#DDA45D` | Ornaments, dividers, countdown digits, progress ring |
| Sand (map panel) | `#E4BC83` | Address panel, selected button tint |
| Timeline tan | `#E2B980` | Wedding Timeline background (desktop) |
| Grey labels | `#888888` | Countdown unit labels |
| WhatsApp green | `#25D366` | RSVP button |

### Fonts
| Role | Font on the site | Nearest free alternative |
|---|---|---|
| Couple names (hero, invitation) | **Miofarin Regular** (high-contrast display serif) | Playfair Display / Bodoni Moda |
| "weds" and "and" | **Brother Signature** (handwritten script) | Great Vibes / Allura |
| Headings ("Wedding Timeline", "Things to know", event names) | **IvyOra Display** (Regular / Medium / Bold) | Cormorant Garamond |
| Body text, hashtag, card details | **Gotham** (Light / Book / Medium) | Montserrat Light |
| Devanagari loader text (॥ शुभ विवाह ॥) | **Tiro Devanagari Hindi** | (same, free on Google Fonts) |
| Shlok image | Baloo 2 Bold (rendered into the image) | (same, free on Google Fonts) |

### Recurring motifs
Floral arch frame with hanging brass bells; marigold torans; the Sanchi stupa; gold arched "pillar" cards with a sunburst base; gold sunburst dividers with four-point stars; peacocks on a stone bridge between two domed gazebos; a pink lotus divider; the decorated mandap with red drapes; an elephant raising a lotus in a lotus pond; a flock of tiny birds drifting across the hero.

---

## 5. Motion on the site (useful to mimic)
- **Loader:** the mandala turns slowly while the progress ring and % count up; a tap on Open Invitation fades it out.
- **Hero entrance:** the temple and bells zoom in, then the bells fade in and sway; the birds are a live animation layer.
- **Scroll reveals:** sections and cards slide up and fade in as they enter the screen, and backgrounds move with parallax.
- **Timeline cards:** rise in one after another.
- **Photo circle:** the "Almost time to celebrate" photos float around the text.
- **Countdown:** ticks every second.
- **Map:** stays still until tapped ("Tap to interact with map"); the buttons switch the pin between the resort and Vidisha.

---

## 6. Music
| | |
|---|---|
| File | `~/Wedding-Website/custom/wedding-song.mp3` (also `wedding-song.webm`) |
| Length | 4:20 (260.5 s) |
| Quality | MP3 96 kbps (the WebM is Opus 64 kbps) |
| On the site | Starts on Open Invitation and loops; mute button bottom-left |

For a short video, use an excerpt. For a better-quality source, use the original 128 kbps upload instead of these compressed copies.

---

## 7. Image files

### On the website (in `~/Wedding-Website/site/framerusercontent.com/images/`)
| What | File | Size |
|---|---|---|
| Hero, desktop (Sanchi stupa and couple, transparent sky) | `lKVzZvE9zjHal1zLmfO4koCjo.webp~width_1515_height_3526.fb7eacac` | 1515×3526 |
| Hero, phone | `Vmh2DwpF7PAgb69W6NahdCwGidA.webp~width_876_height_3156.c0d9b6da` | 876×3156 |
| श्री महावीराय नमः emblem | `kJ6ukGxpOPVxnwLybHzfIL3VtkM.webp~width_168_height_52.51765312` | 336×104 |
| Swastik lotus icon | `5FVM3OmFePuLZFoKyYpESSXgaE.webp~width_94_height_130.d3a0dda3` | 188×260 |
| Mangalam shlok | `4cA2HUMDhUokZACwYXNtj8gs8Os.webp~width_642_height_130.9c69484f` | 1284×260 |
| Floral arch with bells (hero frame) | `Zrnq96rxcNCLdk4Yaz94Dup5Q.webp~width_886_height_464.a403dab2` | 886×464 |
| Hero sky | `ELVgHUKqtqAl9gf1nwbYhSeTg.webp~width_1200_height_968.fd793c07` | 1200×968 |
| Peacock garden backdrop | `ctlwo5LpuBk9eskYOT9Z2MD8wso.webp~width_868_height_4326.daeb3743` | 868×4326 |
| Timeline card frame | `TUkRvFIUDwblbb4eewkBlJzZwJw.png~width_1515_height_2342.11f20eb3` | 1515×2342 |
| Mandap / Meet the couple backdrop | `hUKMKAtrpqFCDTXl35Y5yuIjRw.webp~width_866_height_3244.5690f966` | 866×3244 |
| Location and countdown backdrop | `Ta8VvaJo4SZuTcgz4N8iLLSsLE.webp~width_864_height_5217.07560fd9` | 864×5217 |
| Elephant and lotus pond | `LDGCqdzKnQ5ErPPOpHZbdl96s.webp~width_862_height_1067.2317fa1b` | 862×1067 |

The files are WebP or PNG despite their odd names. Copy one and rename it with a `.webp` or `.png` extension to open it in an editor.

### Originals and other artwork in `~/Downloads` (not all on the website)
| File | Size | Note |
|---|---|---|
| `Sanchi Stupa Wedding Invitation Banner.png` | 725×2170 | Original hero art (black sky) |
| `श्री महावीराय नमः Embossed Emblem.png` | 2172×724 | Original emblem |
| `Mehndi_ A Mystical Afternoon.png` | 941×1672 (portrait) | Event art, not on the site |
| `Romantic Mehndi Garden Invitation.png` | 1672×941 (landscape) | Event art, not on the site |
| `Dev Darshan at Jain Temple.png` | 941×1672 (portrait) | Event art (the "(1)" copy is identical) |
| `Golden Indian Wedding Reception Invitation.png` | 940×1672 (portrait) | Event art, not on the site |
| `Dreamy Indian Wedding Reception.png` | 1672×940 (landscape) | Event art, not on the site |
| `Shadi at Magadham Grande Resort.png` | 940×1672 (portrait) | Event art, not on the site |
| `A Golden Journey of Love.png` | 1536×1024 | Not on the site |
| `Shantanu Weds Pragati.pdf` | 24 pages, 1440×810 pt (16:9) | Invitation deck |

---

## 8. Recording the website

1. Start the site: `cd ~/Wedding-Website && npm start`, then open `http://localhost:8080/`.
2. **Phone-style video (9:16):** in Chrome DevTools device mode use 390×844 at 3× (records at 1170×2532), or record a real phone on the same Wi-Fi at `http://<mac-ip>:8080/`.
3. **Desktop video (16:9):** use a 1440×900 or 1920×1080 window.
4. Wait for the loader to reach 100% before tapping Open Invitation. That tap starts the music.
5. Scroll slowly. Each section animates in as it enters the screen, and fast scrolling skips the animations.
6. The countdown shows real time to 19 Dec 2026, so the numbers depend on the recording date.

---

## 9. Template leftovers to fix before recording, or keep off camera

| Item | Where | Status |
|---|---|---|
| Browser tab title and share preview still say "Ram Mandir \| A Divine Wedding Theme" with a Ram Mandir description and image | Page metadata | Visible in the tab bar and link previews |
| RSVP sends to the template author's WhatsApp number, **+91 98192 00906** | RSVP form | Must be changed before sharing the site |
| RSVP event list is the template's: Mehendi, Sangeet, Wedding Ceremony, Reception | RSVP form | Doesn't match the six events; Dev Darshan and Haldi are missing |
| Photo of an unrelated couple with fireworks | Between "Almost time to celebrate" and "Looking forward to seeing you" | Stock template photo; replace with your own or crop it out |
| Floating photos are stock landscapes | "Almost time to celebrate" | Stock template photos |
| Message card text is the template's ("dreamy eyed teen selves…", with a stray "eat . till") | Meet the Bride & Groom | Replace with your own words |
| Home, Vidisha is pinned to the town centre | Map | Waiting on the exact home address |
| Weather icon shows sun and cloud | Things to know | Text says cold, icon doesn't |
| Parking text is the template's ("Valet parking…") | Things to know | Confirm it's true |
| `/page` (second page) is still the Ram Mandir design | `http://localhost:8080/page` | Don't record it |
