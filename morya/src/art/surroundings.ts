// The world around Ganesh ji, found only when the painting widens:
// border, niche, toran, jharokha window (behind); offerings and flora (in front).
import { mirror } from '../engine/geom';

import { P } from './palette';
import { circlePath, ink, petalPath, region, tube, type Part } from './parts';

/** Where the procedural fallback paints its diya. */
const DIYA = { x: 720, y: 1478 };

let backCache: Part[] | null = null;
let frontCache: Part[] | null = null;

export function backParts(): Part[] {
  if (backCache) return backCache;
  const out: Part[] = [];
  const add = (p: Part) => out.push(p);

  // Floor and wall
  add(region('floor', 'M 52 1176 L 948 1176 L 948 1648 L 52 1648 Z', P.kesari, {
    fillAlpha: 0.2, noOutline: true,
    shade: [
      { x: 500, y: 1240, r: 380, color: P.goldLight, alpha: 0.35 },
      { x: 500, y: 1640, r: 420, color: P.saffron, alpha: 0.18 },
    ],
  }));
  // dhurrie under the offerings
  add(region('rug', 'M 70 1296 L 930 1296 L 930 1640 L 70 1640 Z', P.rose, {
    w: 1.4, fillAlpha: 0.42,
    shade: [{ x: 500, y: 1470, r: 380, color: '#ecc5b4', alpha: 0.45 }],
  }));
  add(region('rug-border', 'M 70 1296 L 930 1296 L 930 1318 L 70 1318 Z', P.indigo, { w: 1, fillAlpha: 0.7 }));
  for (let i = 0; i < 43; i++) {
    const x = 80 + i * 20;
    add(region(`rug-dot${i}`, circlePath(x, 1307, 2.8), P.ivory, { w: 0.4 }));
  }
  add(ink('horizon', [['M 52 1176 L 948 1176', 1.6]], 1.6, P.inkSoft));

  // Cusped niche framing Ganesh ji
  const arch = 'M 150 1176 L 150 560 C 150 470 186 420 228 392 C 214 350 236 306 280 300 C 282 250 318 214 366 216 C 382 170 430 140 470 146 C 480 118 490 104 500 92 C 510 104 520 118 530 146 C 570 140 618 170 634 216 C 682 214 718 250 720 300 C 764 306 786 350 772 392 C 814 420 850 470 850 560 L 850 1176 Z';
  add(region('niche', arch, P.indigo, {
    w: 2.4, fillAlpha: 0.58,
    shade: [
      { x: 500, y: 560, r: 420, color: P.teal, alpha: 0.35 },
      { x: 500, y: 1100, r: 360, color: P.indigoDeep, alpha: 0.35 },
      { x: 500, y: 470, r: 300, color: '#7fa7a4', alpha: 0.25 },
    ],
    details: [[
      'M 172 1176 L 172 564 C 172 480 204 436 246 408 C 234 366 254 326 294 320 C 298 272 330 238 374 238 C 390 196 432 168 470 172 C 482 146 490 132 500 120 C 510 132 518 146 530 172 C 568 168 610 196 626 238 C 670 238 702 272 706 320 C 746 326 766 366 754 408 C 796 436 828 480 828 564 L 828 1176',
      1.2,
    ]],
  }));
  for (let i = 0; i < 26; i++) {
    const x = 196 + ((i * 131) % 610), y = 250 + ((i * 227) % 880);
    if (Math.hypot(x - 500, y - 470) < 290 || (x > 290 && x < 710 && y > 600) || (y < 420 && (x < 260 || x > 740))) continue;
    for (let k = 0; k < 4; k++) add(region(`nf${i}-${k}`, petalPath(x, y, 5, 9, (k * Math.PI) / 2), P.goldLight, { w: 0.5, lineColor: P.goldDeep }));
  }
  // pillars
  for (const [s, fx] of [['l', (d: string) => d], ['r', (d: string) => mirror(d)]] as const) {
    add(region(`pillar-${s}`, fx('M 118 1176 L 118 620 C 118 604 126 596 138 596 L 162 596 C 174 596 182 604 182 620 L 182 1176 Z'), P.ivory, {
      w: 2, fillAlpha: 0.9,
      shade: [{ x: s === 'l' ? 170 : 830, y: 900, r: 120, color: P.paperDeep, alpha: 0.7 }],
      details: [
        [fx('M 118 660 L 182 660'), 1.2], [fx('M 118 1120 L 182 1120'), 1.2],
        [fx('M 150 680 L 150 1100'), 1],
      ],
    }));
    add(region(`pillar-band-${s}`, fx('M 118 640 L 182 640 L 182 668 L 118 668 Z'), P.sindoor, { w: 1.2, fillAlpha: 0.75 }));
    add(region(`pillar-base-${s}`, fx('M 108 1150 L 192 1150 L 196 1176 L 104 1176 Z'), P.ochre, { w: 1.4, fillAlpha: 0.9 }));
    for (let k = 0; k < 6; k++) add(region(`pillar-lotus-${s}${k}`, fx(petalPath(130 + k * 8, 1150, 10, 18, 0)), P.rose, { w: 0.8 }));
    add(region(`capital-${s}`, fx('M 104 600 C 110 580 190 580 196 600 C 190 612 110 612 104 600 Z'), P.ochre, { w: 1.6, fillAlpha: 0.9 }));
  }

  // Jharokha window, upper left
  add(region('jharokha', 'M 96 428 L 96 330 C 96 290 120 262 150 250 C 180 262 204 290 204 330 L 204 428 Z', P.teal, {
    w: 2.4, fillAlpha: 0.55,
    shade: [{ x: 150, y: 330, r: 70, color: P.goldLight, alpha: 0.35 }],
    details: [
      ['M 110 428 L 110 334 C 110 302 128 280 150 268 C 172 280 190 302 190 334 L 190 428', 1.2],
      ['M 150 270 L 150 428', 1], ['M 110 350 L 190 350', 1], ['M 110 390 L 190 390', 1],
      ['M 116 318 C 140 340 160 340 184 318', 0.9], ['M 112 410 C 130 396 170 396 188 410', 0.9],
    ],
  }));
  add(region('jharokha-sill', 'M 84 428 L 216 428 L 208 446 L 92 446 Z', P.ochre, { w: 1.8 }));
  add(region('jharokha-cap', 'M 132 252 C 136 236 146 228 150 220 C 154 228 164 236 168 252 Z', P.ochre, { w: 1.6 }));

  // Toran: marigold swags with mango leaves
  const swags = 5;
  for (let i = 0; i < swags; i++) {
    const x0 = 60 + (i * 880) / swags;
    const x1 = 60 + ((i + 1) * 880) / swags;
    const n = 12;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = x0 + (x1 - x0) * t;
      const y = 72 + Math.sin(t * Math.PI) * 42;
      add(region(`mg${i}-${k}`, circlePath(x, y, 8.5), k % 2 ? P.saffron : P.kesari, {
        w: 1, lineColor: P.inkSoft, shade: [{ x: x - 2, y: y - 2, r: 7, color: '#f7c77a', alpha: 0.5 }],
      }));
    }
    const lx = (x0 + x1) / 2;
    add(region(`leaf${i}`, petalPath(lx, 118, 16, 40, Math.PI), P.leaf, { w: 1.2, details: [[`M ${lx} 120 L ${lx} 154`, 0.8]] }));
  }

  // Border: ink rules either side of a sindoor band
  for (const [i, d] of ['M 20 20 L 980 20 L 980 44 L 20 44 Z', 'M 20 1656 L 980 1656 L 980 1680 L 20 1680 Z', 'M 20 44 L 44 44 L 44 1656 L 20 1656 Z', 'M 956 44 L 980 44 L 980 1656 L 956 1656 Z'].entries()) {
    add(region(`border-band${i}`, d, P.sindoor, { fillAlpha: 0.85, noOutline: true }));
  }
  add(ink('border-rules', [
    ['M 20 20 L 980 20 L 980 1680 L 20 1680 Z', 2.2],
    ['M 44 44 L 956 44 L 956 1656 L 44 1656 Z', 1.6],
    ['M 52 52 L 948 52 L 948 1648 L 52 1648 Z', 1],
  ]));
  for (let i = 0; i < 40; i++) {
    const x = 32 + i * 24;
    add(region(`bd-t${i}`, circlePath(x, 32, 2.6), P.goldLight, { w: 0.6, lineColor: P.goldDeep }));
    add(region(`bd-b${i}`, circlePath(x, 1668, 2.6), P.goldLight, { w: 0.6, lineColor: P.goldDeep }));
  }
  for (let i = 0; i < 69; i++) {
    const y = 32 + i * 24;
    add(region(`bd-l${i}`, circlePath(32, y, 2.6), P.goldLight, { w: 0.6, lineColor: P.goldDeep }));
    add(region(`bd-r${i}`, circlePath(968, y, 2.6), P.goldLight, { w: 0.6, lineColor: P.goldDeep }));
  }

  backCache = out;
  return out;
}

export function frontParts(): Part[] {
  if (frontCache) return frontCache;
  const out: Part[] = [];
  const add = (p: Part) => out.push(p);

  // Scattered marigold petals
  const petals: [number, number, number][] = [[470, 1640, 0.4], [512, 1622, 1.8], [360, 1640, 2.6], [680, 1612, 0.9], [812, 1628, 2.2], [440, 1596, 3.4]];
  for (const [i, [x, y, a]] of petals.entries()) {
    add(region(`petal${i}`, petalPath(x, y, 10, 16, a), i % 2 ? P.saffron : P.rose, { w: 1 }));
  }

  // Incense stick in a small holder
  add(ink('incense', [['M 842 1318 L 812 1420', 2.4]], 2.4, P.earth));
  add(region('incense-holder', 'M 796 1420 C 800 1408 824 1408 828 1420 C 824 1430 800 1430 796 1420 Z', P.ochre, { w: 1.4 }));
  add(region('incense-tip', circlePath(842, 1318, 3), P.sindoor, { w: 0.6 }));

  // Diya (flame is drawn live)
  const { x: dx, y: dy } = DIYA;
  add(region('diya', `M ${dx - 50} ${dy} C ${dx - 44} ${dy + 34} ${dx + 36} ${dy + 36} ${dx + 48} ${dy} C ${dx + 56} ${dy - 6} ${dx + 58} ${dy - 20} ${dx + 50} ${dy - 22} C ${dx + 30} ${dy - 12} ${dx - 30} ${dy - 12} ${dx - 50} ${dy} Z`, P.skinDeep, {
    w: 2.2,
    shade: [
      { x: dx - 20, y: dy + 6, r: 34, color: P.saffron, alpha: 0.5 },
      { x: dx + 30, y: dy + 20, r: 30, color: P.earth, alpha: 0.4 },
    ],
    details: [[`M ${dx - 46} ${dy + 4} C ${dx - 20} ${dy + 14} ${dx + 20} ${dy + 14} ${dx + 46} ${dy + 4}`, 1.2]],
  }));
  add(region('diya-oil', `M ${dx - 42} ${dy - 2} C ${dx - 20} ${dy - 12} ${dx + 24} ${dy - 12} ${dx + 44} ${dy - 4} C ${dx + 20} ${dy + 4} ${dx - 20} ${dy + 6} ${dx - 42} ${dy - 2} Z`, P.ochre, { w: 1, fillAlpha: 0.9 }));
  add(ink('wick', [[`M ${dx + 30} ${dy - 8} C ${dx + 38} ${dy - 14} ${dx + 42} ${dy - 20} ${dx + 44} ${dy - 26}`, 3]], 3, P.ink));
  add(region('diya-stand', `M ${dx - 26} ${dy + 26} L ${dx + 24} ${dy + 26} L ${dx + 34} ${dy + 42} L ${dx - 36} ${dy + 42} Z`, P.gold, { w: 1.6 }));

  // Plate of modak
  add(region('plate', 'M 520 1604 C 530 1628 646 1628 656 1604 C 646 1590 530 1590 520 1604 Z', P.ochre, {
    w: 2, shade: [{ x: 620, y: 1612, r: 40, color: P.goldDeep, alpha: 0.4 }, { x: 550, y: 1600, r: 30, color: P.goldLight, alpha: 0.5 }],
  }));
  const modaks: [number, number][] = [[556, 1604], [588, 1606], [620, 1604], [572, 1580], [604, 1580], [588, 1556]];
  for (const [i, [x, y]] of modaks.entries()) {
    add(region(`modak${i}`, `M ${x - 15} ${y} C ${x - 17} ${y - 16} ${x - 7} ${y - 30} ${x} ${y - 40} C ${x + 7} ${y - 30} ${x + 17} ${y - 16} ${x + 15} ${y} C ${x + 6} ${y + 4} ${x - 6} ${y + 4} ${x - 15} ${y} Z`, P.ivory, {
      w: 1.5,
      details: [[`M ${x} ${y - 36} C ${x - 4} ${y - 22} ${x - 6} ${y - 10} ${x - 7} ${y}`, 0.8], [`M ${x} ${y - 36} C ${x + 4} ${y - 22} ${x + 6} ${y - 10} ${x + 7} ${y}`, 0.8]],
      shade: [{ x: x + 8, y: y - 8, r: 14, color: P.kesari, alpha: 0.35 }],
    }));
  }

  // Lotus with pads, lower right
  add(region('pad1', 'M 800 1640 C 780 1600 820 1560 880 1566 C 940 1572 960 1616 944 1640 C 900 1656 840 1656 800 1640 Z', P.leaf, {
    w: 2, shade: [{ x: 880, y: 1620, r: 60, color: P.tealDeep, alpha: 0.35 }],
    details: [['M 872 1600 L 830 1636', 1], ['M 872 1600 L 900 1644', 1], ['M 872 1600 L 936 1616', 1]],
  }));
  for (const [i, dir] of [-1.25, -0.7, 0.7, 1.25].entries()) {
    add(region(`lotus-b${i}`, petalPath(884, 1566, 34, 64, dir), P.rose, { w: 1.8, shade: [{ x: 884, y: 1520, r: 50, color: P.roseDeep, alpha: 0.35 }] }));
  }
  for (const [i, dir] of [-0.38, 0.38, 0].entries()) {
    add(region(`lotus-f${i}`, petalPath(884, 1570, 36, i === 2 ? 84 : 74, dir), P.rose, {
      w: 1.8, shade: [{ x: 884, y: 1500, r: 40, color: P.sindoor, alpha: 0.4 }, { x: 884, y: 1560, r: 30, color: P.ivory, alpha: 0.4 }],
    }));
  }

  frontCache = out;
  return out;
}

let womanCache: Part[] | null = null;

/** Placeholder figure of Aashna, kneeling, offering flowers toward him. Replaced by supplied art when present. */
export function womanParts(): Part[] {
  if (womanCache) return womanCache;
  const out: Part[] = [];
  const add = (p: Part) => out.push(p);

  // soles of her feet, tucked beneath her, with alta
  add(region('sole', 'M 92 1612 C 76 1604 74 1584 90 1578 C 106 1574 124 1584 126 1602 C 124 1614 104 1618 92 1612 Z', P.skin, {
    w: 1.6, shade: [{ x: 90, y: 1600, r: 16, color: P.sindoor, alpha: 0.55 }],
  }));

  // lehenga folded beneath her, long and low
  add(region('skirt', 'M 96 1612 C 92 1574 110 1534 148 1512 C 188 1490 240 1480 290 1484 C 346 1492 396 1528 422 1568 C 436 1592 430 1614 406 1622 C 300 1634 176 1632 112 1624 C 102 1622 96 1618 96 1612 Z', P.sindoor, {
    w: 2.4,
    shade: [
      { x: 250, y: 1500, r: 90, color: P.vermilion, alpha: 0.5 },
      { x: 380, y: 1590, r: 70, color: '#9a3322', alpha: 0.4 },
      { x: 140, y: 1590, r: 60, color: '#9a3322', alpha: 0.3 },
    ],
    details: [
      ['M 200 1496 C 214 1530 222 1574 224 1626', 1.1],
      ['M 290 1486 C 310 1520 324 1564 330 1628', 1.1],
      ['M 152 1514 C 150 1550 154 1586 162 1626', 1],
      ['M 356 1510 C 378 1536 392 1572 398 1620', 1],
    ],
  }));
  add(tube('hem', 'M 104 1614 C 200 1626 320 1628 418 1610', 11, 11, P.ochre, { w: 1.1, capStart: true }));
  for (let i = 0; i < 18; i++) {
    const x = 140 + ((i * 53) % 260), y = 1524 + ((i * 37) % 84);
    add(region(`buti${i}`, circlePath(x, y, 2.4), P.goldLight, { w: 0.5, lineColor: P.goldDeep }));
  }

  // back and blouse
  add(region('back', 'M 188 1474 C 176 1420 172 1362 186 1322 C 198 1294 226 1284 254 1284 C 282 1284 306 1296 318 1318 C 332 1350 322 1404 302 1470 C 262 1482 218 1482 188 1474 Z', P.roseDeep, {
    w: 2.2,
    shade: [
      { x: 290, y: 1360, r: 60, color: '#8e4a50', alpha: 0.35 },
      { x: 210, y: 1340, r: 50, color: P.rose, alpha: 0.45 },
    ],
  }));
  add(ink('dori', [['M 218 1356 C 240 1362 270 1362 296 1354', 1], ['M 258 1360 C 256 1376 252 1392 250 1404', 0.9]], 1, P.goldDeep));
  add(region('tassel', 'M 246 1404 C 244 1414 256 1414 254 1404 Z', P.gold, { w: 0.6 }));

  // dupatta: a saffron veil from shoulder to ground
  add(region('dupatta', 'M 306 1300 C 288 1344 246 1402 204 1446 C 166 1486 128 1548 110 1606 C 130 1612 152 1610 170 1604 C 184 1546 218 1486 254 1446 C 292 1404 316 1352 322 1318 Z', P.kesari, {
    w: 1.6, fillAlpha: 0.72, seeThrough: true,
    shade: [{ x: 180, y: 1520, r: 60, color: P.saffron, alpha: 0.5 }],
  }));
  add(tube('dupatta-edge', 'M 306 1300 C 288 1344 246 1402 204 1446 C 166 1486 128 1548 110 1606', 7, 7, P.gold, { w: 0.9, capStart: true }));

  // far hand, beneath the thali
  add(region('hand-far', 'M 436 1344 C 446 1336 462 1338 464 1346 C 460 1356 446 1358 436 1352 Z', P.skin, { w: 1.4 }));

  // neck, head turned up toward him
  add(region('neck', 'M 240 1290 C 240 1266 248 1254 260 1252 C 272 1254 278 1266 276 1290 Z', P.skin, { w: 1.6, shade: [{ x: 250, y: 1280, r: 16, color: P.skinDeep, alpha: 0.35 }] }));
  add(region('head', 'M 224 1222 C 216 1182 238 1154 268 1154 C 300 1156 316 1184 312 1216 C 308 1246 290 1264 264 1264 C 240 1264 228 1248 224 1222 Z', P.skin, {
    w: 1.8, shade: [{ x: 306, y: 1222, r: 22, color: P.rose, alpha: 0.5 }],
    details: [['M 312 1208 C 318 1212 318 1220 312 1224', 1.2]],
  }));

  // long black hair
  add(region('hair', 'M 220 1226 C 210 1180 232 1146 268 1146 C 294 1148 310 1162 316 1182 C 298 1180 284 1192 282 1212 C 280 1234 288 1252 282 1268 C 276 1292 268 1322 262 1362 C 256 1412 250 1452 238 1492 C 228 1514 206 1516 196 1500 C 202 1452 202 1402 206 1352 C 210 1302 222 1264 220 1226 Z', P.hair, {
    w: 1.8, fillAlpha: 0.96, lineColor: P.ink,
    shade: [{ x: 262, y: 1184, r: 30, color: P.indigo, alpha: 0.4 }, { x: 236, y: 1400, r: 30, color: P.indigo, alpha: 0.25 }],
    details: [['M 244 1170 C 236 1240 236 1330 222 1470', 1.1], ['M 262 1176 C 258 1250 254 1350 240 1476', 1.1], ['M 230 1300 C 226 1360 222 1420 214 1480', 0.9]],
  }));
  add(ink('hair-sheen', [['M 250 1160 C 244 1200 244 1250 246 1290', 2.2], ['M 240 1330 C 236 1380 232 1420 226 1460', 1.6]], 2, '#6d6068'));
  add(ink('lashes', [['M 312 1196 C 318 1192 322 1192 326 1194', 1.2]], 1.2, P.ink));
  add(region('ear', 'M 286 1222 C 294 1220 298 1232 294 1244 C 290 1250 284 1248 284 1240 Z', P.skin, { w: 1.1 }));
  add(region('jhumka', 'M 288 1250 C 280 1258 280 1270 290 1274 C 300 1270 300 1258 292 1250 Z', P.gold, { w: 0.9, shade: [{ x: 288, y: 1260, r: 8, color: P.goldLight, alpha: 0.6 }] }));
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    add(region(`gajra${i}`, circlePath(226 + t * 50, 1226 + Math.sin(t * Math.PI) * 16 + t * 8, 4), P.ivory, { w: 0.7 }));
  }

  // thali of marigolds
  add(region('thali', 'M 380 1336 C 386 1350 470 1352 478 1336 C 470 1322 388 1322 380 1336 Z', P.gold, {
    w: 1.6, shade: [{ x: 456, y: 1342, r: 26, color: P.goldDeep, alpha: 0.4 }, { x: 400, y: 1332, r: 20, color: P.goldLight, alpha: 0.6 }],
  }));
  const blooms: [number, number, string, number][] = [[404, 1322, P.saffron, 9], [424, 1316, P.kesari, 10], [446, 1322, P.saffron, 9], [414, 1302, P.kesari, 8], [436, 1302, P.rose, 8], [458, 1330, P.rose, 6]];
  for (const [i, [x, y, c, r]] of blooms.entries()) {
    add(region(`genda${i}`, circlePath(x, y, r), c, { w: 0.9, shade: [{ x: x - 3, y: y - 3, r: r * 0.8, color: '#f8d596', alpha: 0.55 }] }));
  }

  // near arm, reaching forward with the offering
  add(tube('upper-arm', 'M 306 1308 C 318 1334 330 1358 342 1380', 30, 24, P.skin, { shade: [{ x: 330, y: 1360, r: 26, color: P.skinDeep, alpha: 0.3 }] }));
  add(region('elbow', circlePath(342, 1378, 12), P.skin, { w: 1.6 }));
  add(tube('forearm', 'M 342 1380 C 360 1374 380 1362 398 1350', 23, 17, P.skin, {}));
  add(tube('sleeve', 'M 304 1300 C 312 1316 318 1328 324 1340', 34, 30, P.roseDeep, { w: 1.8 }));
  add(tube('bangles', 'M 382 1344 C 384 1352 388 1360 392 1366', 13, 13, P.sindoor, { w: 1, capStart: true, details: [['M 386 1342 C 388 1350 392 1358 396 1364', 1.4]], lineColor: P.goldDeep }));
  add(region('hand', 'M 396 1340 C 404 1332 420 1334 424 1342 C 422 1352 408 1360 398 1356 C 392 1352 392 1346 396 1340 Z', P.skin, { w: 1.4, shade: [{ x: 410, y: 1346, r: 10, color: P.sindoor, alpha: 0.35 }] }));

  womanCache = out;
  return out;
}
