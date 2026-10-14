# Poker – Texas Hold'em

Turnaj Texas Hold'em pro 2–9 hráčů v prohlížeči. Hraje se proti botům (i offline), nebo s přáteli přes odkaz. Vlastní server přijde.

**Hrát:** https://poker.opikula.dev

## Herní módy

- **Turnaj** – blindy rostou, kdo přijde o žetony, vypadává. Vyhrává poslední u stolu.
- **Sit & Go turbo** – rychlý turnaj: 1 500 žetonů, blindy 10/20, nový level každé 3 minuty.
- **Cash game** – blindy nerostou, kdo přijde o žetony, může dokoupit. Ukazuje se zisk/ztráta.
- **Trénink s nápovědou** (jen proti botům) – šance na výhru, potřebná šance (pot odds), outy a doporučený tah.
- **Game Changer** (dá se zapnout ke každému módu) – před rukou se vylosuje karta, která na jedno kolo změní pravidla. Jak často: každá ruka / často / občas.

### Game Changer karty (40)

| Karta | Vzácnost | Co dělá |
| --- | --- | --- |
| Obrácené pořadí | běžná | nejslabší kombinace vyhrává (nejvyšší karta > pár > …) |
| Pár je král | běžná | pár je nejsilnější ruka |
| Šestá karta | běžná | 6 karet na stole, river dvakrát |
| Tři do ruky | běžná | každý má 3 karty |
| Dvojité blindy | běžná | blindy ×2 |
| Ante pro všechny | běžná | každý dá 1 BB před rozdáním |
| Bleskové kolo | běžná | 7 s na tah |
| Jen flop | běžná | po flopu se rovnou vyhodnocuje |
| Odhalená karta | běžná | jedna karta každého je vidět všem |
| Bez barev | běžná | barva ani postupka v barvě neplatí |
| Přeházené pořadí | vzácná | pořadí kombinací se náhodně zamíchá |
| Nejnižší bere | vzácná | vyhrává nejslabší ruka |
| Omaha kolo | vzácná | 4 karty do ruky, použít přesně 2 |
| Krátký balíček | vzácná | bez 2–5, barva poráží full house |
| Limit kolo | vzácná | navýšení jen o 1 BB, max 3 za kolo |
| Pot limit | vzácná | navýšení nejvýš o velikost banku |
| Naslepo | vzácná | svoje karty uvidíš až po flopu |
| All in nebo fold | vzácná | každá sázka je all in |
| Výměna balancí | legendární | dva hráči si prohodí žetony |
| Velké míchání | legendární | žetony všech hráčů se přehází |
| Skryté sázky | běžná | sázky soupeřů a bank nejsou vidět až do konce ruky |
| Eso dolů | běžná | eso je nejnižší karta (jednička) |
| Špatný dealer | běžná | dealerem je hráč s nejmenším stackem |
| Skrytá river | vzácná | river leží rubem až do vyhodnocení |
| Draw poker | vzácná | po prvním sázení výměna až 2 karet z ruky |
| Bounty | vzácná | vítěz dostane 1 BB od každého, kdo byl v ruce |
| Rychlý flop | vzácná | flop leží na stole hned od začátku |
| Dokup kartu | vzácná | před flopem jedna karta navíc za 1 BB |
| Ruleta karet | vzácná | každý dostane náhodně 1–4 karty |
| Hladovka | vzácná | kdo má méně než 5 BB, jde povinně all in |
| Zrcadlový pot | vzácná | bank se dělí mezi všechny, kdo nesložili |
| Hra pro dva | vzácná | hrají jen small a big blind |
| Obrácené rozdávání | legendární | 2 karty na stole, 0 v ruce; pak do ruky 3, 1 a 1 |
| Deset karet | legendární | 10 společných karet na stole |
| Otevřené karty | legendární | všichni vidí karty všech |
| Zemětřesení | legendární | stůl se otřese a karty se rozsypou (jen vzhled) |
| Jackpot | legendární | výhra s jackpot kartou = 1 BB od každého u stolu |
| Tma | legendární | nevidíš žetony ani sázky soupeřů |
| Déjà vu | exotická | druhý stůl, bank se dělí na poloviny |
| Černá kočka | exotická | kdo má kočku v ruce, platí 2 BB do banku |

V turnaji žádná karta žetony nepřidá ani neubere – jen je přesouvá.

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
