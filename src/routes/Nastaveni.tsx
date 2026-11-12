import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Card, CardNadpis } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { supabaseNastaveno } from "@/lib/supabase";

/**
 * Nastavení – motiv, jazyk (připraveno) a stav propojení se Supabase
 * včetně návodů pro nastavení proměnných prostředí.
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

export function Nastaveni() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Nastavení</h1>

      {/* stav propojení */}
      <Card>
        <CardNadpis>Propojení s Supabase (databáze + přihlášení)</CardNadpis>
        {supabaseNastaveno ? (
          <div className="flex items-center gap-2 text-sm">
            <Badge tono="ok">Připojeno</Badge>
            <span className="text-muted">Aplikace komunikuje se Supabase projektem.</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge tono="warning">Demo režim</Badge>
              <span className="text-muted">
                Chybí proměnné prostředí – data se neukládají a přihlášení není aktivní.
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-semibold">Jak propojit (5 minut):</p>
              <ol className="ml-4 list-decimal space-y-2 text-muted">
                <li>
                  Zaregistrujte se na{" "}
                  <a
                    href="https://supabase.com"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-primary hover:underline"
                  >
                    supabase.com
                  </a>{" "}
                  (zdarma) a klikněte na <strong>New project</strong>.
                </li>
                <li>
                  Zvolte název (např. <em>optimeal</em>), heslo k databázi si uložte,
                  region <strong>Central EU (Frankfurt)</strong>.
                </li>
                <li>
                  Po vytvoření otevřete <strong>Settings → API</strong> a zkopírujte
                  <strong> Project URL</strong> a <strong>anon public key</strong>.
                </li>
                <li>
                  Ve složce projektu vytvořte soubor <code>.env</code> s těmito dvěma řádky:
                  <div className="mt-2 space-y-1.5">
                    <KopirujRadek text="VITE_SUPABASE_URL=https://VASE-ID.supabase.co" />
                    <KopirujRadek text="VITE_SUPABASE_ANON_KEY=VASE-ANON-KLIC" />
                  </div>
                </li>
                <li>
                  Restartujte dev server (<code>npm run dev</code>) – aplikace se připojí.
                </li>
              </ol>
              <p className="text-xs text-muted">
                Pozor: používá se jen <strong>anon public</strong> klíč (veřejný, chráněný
                bezpečnostními pravidly RLS). Service role klíč nikdy do frontendu nedávejte.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* motiv */}
      <Card>
        <CardNadpis>Vzhled</CardNadpis>
        <p className="text-sm text-muted">
          Přepínač motivu najdete v levém bočním menu (na mobilu v horní liště) –
          světlý, tmavý i automatický dle systému.
        </p>
      </Card>
    </div>
  );
}
