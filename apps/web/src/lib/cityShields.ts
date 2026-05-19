import BadalonaShield from "catalunya-shields/assets/svg/badalona.svg";
import BarcelonaShield from "catalunya-shields/assets/svg/barcelona.svg";
import CornellaDeLlobregatShield from "catalunya-shields/assets/svg/cornella-de-llobregat.svg";
import GironaShield from "catalunya-shields/assets/svg/girona.svg";
import LhospitaletDeLlobregatShield from "catalunya-shields/assets/svg/lhospitalet-de-llobregat.svg";
import LleidaShield from "catalunya-shields/assets/svg/lleida.svg";
import MataroShield from "catalunya-shields/assets/svg/mataro.svg";
import ReusShield from "catalunya-shields/assets/svg/reus.svg";
import SantaColomaDeGramenetShield from "catalunya-shields/assets/svg/santa-coloma-de-gramenet.svg";
import TarragonaShield from "catalunya-shields/assets/svg/tarragona.svg";
import TerrassaShield from "catalunya-shields/assets/svg/terrassa.svg";

type ShieldAsset = {
  src: string;
};

const CITY_SHIELDS: Record<string, ShieldAsset> = {
  badalona: BadalonaShield,
  barcelona: BarcelonaShield,
  "cornella-de-llobregat": CornellaDeLlobregatShield,
  girona: GironaShield,
  lhospitalet: LhospitaletDeLlobregatShield,
  "l-hospitalet-de-llobregat": LhospitaletDeLlobregatShield,
  "lhospitalet-de-llobregat": LhospitaletDeLlobregatShield,
  lleida: LleidaShield,
  mataro: MataroShield,
  reus: ReusShield,
  "santa-coloma-de-gramenet": SantaColomaDeGramenetShield,
  tarragona: TarragonaShield,
  terrassa: TerrassaShield,
};

export function normalizeCityShieldSlug(slug: string): string {
  return slug
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getCityShieldSrc(slug: string): string | null {
  return CITY_SHIELDS[normalizeCityShieldSlug(slug)]?.src ?? null;
}
