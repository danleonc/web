// Original static vector artwork for this project; no third-party packs or requests.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const packs = JSON.parse(
  readFileSync(
    new URL("../src/chat/sticker-packs.json", import.meta.url),
    "utf8",
  ),
);
const dir = new URL("../public/stickers/", import.meta.url);
mkdirSync(dir, { recursive: true });
const esc = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function face(i) {
  const eyes =
    i % 4 === 1
      ? '<path d="m70 66 8-4 8 4m12 0 8-4 8 4"/>'
      : i % 4 === 2
        ? '<circle cx="77" cy="64" r="3" fill="#354b42"/><path d="m99 65 7-4 7 4"/>'
        : '<circle cx="77" cy="64" r="3" fill="#354b42"/><circle cx="106" cy="64" r="3" fill="#354b42"/>';
  const mouth =
    i % 5 === 3
      ? '<ellipse cx="91" cy="82" rx="5" ry="7"/>'
      : '<path d="M80 81q11 13 23 0"/>';
  return `<g stroke="#354b42" stroke-width="3.5" stroke-linecap="round" fill="none">${eyes}${mouth}</g><ellipse cx="65" cy="76" rx="7" ry="4" fill="#dc8e87" opacity=".5"/><ellipse cx="117" cy="76" rx="7" ry="4" fill="#dc8e87" opacity=".5"/>`;
}
function artwork(m, c, i) {
  const stroke = 'stroke="#fffdf7" stroke-width="7" stroke-linejoin="round"';
  const f = face(i);
  switch (m) {
    case "cat":
      return `<path d="m48 54 1-38 32 19q15-5 29 1l28-20-1 40c20 53-9 62-43 62S38 105 48 54Z" fill="${c}" ${stroke}/><path d="m54 41 1-15 16 13m47 1 14-13-1 17" fill="#e89b91"/><path d="m50 79-23-4m23 13-23 5m109-14 21-4m-21 13 21 5" stroke="#695e4b" stroke-width="3" stroke-linecap="round"/>${f}`;
    case "dog":
      return `<ellipse cx="92" cy="67" rx="47" ry="48" fill="${c}" ${stroke}/><path d="M56 30C18 19 20 103 51 96l16-60m59-6c39-11 37 73 6 66l-16-60" fill="#896a55" ${stroke}/><ellipse cx="93" cy="83" rx="24" ry="24" fill="#f1d6b6"/>${f}<path d="m85 76 7 7 8-7Z" fill="#354b42"/>`;
    case "star":
      return `<path d="m91 9 23 31 39 8-23 32 4 36-41-13-38 14 2-40-25-30 38-8Z" fill="${c}" ${stroke}/>${f}`;
    case "cup":
      return `<path d="M128 53c51-12 45 53 0 44" stroke="#fffdf7" stroke-width="20"/><path d="M128 53c51-12 45 53 0 44" stroke="${c}" stroke-width="9"/><path d="M44 41h90v46c0 44-90 44-90 0Z" fill="${c}" ${stroke}/><ellipse cx="89" cy="41" rx="45" ry="8" fill="#83654d" stroke="#fffdf7" stroke-width="5"/><path d="M71 28c-11-12 12-13 1-25m28 26c-11-12 12-13 1-25" stroke="#b5a58b" stroke-width="4" fill="none" stroke-linecap="round"/>${f}`;
    case "gift":
      return `<rect x="40" y="44" width="103" height="68" rx="13" fill="${c}" ${stroke}/><path d="M38 43h107v18H38Z" fill="#efd0a1" ${stroke}/><path d="M92 44v67" stroke="#fff7df" stroke-width="10"/><path d="M90 42C33 16 77-3 90 42c60-27 15-45 0 0Z" fill="#d58d6f" ${stroke}/>${f}<path d="m19 37 8 4m133-13-7 7m-7 91 6 4" stroke="#d5a24c" stroke-width="4"/>`;
    case "cloud":
      return `<path d="M48 104C9 106 14 57 48 57c-2-44 52-55 68-18 41-9 57 51 22 64Z" fill="${c}" ${stroke}/>${f}`;
    case "planet":
      return `<circle cx="92" cy="66" r="46" fill="${c}" ${stroke}/><ellipse cx="91" cy="73" rx="77" ry="17" transform="rotate(-23 91 73)" stroke="#fffdf7" stroke-width="13" fill="none"/><ellipse cx="91" cy="73" rx="77" ry="17" transform="rotate(-23 91 73)" stroke="#e9bf7c" stroke-width="6" fill="none"/>${f}<path d="m24 15 4 9 10 4-10 4-4 10-4-10-9-4 9-4Z" fill="#eac974"/>`;
    case "heart":
      return `<path d="M91 113C-14 51 45-13 91 29c46-42 107 22 0 84Z" fill="${c}" ${stroke}/>${f}<path d="M40 99q-17 18-22-4m122 4q17 18 22-4" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round"/>`;
    case "calendar":
      return `<rect x="42" y="25" width="101" height="87" rx="16" fill="${c}" ${stroke}/><path d="M43 49h98" stroke="#fffdf7" stroke-width="6"/><path d="M64 16v20m56-20v20" stroke="#546b5a" stroke-width="7" stroke-linecap="round"/>${f}`;
    case "plant":
      return `<path d="M90 61V31m0 16C42 44 50-4 90 31c45-33 54 13 0 16Z" fill="${c}" stroke="#fffdf7" stroke-width="6" stroke-linejoin="round"/><path d="m50 50 8 59h69l9-59Z" fill="#d4a080" ${stroke}/>${f}`;
    case "bubble":
      return `<path d="M40 44c-12-34 99-43 106 0 12 52-14 58-64 57l-31 19 4-25c-28-7-31-33-15-51Z" fill="${c}" ${stroke}/>${f}`;
    default:
      return `<circle cx="91" cy="66" r="48" fill="${c}" ${stroke}/>${f}<path d="m40 35-13-8m114 6 12-10" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`;
  }
}
function lines(text) {
  if (text.length <= 16) return [text];
  const words = text.split(" ");
  let best = 1;
  for (let i = 1; i < words.length; i++)
    if (
      Math.abs(
        words.slice(0, i).join(" ").length - words.slice(i).join(" ").length,
      ) <
      Math.abs(
        words.slice(0, best).join(" ").length -
          words.slice(best).join(" ").length,
      )
    )
      best = i;
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}
let count = 0;
for (const p of packs)
  for (const [i, label] of p.labels.entries()) {
    const id = `${p.id}-${i + 1}`;
    const caption = lines(label);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 172" role="img"><title>${esc(label)}</title><g transform="rotate(${((i % 3) - 1) * 5} 90 66)">${artwork(p.motif, p.color, i)}</g><g fill="#304b40" stroke="#fffdf7" stroke-width="6" paint-order="stroke" stroke-linejoin="round" font-family="Arial, sans-serif" font-size="15" font-weight="700" text-anchor="middle">${caption.map((l, j) => `<text x="90" y="${caption.length === 1 ? 145 : 138 + j * 18}">${esc(l)}</text>`).join("")}</g></svg>`;
    writeFileSync(new URL(`${id}.svg`, dir), svg);
    count++;
  }
console.log(`${count} original SVG stickers generated in public/stickers.`);
