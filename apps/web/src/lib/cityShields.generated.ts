import AbellaDeLaConcaShield from "catalunya-shields/assets/svg/abella-de-la-conca.svg";
import AgramuntShield from "catalunya-shields/assets/svg/agramunt.svg";
import AgullanaShield from "catalunya-shields/assets/svg/agullana.svg";
import BadalonaShield from "catalunya-shields/assets/svg/badalona.svg";
import BarcelonaShield from "catalunya-shields/assets/svg/barcelona.svg";
import CornellaDeLlobregatShield from "catalunya-shields/assets/svg/cornella-de-llobregat.svg";
import LhospitaletDeLlobregatShield from "catalunya-shields/assets/svg/lhospitalet-de-llobregat.svg";
import MataroShield from "catalunya-shields/assets/svg/mataro.svg";
import ReusShield from "catalunya-shields/assets/svg/reus.svg";
import SabadellShield from "catalunya-shields/assets/svg/sabadell.svg";
import SantCugatDelVallesShield from "catalunya-shields/assets/svg/sant-cugat-del-valles.svg";
import SantaColomaDeGramenetShield from "catalunya-shields/assets/svg/santa-coloma-de-gramenet.svg";
import TerrassaShield from "catalunya-shields/assets/svg/terrassa.svg";

type ShieldAsset = {
  src: string;
};

export const GENERATED_CITY_SHIELDS: Record<string, ShieldAsset> = {
  "abella-de-la-conca": AbellaDeLaConcaShield,
  "agramunt": AgramuntShield,
  "agullana": AgullanaShield,
  "badalona": BadalonaShield,
  "barcelona": BarcelonaShield,
  "cornella": CornellaDeLlobregatShield,
  "cornella-de-llobregat": CornellaDeLlobregatShield,
  "l-hospitalet-de-llobregat": LhospitaletDeLlobregatShield,
  "lhospitalet": LhospitaletDeLlobregatShield,
  "lhospitalet-de-llobregat": LhospitaletDeLlobregatShield,
  "mataro": MataroShield,
  "reus": ReusShield,
  "sabadell": SabadellShield,
  "sant-cugat-del-valles": SantCugatDelVallesShield,
  "santa-coloma": SantaColomaDeGramenetShield,
  "santa-coloma-de-gramenet": SantaColomaDeGramenetShield,
  "terrassa": TerrassaShield,
};

export const GENERATED_CITY_SHIELD_SLUGS = [
  "abella-de-la-conca",
  "agramunt",
  "agullana",
  "badalona",
  "barcelona",
  "cornella-de-llobregat",
  "lhospitalet",
  "mataro",
  "reus",
  "sabadell",
  "sant-cugat-del-valles",
  "santa-coloma-de-gramenet",
  "terrassa",
] as const;
