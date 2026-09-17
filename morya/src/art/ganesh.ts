// Ganesh ji, hand-authored as vector parts in artboard units (1000 × 1700).
// Order is back to front: later parts occlude the ink of earlier ones.
import { mapPath, mirror } from '../engine/geom';
import { P } from './palette';
import { circlePath, ink, petalPath, region, tube, type Part } from './parts';

export const HALO = { x: 500, y: 470, r: 250 };

// Trunk centreline: rises from between the eyes, curls toward the modak.
export const TRUNK = 'M 500 468 C 500 540 494 620 500 690 C 506 752 530 800 574 806 C 612 810 628 780 618 760 C 612 748 598 748 594 758';
export const TRUNK_W: [number, number] = [58, 18];
export const trunkProfile = (t: number) => (t < 0.28 ? 0.45 + 1.0 * Math.sin((t / 0.28) * Math.PI * 0.5) : 1.45 - (t - 0.28) * 0.62);

let cache: Part[] | null = null;

const same = (d: string) => d;
const sides = [['l', same], ['r', (d: string) => mirror(d)]] as const;

export function ganeshParts(): Part[] {
  if (cache) return cache;
  const parts: Part[] = [];
  const add = (p: Part) => parts.push(p);

  // Halo wash
  add(region('halo', circlePath(HALO.x, HALO.y, HALO.r), P.kesari, {
    w: 1.2, fillAlpha: 0.26, lineColor: P.inkSoft,
    shade: [{ x: 500, y: 470, r: 250, color: '#f8e1b0', alpha: 0.55 }],
  }));

  // Ears
  const ear = 'M 412 440 C 376 404 300 390 258 418 C 214 450 210 538 228 594 C 244 646 296 690 352 684 C 384 680 404 656 414 624 Z';
  const earFold = 'M 400 468 C 360 438 306 430 280 452 C 252 478 250 544 266 590 C 280 630 322 656 364 650';
  for (const [s, fx] of sides) {
    add(region(`ear-${s}`, fx(ear), P.skinEar, {
      w: 3,
      details: [[fx(earFold), 1.6]],
      shade: [
        { x: s === 'l' ? 310 : 690, y: 540, r: 110, color: P.rose, alpha: 0.6 },
        { x: s === 'l' ? 240 : 760, y: 600, r: 80, color: P.skinDeep, alpha: 0.3 },
        { x: s === 'l' ? 408 : 592, y: 540, r: 70, color: P.skinDeep, alpha: 0.4 },
      ],
    }));
  }

  // Upper arms: ankush on his right, lotus on his left
  for (const [s, fx] of sides) {
    add(tube(`arm-u-${s}`, fx('M 404 664 C 364 690 328 712 300 722'), 54, 44, P.skinLight, {
      shade: [{ x: s === 'l' ? 330 : 670, y: 700, r: 60, color: P.skinDeep, alpha: 0.2 }],
    }));
    add(region(`elbow-u-${s}`, fx(circlePath(300, 718, 22)), P.skinLight));
    add(tube(`fore-u-${s}`, fx('M 300 722 C 282 692 270 660 266 628'), 44, 34, P.skinLight));
    add(tube(`bangle-u-${s}`, fx('M 280 650 C 272 648 262 646 254 648'), 8, 8, P.ochre, { w: 1.4, capStart: true }));
  }
  add(ink('ankush', [['M 282 660 L 262 410', 5], ['M 263 424 C 240 418 232 394 246 380 C 258 369 276 377 273 392', 4], ['M 263 424 L 272 374', 3.4]], 4, P.inkSoft));
  add(ink('lotus-stem', [['M 718 660 C 726 620 734 580 738 536', 3.6]], 3, P.tealDeep));
  for (const [i, dir] of [-1.0, -0.5, 0, 0.5, 1.0].entries()) {
    add(region(`lotus-p${i}`, petalPath(738, 540, 26, 60 - Math.abs(dir) * 16, dir), P.rose, {
      w: 1.8, shade: [{ x: 738, y: 486, r: 50, color: P.sindoor, alpha: 0.4 }],
    }));
  }
  const fist = 'M 250 636 C 242 612 250 590 270 586 C 292 584 300 606 294 630 C 288 646 258 650 250 636 Z';
  const fingers = ['M 254 606 C 266 603 282 605 294 610', 'M 252 620 C 266 618 282 620 292 624'];
  for (const [s, fx] of sides) {
    add(region(`fist-${s}`, fx(fist), P.skinLight, { details: fingers.map((f) => [fx(f), 1.4] as [string, number]) }));
  }

  // Lotus seat, back row
  for (let i = 0; i < 9; i++) {
    const cx = 312 + i * 47;
    add(region(`seat-b${i}`, petalPath(cx, 1070, 56, 74, 0, (cx - 500) * 0.05), P.rose, {
      w: 2, shade: [{ x: cx, y: 1000, r: 44, color: P.sindoor, alpha: 0.35 }],
    }));
  }

  // Legs in padmasana, teal dhoti with pleats
  add(region('legs', 'M 360 908 C 326 926 296 966 294 1010 C 292 1042 324 1060 366 1058 C 420 1066 470 1068 500 1066 C 530 1068 580 1066 634 1058 C 676 1060 708 1042 706 1010 C 704 966 674 926 640 908 C 590 946 410 946 360 908 Z', P.teal, {
    w: 3,
    shade: [
      { x: 500, y: 1060, r: 170, color: P.tealDeep, alpha: 0.4 },
      { x: 360, y: 980, r: 70, color: '#8fc0b6', alpha: 0.35 },
      { x: 640, y: 980, r: 70, color: '#8fc0b6', alpha: 0.35 },
    ],
    details: [
      ['M 318 1024 C 380 1002 446 1004 520 1040', 1.6],
      ['M 682 1024 C 620 1002 554 1004 480 1040', 1.6],
      ['M 380 944 C 392 970 404 990 424 1004', 1.3],
      ['M 620 944 C 608 970 596 990 576 1004', 1.3],
      ['M 306 1036 C 360 1062 640 1062 694 1036', 1.3],
    ],
  }));
  const foot = 'M 530 1024 C 518 1012 526 992 548 990 C 578 986 606 982 626 984 C 632 978 642 978 645 985 C 651 983 657 987 655 994 C 661 995 663 1001 658 1006 C 662 1009 661 1015 655 1016 C 655 1022 649 1025 643 1022 C 616 1030 570 1032 530 1024 Z';
  const toes = ['M 628 986 C 632 992 634 1000 632 1010', 'M 546 994 C 540 1004 540 1014 548 1020'];
  add(region('foot-r', foot, P.skin, {
    details: toes.map((t) => [t, 1.1] as [string, number]),
    shade: [{ x: 640, y: 1002, r: 22, color: P.sindoor, alpha: 0.5 }, { x: 540, y: 1008, r: 18, color: P.sindoor, alpha: 0.45 }],
  }));
  add(region('foot-l', mapPath(foot, (x, y) => [1000 - x, y + 12]), P.skin, {
    details: toes.map((t) => [mapPath(t, (x, y) => [1000 - x, y + 12]), 1.1] as [string, number]),
    shade: [{ x: 360, y: 1014, r: 22, color: P.sindoor, alpha: 0.5 }, { x: 460, y: 1020, r: 18, color: P.sindoor, alpha: 0.45 }],
  }));

  // dhoti motifs and gold hem
  for (let i = 0; i < 16; i++) {
    const x = 330 + ((i * 97) % 340), y = 960 + ((i * 41) % 70);
    if (Math.abs(x - 500) < 40 && y < 990) continue;
    add(region(`buta${i}`, circlePath(x, y, 3.2), P.ivory, { w: 0.6, lineColor: P.tealDeep }));
  }
  add(tube('dhoti-hem', 'M 300 1030 C 360 1060 640 1060 700 1030', 10, 10, P.ochre, { w: 1.2, capStart: true, fillAlpha: 0.95 }));

  // Lotus seat, front row and plinth
  for (let i = 0; i < 8; i++) {
    const cx = 314 + i * 53;
    add(region(`seat-f${i}`, petalPath(cx, 1058, 62, 76, Math.PI, (cx - 500) * -0.06), P.rose, {
      w: 2.2, shade: [{ x: cx, y: 1124, r: 36, color: P.sindoor, alpha: 0.45 }],
    }));
  }
  add(region('plinth', 'M 312 1124 L 688 1124 C 702 1136 702 1158 688 1168 L 312 1168 C 298 1158 298 1136 312 1124 Z', P.indigo, {
    fillAlpha: 0.82, w: 2.6, details: [['M 306 1146 L 694 1146', 1.2]],
    shade: [{ x: 500, y: 1168, r: 220, color: P.indigoDeep, alpha: 0.3 }],
  }));

  // Mushak, his mouse, waiting by the seat with a modak
  add(tube('mushak-tail', 'M 766 1150 C 786 1140 792 1120 782 1104', 4, 1.5, P.earth, { w: 1.2 }));
  add(region('mushak', 'M 690 1164 C 680 1150 686 1128 708 1118 C 732 1108 760 1118 768 1140 C 772 1156 764 1166 746 1168 C 726 1170 704 1170 690 1164 Z', '#9c8a80', {
    w: 2, shade: [{ x: 744, y: 1156, r: 26, color: '#6f5e58', alpha: 0.4 }, { x: 714, y: 1128, r: 18, color: '#c9b8ac', alpha: 0.5 }],
  }));
  add(region('mushak-head', 'M 710 1124 C 696 1122 678 1132 668 1144 C 678 1150 696 1152 712 1146 Z', '#a6958a', { w: 1.8 }));
  add(region('mushak-ear', circlePath(704, 1122, 7), P.rose, { w: 1.2 }));
  add(region('mushak-eye', circlePath(688, 1136, 2), P.ink, { w: 0.4 }));
  add(region('mushak-modak', 'M 662 1166 C 658 1156 664 1146 670 1140 C 676 1146 682 1156 678 1166 Z', P.ivory, { w: 1.2 }));

  // Torso and belly
  add(region('torso', 'M 418 630 C 382 634 360 656 354 694 C 344 744 338 776 344 816 C 350 888 400 966 500 968 C 600 966 650 888 656 816 C 662 776 656 744 646 694 C 640 656 618 634 582 630 Z', P.skin, {
    w: 3,
    shade: [
      { x: 470, y: 830, r: 120, color: '#f3c496', alpha: 0.5 },
      { x: 620, y: 900, r: 120, color: P.skinDeep, alpha: 0.3 },
      { x: 372, y: 740, r: 60, color: P.skinDeep, alpha: 0.35 },
      { x: 628, y: 740, r: 60, color: P.skinDeep, alpha: 0.35 },
      { x: 500, y: 650, r: 70, color: P.skinDeep, alpha: 0.3 },
    ],
    details: [
      ['M 496 872 C 488 860 508 852 512 864 C 515 874 498 880 492 870', 1.5],
      ['M 376 776 C 414 742 460 736 486 738', 1.3],
    ],
  }));
  add(tube('belt', 'M 356 900 C 420 950 580 950 644 900', 18, 18, P.tealDeep, { w: 1.8, capStart: true, fillAlpha: 0.9 }));
  add(tube('thread', 'M 418 640 C 470 720 560 830 640 902', 7, 6, P.ivory, { w: 1.3, capStart: true }));

  // Front arms: abhaya mudra, and the bowl of modak
  add(tube('arm-l-l', 'M 388 690 C 372 740 352 790 344 832', 54, 46, P.skinLight, { shade: [{ x: 360, y: 790, r: 50, color: P.skinDeep, alpha: 0.2 }] }));
  add(region('elbow-l-l', circlePath(342, 836, 23), P.skinLight));
  add(tube('fore-l-l', 'M 342 840 C 336 812 332 786 330 762', 46, 36, P.skinLight));
  add(tube('bangle-l-l', 'M 312 776 C 322 779 338 779 348 776', 9, 9, P.ochre, { w: 1.4, capStart: true }));
  add(region('palm-l', 'M 312 770 C 302 744 300 712 306 690 C 310 680 320 682 321 692 L 322 676 C 324 664 336 664 336 676 L 337 670 C 339 658 351 659 351 671 L 351 680 C 354 670 365 672 364 684 C 362 712 360 744 350 770 C 340 780 322 780 312 770 Z', P.skin, {
    details: [['M 320 744 C 330 736 344 736 352 744', 1.2], ['M 322 692 L 324 712', 0.9], ['M 336 680 L 337 706', 0.9], ['M 351 684 L 350 708', 0.9]],
    shade: [{ x: 334, y: 730, r: 34, color: P.sindoor, alpha: 0.4 }],
  }));
  add(tube('arm-l-r', mirror('M 388 690 C 372 740 352 790 344 832'), 54, 46, P.skinLight, { shade: [{ x: 640, y: 790, r: 50, color: P.skinDeep, alpha: 0.2 }] }));
  add(region('elbow-l-r', circlePath(658, 836, 23), P.skinLight));
  add(tube('fore-l-r', 'M 660 842 C 648 856 628 864 604 866', 44, 34, P.skinLight));
  add(region('bowl', 'M 576 860 C 582 896 680 896 690 860 C 660 850 606 850 576 860 Z', P.ochre, {
    shade: [{ x: 668, y: 884, r: 46, color: P.goldDeep, alpha: 0.4 }],
    details: [['M 588 876 C 618 886 652 886 680 876', 1.2]],
  }));
  for (const [i, x] of [598, 632, 666].entries()) {
    add(region(`modak${i}`, `M ${x - 15} 860 C ${x - 17} 842 ${x - 7} 826 ${x} 816 C ${x + 7} 826 ${x + 17} 842 ${x + 15} 860 Z`, P.ivory, {
      w: 1.7,
      details: [[`M ${x} 820 C ${x - 4} 836 ${x - 6} 848 ${x - 7} 860`, 0.9], [`M ${x} 820 C ${x + 4} 836 ${x + 6} 848 ${x + 7} 860`, 0.9]],
      shade: [{ x: x + 9, y: 852, r: 16, color: P.kesari, alpha: 0.4 }],
    }));
  }

  // Head: broad forehead, full cheeks
  add(region('face', 'M 500 404 C 566 404 608 428 612 482 C 616 530 610 570 586 598 C 568 618 546 628 520 632 L 480 632 C 454 628 432 618 414 598 C 390 570 384 530 388 482 C 392 428 434 404 500 404 Z', P.skin, {
    w: 3,
    shade: [
      { x: 500, y: 490, r: 100, color: '#f4c79a', alpha: 0.45 },
      { x: 500, y: 430, r: 80, color: P.skinDeep, alpha: 0.28 },
      { x: 420, y: 570, r: 60, color: P.rose, alpha: 0.35 },
      { x: 580, y: 570, r: 60, color: P.rose, alpha: 0.35 },
    ],
    details: [['M 446 612 C 456 626 470 632 482 630', 1.4]],
  }));

  // Crown: lobed mukut
  add(region('crown', 'M 404 424 C 404 404 408 388 412 378 L 396 368 C 410 364 422 362 432 360 C 434 344 436 330 438 320 L 422 310 C 434 306 444 304 452 304 C 454 290 458 280 462 272 L 448 262 C 460 260 468 258 476 256 C 482 242 490 230 500 214 C 510 230 518 242 524 256 C 532 258 540 260 552 262 L 538 272 C 542 280 546 290 548 304 C 556 304 566 306 578 310 L 562 320 C 564 330 566 344 568 360 C 578 362 590 364 604 368 L 588 378 C 592 388 596 404 596 424 Z', P.ochre, {
    w: 2.8,
    shade: [
      { x: 540, y: 340, r: 100, color: P.goldDeep, alpha: 0.3 },
      { x: 470, y: 320, r: 60, color: '#f3dc9a', alpha: 0.5 },
    ],
    details: [
      ['M 432 360 C 470 350 530 350 568 360', 1.5],
      ['M 452 304 C 482 296 518 296 548 304', 1.5],
      ['M 476 256 C 490 252 510 252 524 256', 1.4],
    ],
  }));
  add(region('crown-tip', 'M 500 222 C 488 210 490 190 500 172 C 510 190 512 210 500 222 Z', P.ochre, { w: 2 }));
  add(region('crown-band', 'M 396 448 C 436 420 564 420 604 448 L 600 414 C 564 392 436 392 400 414 Z', P.sindoor, {
    fillAlpha: 0.9, w: 2.6, details: [['M 398 432 C 438 408 562 408 602 432', 1.1]],
  }));

  // Trunk
  add(tube('trunk', TRUNK, TRUNK_W[0], TRUNK_W[1], P.skin, {
    profile: trunkProfile,
    w: 2.8,
    shade: [
      { x: 492, y: 560, r: 50, color: '#f4c79a', alpha: 0.4 },
      { x: 540, y: 800, r: 56, color: P.skinDeep, alpha: 0.3 },
    ],
    details: [
      ['M 478 652 C 490 660 512 660 524 652', 1.2],
      ['M 478 676 C 490 684 512 684 524 676', 1.2],
      ['M 480 700 C 492 708 512 708 524 700', 1.1],
      ['M 486 724 C 498 732 516 731 528 724', 1],
      ['M 496 748 C 506 756 522 754 534 746', 0.9],
    ],
  }));

  // Tusks
  add(tube('tusk-r', 'M 462 600 C 452 626 440 646 420 656', 20, 4, P.ivory, { w: 2 }));
  add(tube('tusk-l', 'M 538 600 C 546 612 552 618 560 621', 19, 13, P.ivory, { w: 2 }));

  // Eyes: long lotus-petal eyes with a lifted outer line
  const eye = 'M 424 500 C 436 489 462 487 476 497 C 464 507 438 510 424 500 Z';
  const lid = 'M 414 497 C 430 481 462 478 480 492';
  const tail = 'M 424 500 C 416 498 410 494 404 488';
  const brow = 'M 412 470 C 432 458 466 456 484 466';
  for (const [s, fx] of sides) {
    add(region(`eye-${s}`, fx(eye), P.ivory, { w: 1.8, details: [[fx(lid), 3], [fx(tail), 1.6], [fx(brow), 1.8]] }));
    add(region(`pupil-${s}`, circlePath(s === 'l' ? 454 : 546, 496, 6.5), P.ink, { w: 0.8, fillAlpha: 0.95 }));
  }

  cache = parts;
  return parts;
}

/** Artboard regions that carry the emotional "eyes" beat of Rekha. */
export const EYES = [
  { x: 452, y: 496, r: 36 },
  { x: 548, y: 496, r: 36 },
];
