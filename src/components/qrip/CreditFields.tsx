import { cn } from "@/lib/utils";

export function CreditFields({
  kind,
  onCredit,
  setOnCredit,
  phone,
  setPhone,
}: {
  kind: "achat" | "vente" | null;
  onCredit: boolean;
  setOnCredit: (v: boolean) => void;
  phone: string;
  setPhone: (v: string) => void;
}) {
  return (
    <section className="space-y-3 rounded-3xl bg-card p-5 soft-shadow">
      <span className="text-sm font-bold text-muted-foreground">Paiement</span>
      <div className="grid grid-cols-2 gap-2">
        {([[false, "Payé"], [true, "À crédit"]] as const).map(([value, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => setOnCredit(value)}
            className={cn(
              "press rounded-2xl px-3 py-3 font-extrabold",
              onCredit === value ? (value ? "bg-gradient-sun text-sun-foreground" : "bg-gradient-teal text-teal-foreground") : "bg-muted text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {onCredit && (
        <label className="block">
          <span className="text-sm font-bold text-muted-foreground">
            Contact {kind === "achat" ? "du fournisseur" : "du client"} (pour les relances)
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            maxLength={20}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07 00 00 00 00"
            className="mt-2 w-full rounded-2xl bg-muted px-4 py-3 font-bold outline-none"
          />
        </label>
      )}
    </section>
  );
}
