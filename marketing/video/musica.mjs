// Genera la música del reel con Flow Music (APIMart). La clave se lee de APIMART_API_KEY y nunca se imprime.
import { writeFile } from "node:fs/promises";
const K = process.env.APIMART_API_KEY; if (!K) throw new Error("Falta APIMART_API_KEY");
const H = { Authorization: "Bearer " + K, "Content-Type": "application/json" };
const body = { model: "flowmusic", sound_prompt: process.argv[2], bpm: process.argv[3] || "80", length: +(process.argv[4] || 16) };
const r = await (await fetch("https://api.apimart.ai/v1/music/generations", { method: "POST", headers: H, body: JSON.stringify(body) })).json();
const id = r.data?.[0]?.task_id || r.data?.task_id || r.task_id; if (!id) { console.log(JSON.stringify(r)); process.exit(1); }
console.log("task", id);
for (let i = 0; i < 90; i++) {
  await new Promise((s) => setTimeout(s, 5000));
  const t = await (await fetch(`https://api.apimart.ai/v1/tasks/${id}?language=en`, { headers: H })).json();
  const d = t.data || t; const st = d.status;
  if (st === "completed" || st === "success" || st === "succeeded") {
    const txt = JSON.stringify(d); const u = (txt.match(/https?:[^"]+\.(mp3|wav|m4a|aac|flac)[^"]*/i) || [])[0];
    console.log("cost", d.cost ?? d.cost_usd ?? d.usage ?? "?");
    if (!u) { console.log(txt.slice(0, 800)); process.exit(1); }
    const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
    const ext = u.match(/\.(mp3|wav|m4a|aac|flac)/i)[1];
    await writeFile(`${process.argv[5] || "audio/musica"}.${ext}`, buf); console.log("ok", ext, buf.length); process.exit(0);
  }
  if (/fail|error|cancel/i.test(st || "")) { console.log(JSON.stringify(d).slice(0, 600)); process.exit(1); }
}
console.log("timeout");
