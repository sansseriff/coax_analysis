export type { Metal, Dielectric, Kelvin } from "./types";
export { COPPER, RRR_OPTIONS, type RRR } from "./copper";
export { SILVER, silverResistivityAt, RRR_AG_PLATED_DEFAULT } from "./silver";
export { SPC, SPC_PLATING_THICKNESS_M } from "./spc";
export { BRASS } from "./brass";
export { PFA } from "./pfa";
export { FEP_SOLID, makeFepFoam } from "./fep";

import { COPPER } from "./copper";
import { SPC } from "./spc";
import { BRASS } from "./brass";
import type { Metal } from "./types";

export const METALS: Record<string, Metal> = {
  spc:    SPC,
  copper: COPPER,
  brass:  BRASS,
};

export type MetalKey = keyof typeof METALS;
