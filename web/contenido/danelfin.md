<!--
  Texto de la sección "Qué es Danelfin". Se edita acá y se incorpora al correr el script (python seguimiento_danelfin.py).
  Formato Markdown. Las afirmaciones llevan fuente; lo que no pudo confirmarse está marcado como tal.
  PENDIENTE DEL EQUIPO: verificar cada dato contra danelfin.com (el sitio bloqueó la lectura automática, HTTP 403).
-->

## Quién es y qué hace

Danelfin es una plataforma de análisis de acciones basada en inteligencia artificial, pensada sobre todo para inversores minoristas. Su producto central es el **AI Score**, una nota de 1 a 10 que estima qué tan probable es que una acción supere al mercado en los siguientes tres meses: cuanto más alto, mayor esa probabilidad. Detrás de la nota hay un modelo de aprendizaje automático que Danelfin presenta como *IA explicable*: el usuario puede ver qué señales empujan la nota hacia arriba o hacia abajo, en lugar de recibir una caja negra [2][3].

## Cómo lo hace

- **Qué analiza:** según la propia empresa, el modelo procesa más de 10.000 características diarias por acción, de tipo fundamental, técnico y de sentimiento [1].
- **Qué entrega:** además del AI Score, la probabilidad de superar al mercado en 3 meses. En los boletines analizados en este informe, por ejemplo, RTX figura con una probabilidad de 57,42% frente a 51,20% de una acción promedio de EE. UU. [mails de Danelfin].
- **Cobertura:** acciones y ETF de EE. UU. y las empresas del índice STOXX Europe 600 [1][2].
- **Idea de la semana (*Trade Idea of the Week*):** cada semana el boletín destaca una acción con score de compra (BUY) cuyas señales de compra pasadas tuvieron una tasa de acierto de 70% o más a 3 meses desde 2017. Cada mail trae además parámetros sugeridos: precio de entrada, horizonte de 3 meses, **stop loss** y **take profit** (o salida si cambia el AI Score) [mails de Danelfin]. Son esos parámetros los que se siguen en este informe.

## Cómo se arma el AI Score

Según la documentación de la propia empresa: su centro de ayuda [7] y el sitio de auditoría que publica, *Danelfin AI Audit* [6].

1. **Datos.** Cada rueda calcula unos 900 indicadores por acción: más de 600 técnicos (RSI, MACD, MFI, momentum, volatilidad, distancia a soportes, máximo de 52 semanas, entre otros), unos 150 fundamentales (P/E, P/FCF, EBITDA, margen bruto, ROA, F-Score de Piotroski, crecimiento de ventas y de ganancias) y unos 150 de sentimiento (precio objetivo de analistas, estimaciones de ganancias, *short float*, compras de insiders y de fondos). Con ellos arma unas 10.000 variables (*features*). Todos los datos son públicos; además genera patrones propios de precio a 30, 60 y 90 ruedas [7].
2. **Señales (*alpha signals*).** Con las últimas 252 ruedas en EE. UU. (504 en Europa), el modelo identifica qué variables anticiparon mejor el *alpha*, positivo o negativo, a 3 meses (unas 60 ruedas). Se reentrena en ventana móvil [6][7].
3. **Modelo.** Combina esas señales en unos 500 árboles de decisión con *gradient boosting* (LightGBM). Cada árbol corrige el error del anterior y la probabilidad final es la suma de esas correcciones [6][7]. Algunas guías antiguas del centro de ayuda la describen como "el promedio de los árboles", pero eso no corresponde a LightGBM.
4. **Objetivo.** El modelo estima la probabilidad de que la acción supere al S&P 500 (el ETF SPY, con dividendos) en los 3 meses siguientes. Para acciones europeas la referencia es el STOXX Europe 600 [6][7].
5. **Puntaje.** El AI Score de 1 a 10 sale de la *ventaja de probabilidad*: cuánto supera la probabilidad de la acción al promedio de todas las acciones de EE. UU. Ese promedio suele estar por debajo de 50%, porque la mayoría de las más de 5.000 acciones no le gana al S&P 500. En un ejemplo de la propia Danelfin, una acción con 48,6% contra un promedio de 34,7% (+13,9 puntos) obtuvo un 10 [7]. La equivalencia es: 10 compra fuerte, 7 a 9 compra, 4 a 6 mantener, 2 y 3 venta, 1 venta fuerte. Desde el 30/09/2026 la conversión aplica además una penalización por volatilidad [6]. Las recomendaciones de este informe son anteriores a ese cambio.
6. **Subpuntajes.** El técnico, el fundamental y el de sentimiento se calculan igual que el AI Score, pero solo con las señales de su tipo. El AI Score no es su promedio y puede diferir mucho de ellos. El subpuntaje de **riesgo bajo** mide la semidesviación (las caídas de precio) de las últimas 500 ruedas: cuanto más alto, menos riesgo bajista [6][7].
7. **Actualización.** Se recalcula cada día hábil con el cierre del día anterior [7].

**Cómo elige la *idea de la semana*.** Una *Trade Idea* es una acción con señal de compra actual cuyas señales de compra pasadas tuvieron una tasa de acierto de al menos 60% (los boletines analizados piden 70%). Danelfin aclara que ese porcentaje describe señales pasadas y no es una probabilidad para la próxima [7].

## Qué muestra su propia auditoría

El sitio *Danelfin AI Audit* [6] (datos al 24/09/2026) separa dos períodos que conviene no mezclar:

- **Antes del 7/7/2025: simulación.** Los puntajes de 2017 a julio de 2025 fueron **recalculados en 2025 por el modelo actual**, *walk-forward*: cada fecha se puntúa con un modelo entrenado solo con datos previos a ella. El propio sitio aclara que es un *backtest* simulado y que sus controles no pueden detectar sesgo de anticipación (*look-ahead*) dentro de esos puntajes recalculados. También reconoce un sesgo de supervivencia: la historia no incluye empresas que dejaron de cotizar, como Twitter, Silicon Valley Bank o Celgene.
- **Desde el 7/7/2025: en vivo.** Son los únicos puntajes publicados en el momento. A 3 meses, el *alpha* promedio contra el S&P 500 fue:

| AI Score | En vivo (7/7/2025 – 9/2026) | Simulado (2017 – 7/2025) |
|---|---|---|
| 8 a 10 | −0,50% | +2,22% |
| 10 | −6,35% (positivo en 33% de las fechas) | +3,18% |
| 8 a 10 menos 1 a 3 | +12,95% | +7,05% |

En vivo, los puntajes altos le ganaron poco o nada al S&P 500 a 3 meses, aunque las acciones con puntaje alto sí superaron con holgura a las de puntaje bajo. El sitio advierte que el período en vivo es corto y que hay pocas observaciones independientes (su "N efectivo" a 3 meses es 4), así que no permite conclusiones firmes. Dentro de la simulación, el *alpha* a 3 meses de las acciones con puntaje 10 baja con el tiempo: +5,4% en 2017-2019, +0,3% en 2020-2022 y −0,5% de 2023 a julio de 2025.

## Historia

- **2016:** se funda la empresa Danel Capital, que opera como Danelfin, con sede en Barcelona (España) [3]. Los fundadores son Tomás Diago (CEO), Aarón Román (científico de datos jefe) y Guillermo Salas (CTO) [1].
- **Septiembre de 2021:** presentación de la plataforma tras más de cinco años de investigación y desarrollo, con acceso gratuito y planes pagos para funciones avanzadas [2].
- **2023:** premio a la mejor empresa de investigación financiera en los Benzinga Fintech Awards [1].
- **2024:** ronda de inversión de 2 millones de euros liderada por Nauta Capital. En ese momento la empresa decía tener 60.000 inversores registrados en 50 países [1].

## Qué dice de sí misma y cómo leerlo

Danelfin comunica que las acciones con AI Score 10 superaron al S&P 500 en promedio en los 3 meses siguientes (+14,69% en cinco años, según la nota de prensa de 2024) [1]. Reseñas externas señalan que la cifra de rendimiento acumulado que difunde la empresa para su estrategia es un *backtest* (simulación sobre datos pasados), no un historial auditado en vivo, y que la empresa publica aparte una página con el seguimiento de señales hacia adelante [4]. Esa distinción importa: este informe es un seguimiento en tiempo real de un conjunto acotado de señales, no una simulación sobre datos pasados.

**Una diferencia que conviene tener presente.** El AI Score estima superar *al mercado* (un resultado relativo), mientras que el stop loss y el take profit de los mails son niveles de precio *absolutos*. Por eso medimos las dos cosas: el rendimiento con esas reglas y el *alpha* contra el S&P 500.

## Fuentes

1. Nauta Capital, [«Danelfin, the AI-powered stock analytics platform, raises €2M…»](https://www.nautacapital.com/news-insights/danelfin-the-ai-powered-stock-analytics-platform-raises-eu2m-to-help-retail-investors-make-better-decisions), 12/06/2024.
2. Merca2, [«Danelfin, la nueva plataforma de inteligencia artificial para el análisis de acciones»](https://www.merca2.es/2021/09/26/danelfin-stoxx-600-ai-score-1163803/), 26/09/2021.
3. Descripciones de la plataforma en directorios y reseñas (por ejemplo, [CB Insights](https://www.cbinsights.com/company/danelfin)), usadas solo para confirmar el concepto del AI Score de 1 a 10.
4. Reseñas externas, por ejemplo [Pineify, «Danelfin Review»](https://pineify.app/danelfin/danelfin-review); no verificado contra los documentos de Danelfin.
5. Boletín *Trade Idea of the Week* de Danelfin AI (boletines de julio a septiembre de 2026).
6. Danelfin, [*Danelfin AI Audit*](https://audit.danelfin.com/): [«How It Works»](https://audit.danelfin.com/how-it-works.html), [preguntas frecuentes](https://audit.danelfin.com/faq.html) y pestañas *Live vs. Sub-Periods* y *Bias Audit*, datos al 24/09/2026, consultado el 02/11/2026.
7. Centro de ayuda de Danelfin ([help.danelfin.com](https://help.danelfin.com/en/categories/ai-score)): guías sobre el AI Score, los subpuntajes, las *alpha signals*, el riesgo bajo, la probabilidad promedio y las *Trade Ideas*, consultado el 02/11/2026.
