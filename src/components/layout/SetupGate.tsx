import { Check, Copy, Leaf } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";

/**
 * Setup gate – aplikace se bez připojení k Supabase nespustí
 * do „demo" verze. Místo toho přesně řekne, co je potřeba
 * nastavit. Tohle je jednorázový stav, ne funkce produktu.
 */

function KopirujRadek({ text }: { text: string }) {
  const [zkopirovano, setZkopirovano] = useState(false);
  return (
    <button
      className="group flex w-full items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-left font-mono text-xs"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setZkopirovano(true);
          toast.success("Zkopírováno do schránky");
          setTimeout(() => setZkopirovano(false), 1500);
        });
      }}
    >
      <span className="truncate">{text}</span>
      {zkopirovano ? (
        <Check className="size-4 shrink-0 text-ok" />
      ) : (
        <Copy className="size-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

export function SetupGate() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-4">
      <div className="om-karta w-full max-w-xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-fg">
            <Leaf className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">OptiMeal</h1>
            <p className="text-sm text-muted">Chybí připojení k databázi</p>
          </div>
        </div>

        <p className="text-sm text-fg">
          Aplikace potřebuje přihlašovací údaje k Supabase projektu, aby mohla
          ukládat účty, jídelníčky a ceny. Dokud nejsou, žádný „demo režim"
          nepoběží – nastavení je otázkou pěti minut:
        </p>

        <ol className="mt-5 ml-4 list-decimal space-y-2.5 text-sm text-muted">
          <li>
            Na{" "}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              supabase.com
            </a>{" "}
            vytvořte projekt (Free tier stačí), region{" "}
            <strong>Central EU (Frankfurt)</strong>.
          </li>
          <li>
            Otevřete <strong>Project Settings → API</strong> a zkopírujte
            <strong> Project URL</strong> a <strong>anon public key</strong>.
          </li>
          <li>
            Ve složce projektu vytvořte soubor <code>.env</code>:
            <div className="mt-2 space-y-1.5">
              <KopirujRadek text="VITE_SUPABASE_URL=https://VASE-ID.supabase.co" />
              <KopirujRadek text="VITE_SUPABASE_ANON_KEY=VASE-ANON-KLIC" />
            </div>
          </li>
          <li>
            Pouštějte databázi: <code>supabase/migrations/0001_init.sql</code> a{" "}
            <code>supabase/seed.sql</code> (SQL editor v Supabase → New query).
          </li>
          <li>Restartujte dev server (<code>npm run dev</code>).</li>
        </ol>

        <div className="mt-6 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          <Badge tono="warning">Bezpečnost</Badge>
          <span>
            Do frontendu patří jen <strong>anon public</strong> klíč – service
            role klíč nikdy.
          </span>
        </div>
      </div>
    </div>
  );
}
