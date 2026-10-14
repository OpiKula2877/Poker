# Poker – Texas Hold'em

Turnaj Texas Hold'em pro 2–9 hráčů v prohlížeči. Zatím se hraje proti botům; hra přes odkaz a vlastní server přijdou.

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
- `src/ui/` – React obrazovky (lobby, stůl, panel kombinací, dialogy)
- `src/styles/app.css` – vzhled podle design systému OK Apps
