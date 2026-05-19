import { toast } from "sonner";

export default function ShareButton() {
  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "La Lliga del Sobresalt", url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado al portapapeles");
    }
  }

  return (
    <button
      onClick={handleShare}
      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-amber-300"
      aria-label="Compartir"
    >
      Compartir
    </button>
  );
}
