import logo from "@/assets/logo.png";

/** Bandeau d'identité du club affiché sur les pages publiques (externes). */
export function PublicBrand({ className = "" }: { className?: string }) {
  return (
    <div className={`mb-4 flex items-center justify-center gap-3 ${className}`}>
      <img src={logo} alt="Club Ciné Tremplin" className="h-14 w-14 object-contain" />
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-wide">CLUB CINÉ TREMPLIN</p>
        <p className="text-xs text-muted-foreground">On apprend, on tourne, on décolle</p>
      </div>
    </div>
  );
}
