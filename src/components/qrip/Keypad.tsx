import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

export function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="flex justify-center gap-4">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "size-14 rounded-2xl border-2 border-border bg-card transition-all duration-200",
            i < filled && "scale-105 border-transparent bg-gradient-teal card-pop",
          )}
        >
          <div className="flex h-full items-center justify-center text-3xl font-extrabold text-teal-foreground">
            {i < filled ? "•" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

/** In-app numeric keypad — the device keyboard is never used for the code. */
export function Keypad({
  onDigit,
  onDelete,
}: {
  onDigit: (d: string) => void;
  onDelete: () => void;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
  return (
    <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-3">
      {keys.map((key, i) => {
        if (key === "")
          return <div key={i} aria-hidden className="size-full" />;
        const isDelete = key === "del";
        return (
          <button
            key={i}
            type="button"
            onClick={() => (isDelete ? onDelete() : onDigit(key))}
            aria-label={isDelete ? "Effacer" : key}
            className={cn(
              "press flex h-16 items-center justify-center rounded-3xl text-2xl font-extrabold active:press-active",
              isDelete
                ? "bg-muted text-muted-foreground"
                : "bg-card text-foreground soft-shadow",
            )}
          >
            {isDelete ? <Delete className="size-6" /> : key}
          </button>
        );
      })}
    </div>
  );
}
