# Poker – Texas Hold'em

Turnaj Texas Hold'em pro 2–9 hráčů v prohlížeči. Hraje se proti botům (i offline), nebo s přáteli přes odkaz. Vlastní server přijde.

**Hrát:** https://poker.opikula.dev

## Hra s přáteli přes odkaz

1. V lobby zvol **Přes odkaz** a klikni na **Vytvořit stůl**.
2. Pošli odkaz (např. `https://poker.opikula.dev/#K7F2Q`) ostatním. Kdo ho otevře, zadá jméno a sedne si ke stolu.
3. Až jsou všichni u stolu, klikni na **Spustit turnaj**. Volná místa můžou doplnit boti.

Jak to funguje:

- Hra běží v prohlížeči hostitele. Ostatní posílají jen své tahy a dostávají stav stolu, ve kterém vidí jen svoje karty.
- Spojení se naváže přes veřejný server PeerJS; data pak tečou přímo mezi prohlížeči (WebRTC). Potřebuje to internet.
- Kdo obnoví stránku nebo na chvíli vypadne, vrátí se na svoje místo (prohlížeč si pamatuje token stolu). Odpojeného hráče hra pozná do 10 s a za jeho tahy dává check, nebo fold.
- Hostitel nesmí zavřít stránku – tím by hra skončila všem.
- Hostitel má technicky v paměti všechny karty. Mezi kamarády to nevadí; pro hru s cizími lidmi bude lepší vlastní server.
- V některých firemních nebo školních sítích se WebRTC spojení nenaváže.

## Spuštění

```bash
npm install
npm run dev
```

Pak otevři `http://localhost:5173`.

## Příkazy

| Příkaz | Co dělá |
| --- | --- |
| `npm run dev` | vývojový server |
| `npm test` | testy enginu (vyhodnocení rukou, side poty, sázky, simulace turnajů) |
| `npm run build` | produkční build do `dist/` |
| `npm run preview` | spustí hotový build lokálně |

## Instalace jako aplikace a hra bez internetu

Stránka je PWA. V Chrome nebo Edge klikni na ikonu instalace v adresním řádku. Po prvním načtení se všechno uloží a hra proti botům jde spustit i offline.

## Nasazení na GitHub Pages

1. Nahraj repozitář na GitHub (větev `main`).
2. V repozitáři: **Settings → Pages → Source: GitHub Actions**.
3. Každý push do `main` hru sestaví a nasadí (`.github/workflows/pages.yml`).

## Ovládání

- **F** fold, **C** check/dorovnat, **R** navýšit, **A** all in
- Částka navýšení: posuvník, číslo, nebo předvolby Min / ½ banku / ¾ banku / Bank
- Předvolby tahu: Check / Fold, Dorovnat cokoli

## Struktura

- `src/engine/` – pravidla bez UI (karty, vyhodnocení rukou, banky, průběh ruky, turnaj)
- `src/bots/` – boti (odhad šance na výhru metodou Monte Carlo, 3 obtížnosti)
- `src/net/` – hra přes odkaz: protokol, stůl hostitele, připojení hráče (PeerJS)
- `src/ui/` – React obrazovky (lobby, stůl, panel kombinací, dialogy)
- `src/styles/app.css` – vzhled podle design systému OK Apps
