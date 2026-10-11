#!/usr/bin/env node
// Render the Save the Date reel (1080x1920, 30 fps, H.264 + AAC) from scene.html.
//
//   node video/render.cjs                      # full video -> video/out/save-the-date.mp4 (60 s)
//   node video/render.cjs --stills 1,12.5,40   # PNG frames at those seconds -> video/out/stills/
//   node video/render.cjs --from 10 --to 14    # render only part of the timeline
//   node video/render.cjs --no-audio
//
// Needs Playwright (Chromium) and ffmpeg. Each frame is drawn by window.seek(t)
// in a headless browser and piped to ffmpeg, so the output is deterministic.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

let chromium;
try { ({ chromium } = require("playwright")); } catch {
  ({ chromium } = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright")));
}

const ROOT = __dirname;
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i < 0 ? def : args[i + 1]; };
const FPS = +opt("fps", 30);
const OUT = path.resolve(opt("out", path.join(ROOT, "out", "save-the-date.mp4")));
const SONG = path.join(ROOT, "..", "custom", "wedding-song.mp3");
const SONG_START = +opt("song-start", 9); // seconds into the song (its intro is near-silent)
const BELL = path.join(ROOT, "assets", "audio", "bell.mp3"); // the website's bell sound
const stills = opt("stills", null);

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2" };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

(async () => {
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/scene.html`;
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb", "--disable-lcd-text", "--font-render-hinting=none"] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => { console.error("page error:", e.message); process.exitCode = 1; });
  page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
  await page.goto(url);
  const duration = await page.evaluate(() => window.ready);
  const schedule = await page.evaluate(() => window.SCHEDULE);
  const AUDIO = await page.evaluate(() => window.AUDIO);
  console.log(`duration ${duration.toFixed(2)} s`);
  console.log(schedule.map((s, i) => `  #${i} ${s.t0.toFixed(2)}–${s.t1.toFixed(2)} ${s.tr || ""}`).join("\n"));
  const cdp = await page.context().newCDPSession(page);
  const grab = async (t, format = "png") => {
    await page.evaluate((t) => window.seek(t), t);
    const { data } = await cdp.send("Page.captureScreenshot", { format, quality: format === "jpeg" ? 95 : undefined, optimizeForSpeed: true });
    return Buffer.from(data, "base64");
  };

  if (stills) {
    const dir = path.join(ROOT, "out", "stills");
    fs.mkdirSync(dir, { recursive: true });
    for (const s of stills.split(",").map(Number)) {
      const f = path.join(dir, `t${s.toFixed(2).padStart(6, "0")}.png`);
      fs.writeFileSync(f, await grab(s));
      console.log("wrote", path.relative(process.cwd(), f));
    }
  } else {
    const from = +opt("from", 0), to = Math.min(+opt("to", duration), duration);
    const frames = Math.round((to - from) * FPS);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const audio = !args.includes("--no-audio") && fs.existsSync(SONG);
    const len = frames / FPS;
    // music fades in at AUDIO.musicStart; the website's bell plays at each AUDIO.sfx strike
    const sfx = AUDIO.sfx.filter((s) => s.t >= from && s.t < to);
    const musicAt = Math.max(0, AUDIO.musicStart - from);
    // the song's first bars are quiet: lift them ~3.5 dB until just before its beat drop (19.7 s on the reel)
    const drop = (19.3 - from).toFixed(2);
    const graph = [
      `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(musicAt * 1000)}:all=1,afade=t=in:st=${musicAt.toFixed(2)}:d=2.5,` +
      `volume='0.8*if(lt(t,${drop}),1.5,if(lt(t,${drop}+0.5),1.5-(t-${drop}),1))':eval=frame[song]`,
    ];
    if (sfx.length) graph.push(`[2:a]aresample=48000,aformat=channel_layouts=stereo,asplit=${sfx.length}${sfx.map((_, i) => `[s${i}]`).join("")}`);
    // each strike: pitch shift, fade the recording's clipped tail, then a dense reverb so it rings out;
    // the door bells (first 5 s) are louder, the later ones sit under the music
    sfx.forEach((s, i) => graph.push(
      `[s${i}]asetrate=${Math.round(48000 * s.rate)},aresample=48000,afade=t=out:st=${(1.4 / s.rate - 0.6).toFixed(2)}:d=0.55,apad=pad_dur=3,` +
      `aecho=0.8:0.7:40|90|160|260|400|620:0.5|0.4|0.32|0.24|0.16|0.1,volume=${((s.t < 5 ? 3.6 : 2.4) * s.gain).toFixed(2)},` +
      `adelay=${Math.round((s.t - from) * 1000)}:all=1[b${i}]`));
    graph.push(`[song]${sfx.map((_, i) => `[b${i}]`).join("")}amix=inputs=${sfx.length + 1}:normalize=0:duration=first,` +
      `atrim=0:${len.toFixed(3)},afade=t=out:st=${Math.max(0, len - 3).toFixed(2)}:d=3,alimiter=limit=0.75:attack=2:release=60:level=false[a]`);
    const ff = spawn("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
      ...(audio ? ["-ss", String(SONG_START + Math.max(0, from - AUDIO.musicStart)), "-t", String(len + 1), "-i", SONG, "-i", BELL,
        "-filter_complex", graph.join(";"),
        "-map", "0:v", "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"] : []),
      "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.2",
      "-r", String(FPS), "-movflags", "+faststart", OUT,
    ], { stdio: ["pipe", "inherit", "inherit"] });
    const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg exited " + c)))));
    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      const buf = await grab(from + i / FPS);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if (i % 60 === 0) process.stdout.write(`\rframe ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    ff.stdin.end();
    await done;
    console.log(`\nwrote ${path.relative(process.cwd(), OUT)} (${frames} frames, ${len.toFixed(2)} s)`);
  }
  await browser.close();
  srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
