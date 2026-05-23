import AbellaDeLaConcaShield from "catalunya-shields/assets/svg/abella-de-la-conca.svg";
import AgramuntShield from "catalunya-shields/assets/svg/agramunt.svg";
import AgullanaShield from "catalunya-shields/assets/svg/agullana.svg";
import AiguafredaShield from "catalunya-shields/assets/svg/aiguafreda.svg";
import AiguavivaShield from "catalunya-shields/assets/svg/aiguaviva.svg";
import AitonaShield from "catalunya-shields/assets/svg/aitona.svg";
import AlbanyaShield from "catalunya-shields/assets/svg/albanya.svg";
import AlbatarrecShield from "catalunya-shields/assets/svg/albatarrec.svg";
import AlbesaShield from "catalunya-shields/assets/svg/albesa.svg";
import AlbinyanaShield from "catalunya-shields/assets/svg/albinyana.svg";
import AlbonsShield from "catalunya-shields/assets/svg/albons.svg";
import AlcanarShield from "catalunya-shields/assets/svg/alcanar.svg";
import AlcanoShield from "catalunya-shields/assets/svg/alcano.svg";
import AlcarrasShield from "catalunya-shields/assets/svg/alcarras.svg";
import AlcoletgeShield from "catalunya-shields/assets/svg/alcoletge.svg";
import AlcoverShield from "catalunya-shields/assets/svg/alcover.svg";
import AldoverShield from "catalunya-shields/assets/svg/aldover.svg";
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

export type GeneratedCityShield = {
  name: string;
  slug: string;
  province: string | null;
  aliases: string[];
};

export const GENERATED_CITY_SHIELDS: Record<string, ShieldAsset> = {
  "abella-de-la-conca": AbellaDeLaConcaShield,
  "agramunt": AgramuntShield,
  "agullana": AgullanaShield,
  "aiguafreda": AiguafredaShield,
  "aiguaviva": AiguavivaShield,
  "aitona": AitonaShield,
  "albanya": AlbanyaShield,
  "albatarrec": AlbatarrecShield,
  "albesa": AlbesaShield,
  "albinyana": AlbinyanaShield,
  "albons": AlbonsShield,
  "alcanar": AlcanarShield,
  "alcano": AlcanoShield,
  "alcarras": AlcarrasShield,
  "alcoletge": AlcoletgeShield,
  "alcover": AlcoverShield,
  "aldover": AldoverShield,
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
  "aiguafreda",
  "aiguaviva",
  "aitona",
  "albanya",
  "albatarrec",
  "albesa",
  "albinyana",
  "albons",
  "alcanar",
  "alcano",
  "alcarras",
  "alcoletge",
  "alcover",
  "aldover",
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

export const GENERATED_CITY_SHIELD_CITIES: GeneratedCityShield[] = [
  { name: "Abella de la Conca", slug: "abella-de-la-conca", province: "Lleida", aliases: [] },
  { name: "Agramunt", slug: "agramunt", province: "Lleida", aliases: [] },
  { name: "Agullana", slug: "agullana", province: "Girona", aliases: [] },
  { name: "Aiguafreda", slug: "aiguafreda", province: "Barcelona", aliases: [] },
  { name: "Aiguaviva", slug: "aiguaviva", province: "Girona", aliases: [] },
  { name: "Aitona", slug: "aitona", province: "Lleida", aliases: [] },
  { name: "Albanyà", slug: "albanya", province: "Girona", aliases: [] },
  { name: "Albatàrrec", slug: "albatarrec", province: "Lleida", aliases: [] },
  { name: "Albesa", slug: "albesa", province: "Lleida", aliases: [] },
  { name: "Albinyana", slug: "albinyana", province: "Tarragona", aliases: [] },
  { name: "Albons", slug: "albons", province: "Girona", aliases: [] },
  { name: "Alcanar", slug: "alcanar", province: "Tarragona", aliases: [] },
  { name: "Alcanó", slug: "alcano", province: "Lleida", aliases: [] },
  { name: "Alcarràs", slug: "alcarras", province: "Lleida", aliases: [] },
  { name: "Alcoletge", slug: "alcoletge", province: "Lleida", aliases: [] },
  { name: "Alcover", slug: "alcover", province: "Tarragona", aliases: [] },
  { name: "Aldover", slug: "aldover", province: "Tarragona", aliases: [] },
  { name: "Badalona", slug: "badalona", province: "Barcelona", aliases: [] },
  { name: "Barcelona", slug: "barcelona", province: "Barcelona", aliases: [] },
  { name: "Cornellà de Llobregat", slug: "cornella-de-llobregat", province: "Barcelona", aliases: ["cornella"] },
  { name: "L'Hospitalet de Llobregat", slug: "lhospitalet", province: "Barcelona", aliases: ["l-hospitalet-de-llobregat","lhospitalet-de-llobregat"] },
  { name: "Mataró", slug: "mataro", province: "Barcelona", aliases: [] },
  { name: "Reus", slug: "reus", province: "Tarragona", aliases: [] },
  { name: "Sabadell", slug: "sabadell", province: "Barcelona", aliases: [] },
  { name: "Sant Cugat del Vallès", slug: "sant-cugat-del-valles", province: "Barcelona", aliases: [] },
  { name: "Santa Coloma de Gramenet", slug: "santa-coloma-de-gramenet", province: "Barcelona", aliases: ["santa-coloma"] },
  { name: "Terrassa", slug: "terrassa", province: "Barcelona", aliases: [] },
];
