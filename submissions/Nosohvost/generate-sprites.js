// Original vector characters, sharing the first prototype's ink and 120px grid.
// Run only when intentionally regenerating the new sprites.
const fs = require('node:fs');
const path = require('node:path');
const boots = '<path d="M35 98v15H20v-9l8-6M78 98v15h18v-9l-9-6" fill="#4e3c67"/>';
const eyes = (y=52) => `<ellipse cx="66" cy="${y}" rx="7" ry="9" fill="#fff"/><ellipse cx="85" cy="${y}" rx="7" ry="9" fill="#fff"/><path d="M69 ${y}v3m19-3v3" stroke-width="5"/><path d="M71 ${y+19}q8 6 14-1" fill="none" stroke-width="3"/>`;
const head = (color, extra='') => `<rect x="33" y="26" width="62" height="57" rx="18" fill="${color}"/>${eyes(48)}${extra}`;
const coat = (color) => boots + `<path d="M30 56l-15 27 14 7 8-16-9 26h66L84 73l14 13 10-12-18-21Z" fill="${color}"/>`;
const art = {
feature: boots + '<path d="m59 9 13 24 29-3-10 28 18 22-30 5-15 25-15-25-30-5 18-22-8-28 29 3Z" fill="#69d9b1"/><path d="m52 23 8 17-18 6" stroke="#b5ffe3" fill="none"/>' + eyes(52),
oculus: boots + '<path d="M26 46q-5 51 28 57h28q25-22 10-56Z" fill="#bba9ed"/><rect x="17" y="24" width="88" height="43" rx="16" fill="#ebe7f3"/><rect x="27" y="32" width="68" height="25" rx="10" fill="#251f48"/><path d="m37 44 8-5 8 5m15 0 8-5 8 5" fill="none" stroke="#7fe5ff"/><path d="M43 81q17 14 32 0" fill="none"/>',
compsoc: coat('#805cce') + head('#dfb18f','<path d="M30 40v-8q8-26 51-15l17 21-26-11-10 13Z" fill="#49345b"/>') + '<path d="m32 65-9 22m66-22 10 20"/><rect x="27" y="76" width="67" height="25" rx="3" fill="#26384e"/><path d="m45 85-6 5 6 5m29-10 6 5-6 5" fill="none" stroke="#71e8b2"/>',
marshall: coat('#7d91b6') + head('#dcb28e','<path d="M32 35q1-27 47-24l18 20-27-8-9 12Z" fill="#716274"/>') + '<path d="m43 63 13 19 13-18M57 80v18" fill="none" stroke="#eee7d7"/><path d="m18 64-6-30 22-5 8 29Z" fill="#b8c4dc"/>',
wace: coat('#627c71') + head('#d19b7d','<path d="M33 40q-3-33 38-30l27 19-31-4-8 14Z" fill="#372d47"/>') + '<circle cx="50" cy="50" r="16" fill="none" stroke="#eddb99"/><path d="m39 63-13 21" stroke="#eddb99" stroke-width="8"/><path d="m37 82 15-8 17 10 17-13" stroke="#b8e7bc" fill="none"/>',
brevan: coat('#50687d') + head('#d8ad90','<path d="m30 32 10-17 16 3 9-10 24 8 10 19-30-8Z" fill="#9e7656"/>') + '<path d="M17 66v-9m-7 9h15M30 88h64v12H30Z" stroke="#c6e4ee" fill="none"/><path d="m15 74 5 9 7-19" stroke="#79c8ee" fill="none"/>',
howard: coat('#9a694d') + head('#edc39a','<path d="M31 35q0-25 28-25t37 25l-24-8-12 10Z" fill="#4b3d40"/>') + '<path d="M31 57q16 38 61 10L81 85 53 90 33 72Z" fill="#72503e"/><path d="M90 90 106 22M101 23l12-5 2 12-13 4" fill="#e9cf83"/>',
bloomberg: boots + '<rect x="20" y="20" width="81" height="76" rx="9" fill="#353350"/><rect x="28" y="29" width="65" height="48" rx="3" fill="#0c2433"/><path d="m35 64 12-12 10 8 15-20 13 6" fill="none" stroke="#ff9e45"/><path d="M29 86h6m7 0h6m7 0h6m7 0h6m7 0h10" stroke="#f49b55" stroke-width="3"/><path d="M11 45 3 65m98-21 14 20"/>' + eyes(44),
netcraft: boots + '<path d="m58 10 44 17-7 50-37 30-36-30-7-50Z" fill="#5a9fbe"/><path d="m58 22 31 12-6 34-25 22-24-22-6-34Z" fill="#9bdbe1"/><path d="M20 34h73M28 73h58M48 21q-18 40 0 69m22-69q18 40 0 69" stroke="#3e819d" stroke-width="2" fill="none"/>' + eyes(48),
incident: boots + '<rect x="28" y="44" width="65" height="58" rx="12" fill="#c66d64"/><path d="M38 43V28a23 23 0 0 1 46 0v15Z" fill="#ff615e"/><path d="M47 23q6-9 14-9" fill="none" stroke="#ffc8a5"/><path d="M18 14 10 7m90 11 9-7M57 4V1" stroke="#ffce66"/><rect x="21" y="42" width="79" height="10" rx="5" fill="#eacba1"/>' + eyes(68),
io: boots + '<path d="M20 35q35-28 76 0v60q-38 18-76-1Z" fill="#7c88c4"/><ellipse cx="58" cy="33" rx="38" ry="13" fill="#c1d4f3"/><path d="M28 86q25 13 60 0" fill="none" stroke="#c1d4f3"/><path d="M7 60h13m77 0h14m-5-6 7 6-7 7" fill="none" stroke="#77e2e0"/>' + eyes(59),
pointer: boots + '<path d="M25 12 99 66 67 74l-16 31-16-9 15-29-30-2Z" fill="#f5eee1"/><path d="M31 24 79 59" fill="none" stroke="#c2b9d0"/>' + eyes(52),
stack: boots + '<path d="M20 79h80v23H20Zm4-27h72v23H24Zm6-27h60v23H30Z" fill="#9f8bd1"/><path d="M29 87h9m-5-27h9m-3-27h9" stroke="#d8c9f4"/><path d="M91 91h3m-6-28h3m-9-29h3" stroke="#77dfcc"/>' + eyes(61),
semicolon: boots + '<path d="M82 80q8 29-27 35l-9-12q20-2 15-17" fill="#c4a1e6"/><ellipse cx="63" cy="70" rx="27" ry="21" fill="#b88de3"/><circle cx="64" cy="25" r="19" fill="#dcc0f7"/><circle cx="70" cy="21" r="6" fill="#fff"/><circle cx="72" cy="21" r="2" fill="#1b1430"/><path d="M49 65v3m24-3v3M56 78q8 5 14-1" fill="none"/>',
demo: boots + '<path d="M23 40h74v56H23Z" fill="#efe4cb"/><path d="M17 27h86v15H17Z" fill="#62aaca"/><path d="M33 84h31m-31-8h20" stroke="#69a8ba" stroke-width="3"/><path d="M16 57 5 77m94-20 17 17M60 95v12" fill="none"/>' + eyes(57),
prize: boots + '<path d="M35 27H13v17q0 25 31 24m41-41h22v17q0 25-31 24" fill="#f4b541"/><path d="M31 17h58v30q0 29-24 35v14h21v12H34V96h21V82Q31 76 31 47Z" fill="#ffd76b"/><path d="M40 26v20" stroke="#fff3b4"/>' + eyes(48),
wifi: boots + '<path d="M27 71h67v30H27Z" fill="#7ed6d0"/><path d="M36 73V53m47 20V53M39 90h2m9 0h2" stroke="#347b91"/><path d="M15 29q45-36 90 0M28 43q32-25 64 0M42 57q18-14 36 0" stroke="#87eff0" stroke-width="8" fill="none"/><circle cx="61" cy="68" r="6" fill="#b9fff0"/>',
'null pointer': boots + '<path d="M25 12 99 66 67 74l-16 31-16-9 15-29-30-2Z" fill="#d993dc"/><path d="m24 42 30 7-11 12 33 9-10 21" fill="none" stroke="#fff1ff"/><path d="m64 44 11 12m0-12L64 56m19-3 11 12m0-12L83 65" stroke="#522859"/>',
};
art['marshall wace'] = coat('#526785') + head('#dfb28c','<path d="M24 26 37 10l22 11L80 7l20 21Z" fill="#e6bf66"/>') + '<path d="m19 74 7-33 22 7-6 33Z" fill="#d4deea"/><circle cx="91" cy="85" r="18" fill="#a1cfb6"/><path d="m81 86 8-9 13 6" fill="none"/>';
art['brevan howard'] = coat('#6b8173') + head('#e6ba8d','<path d="m24 30 9-21 25 6L79 5l19 23Z" fill="#f1ca72"/>') + '<path d="M15 100V32m-9 0h19M89 99l17-72m-5 0 13-6 4 14-14 5" fill="#f5d187"/><path d="M34 88h53" stroke="#e9cf86" stroke-width="8"/>';
art['capital one'] = boots + '<path d="M21 88q36-50 79-63l10 13Q57 60 40 102Z" fill="#ef5b68"/><path d="M29 17h61v80H29Z" fill="#6278b9"/><path d="m41 25 18-12h11v70H53V38H41Z" fill="#d8e5f4"/>' + eyes(51);
art['incident io'] = boots + '<path d="M17 39 58 16l45 23v46l-45 24-41-24Z" fill="#b77b8e"/><path d="M35 39V26a24 24 0 0 1 48 0v13Z" fill="#ff716e"/><path d="M31 39h58" stroke="#f6d5a2" stroke-width="8"/><path d="M25 83h22m-7-6 8 6-8 7m28-7h22" stroke="#8befe2" fill="none"/>' + eyes(58);
for (const [key, body] of Object.entries(art)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g stroke="#1b1430" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>\n`;
  fs.writeFileSync(path.join(__dirname, 'public', 'sprites', key.replace(/ /g,'-')+'.svg'), svg);
}
console.log(`Created ${Object.keys(art).length} SVG characters.`);
