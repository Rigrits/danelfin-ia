# TP IA · Seguimiento de las recomendaciones de Danelfin

Trabajo práctico de Sistema Financiero Internacional: seguimiento de las recomendaciones BUY de Danelfin AI
(precio de entrada, stop loss, take profit, rendimiento real y *hold*, comparación con el S&P 500 e indicadores técnicos).

Se publica como una web estática (`web/`) y un Excel descargable, y se actualiza sola cada día hábil después del cierre de EE. UU.

## Cómo está armado

```
recomendaciones.csv          Única entrada de datos (ticker, fecha, AI Score, entrada, SL, TP...)
seguimiento_danelfin.py      Baja precios, evalúa SL/TP, calcula indicadores y genera Excel + datos de la web
data/cierres.csv             Cierres de la última rueda; se commitea cada día (mantiene activo el repo)
web/                         El sitio (HTML, CSS y JavaScript sin framework; funciona offline)
  index.html · css/ · js/ · vendor/ · fonts/
  contenido/danelfin.md      Texto de "Qué es Danelfin"
  contenido/conclusiones.md  Interpretación del equipo (opcional)
  data/datos.js              GENERADO (no se versiona)
  descargas/*.xlsx           GENERADO (no se versiona)
.github/workflows/actualizar.yml   Corre el script, commitea los cierres y publica en GitHub Pages
```

## Usarlo en la computadora

```bash
pip install -r requirements.txt
python seguimiento_danelfin.py
```

Genera `web/data/datos.js` y `web/descargas/Seguimiento_Danelfin_IA.xlsx`. Después se abre `web/index.html`
(doble clic) o se manda la carpeta `web/` completa por Teams. No necesita internet para verse.

Otras opciones: `--refresh` (ignora la caché), `--corte ultimo-viernes`, `--verify` (contrasta yfinance contra Massive),
`--debug-indicators RTX` (imprime los indicadores para compararlos con TradingView).

Clave opcional de respaldo: copiar `.env.example` como `.env` y completar `MASSIVE_API_KEY`.

## Agregar una recomendación nueva

Los mails originales **no se suben al repositorio** (son contenido de un tercero). Se convierten a filas del CSV en la PC de quien los tiene:

```bash
python seguimiento_danelfin.py --importar-eml "ruta/a/la/carpeta/con/los/.eml"
git add recomendaciones.csv
git commit -m "feat: nueva recomendación"
git push
```

El push dispara el workflow y la web se actualiza sola. (También se puede agregar una fila a mano en GitHub: ticker, fecha,
score, prob, entry, sl, tp; las columnas `winrate` y `avgret` son opcionales.)

## Publicar en GitHub Pages (una sola vez)

1. Crear un repositorio **público** nuevo en GitHub (Pages gratis lo requiere) y subir el contenido de esta carpeta.
2. En *Settings → Pages → Build and deployment → Source*, elegir **GitHub Actions**.
3. En *Settings → Secrets and variables → Actions*, crear el secreto `MASSIVE_API_KEY` (respaldo si Yahoo bloquea a los servidores de GitHub).
4. En la pestaña *Actions*, correr a mano *Actualizar seguimiento y publicar web* ("Run workflow"). Las siguientes corridas son automáticas.

La URL queda `https://<usuario>.github.io/<repositorio>/`.

## Límites y políticas de GitHub (revisados en la documentación oficial)

- **Minutos de Actions:** los runners estándar son gratis en repos públicos; un repo privado descuenta de la cuota mensual (2.000 minutos en el plan Free). Una corrida de este workflow dura pocos minutos.
- **Cron:** puede atrasarse en horas pico (por eso corre al minuto 30), solo corre en la rama principal y **se apaga a los 60 días sin actividad** en repos públicos: el commit diario de `data/cierres.csv` lo evita.
- **Pages:** sitio de hasta 1 GB, ~100 GB de ancho de banda al mes (límite blando); el límite de 10 builds por hora no aplica a despliegues con Actions. No se permite uso comercial.
- Las versiones de las acciones del workflow eran las vigentes al escribirlo; si algún paso falla tras una actualización, revisar sus notas de versión.

## Avisos

Trabajo académico, sin fines comerciales. No constituye asesoramiento de inversión. Precios de Yahoo Finance (yfinance) y Massive; revisar sus condiciones de uso antes de redistribuir datos. Recomendaciones del boletín *Trade Idea of the Week* de Danelfin AI.

Librerías incluidas: [Chart.js](https://www.chartjs.org/) y [marked](https://marked.js.org/) (MIT). Tipografías: Source Serif 4 y Atkinson Hyperlegible (SIL Open Font License; licencias en `web/fonts/`).
