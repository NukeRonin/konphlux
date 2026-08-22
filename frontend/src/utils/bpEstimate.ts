import { BPWall } from "@/src/api/client";

// Bazaar listing ids for the seeded building materials (see backend MATERIAL_LISTINGS).
export const MATERIAL_IDS = { paint: "m-paint", wood: "m-wood", floor: "m-floor" };

export const WALL_HEIGHT = 2.4; // metres
const PAINT_COVERAGE = 10; // m² per litre
const PAINT_COATS = 2;
const PAINT_CAN = 2.5; // litres per can
const BOARD_LEN = 2.4; // metres per timber board
const FLOOR_PER_BOX = 2; // m² per flooring box

export const M_TO_FT = 3.28084;
export const M2_TO_FT2 = 10.7639;

export type Estimate = {
  hasWalls: boolean;
  wallLen: number; // metres
  floorArea: number; // m² (rounded)
  paintArea: number;
  paintLitres: number;
  paintCans: number;
  woodLinear: number; // metres
  woodBoards: number;
  flooringM2: number;
  flooringBoxes: number;
};

export function computeEstimate(walls: BPWall[], scale: number): Estimate {
  let wallLen = 0;
  let minx = 1, miny = 1, maxx = 0, maxy = 0;
  let has = false;
  for (const w of walls) {
    wallLen += Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * scale;
    minx = Math.min(minx, w.x1, w.x2);
    miny = Math.min(miny, w.y1, w.y2);
    maxx = Math.max(maxx, w.x1, w.x2);
    maxy = Math.max(maxy, w.y1, w.y2);
    has = true;
  }
  const floorAreaRaw = has ? Math.max(0, (maxx - minx) * scale) * Math.max(0, (maxy - miny) * scale) : 0;
  const paintArea = wallLen * WALL_HEIGHT;
  const paintLitres = Math.ceil((paintArea * PAINT_COATS) / PAINT_COVERAGE);
  const paintCans = Math.ceil(paintLitres / PAINT_CAN) || 0;
  const woodLinear = Math.round(wallLen * 3);
  const woodBoards = Math.ceil(woodLinear / BOARD_LEN) || 0;
  const flooringM2 = Math.round(floorAreaRaw);
  const flooringBoxes = Math.ceil(flooringM2 / FLOOR_PER_BOX) || 0;
  return {
    hasWalls: has,
    wallLen: Math.round(wallLen),
    floorArea: flooringM2,
    paintArea: Math.round(paintArea),
    paintLitres, paintCans,
    woodLinear, woodBoards,
    flooringM2, flooringBoxes,
  };
}

export const fmtLen = (m: number) => `${m} m (${Math.round(m * M_TO_FT)} ft)`;
export const fmtArea = (m2: number) => `${m2} m² (${Math.round(m2 * M2_TO_FT2)} ft²)`;
