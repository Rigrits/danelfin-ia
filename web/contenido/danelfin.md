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

Según la descripción que publica la propia empresa [6][7]:

- **Datos:** cada día calcula unas 10.000 variables (*features*) por acción, a partir de más de 600 indicadores técnicos, 150 fundamentales y 150 de sentimiento.
- **Señales:** el modelo busca las que más *alpha* (rendimiento por encima del mercado) generaron en el pasado reciente: las últimas 252 ruedas para acciones de EE. UU. y 500 para Europa. Danelfin las llama *alpha signals*.
- **Modelo:** esas señales alimentan un conjunto de árboles de decisión. Una página habla de 500 árboles y otra de "cientos". La probabilidad de la acción es el promedio de la de todos los árboles y, en EE. UU., se ajusta por la volatilidad de la acción.
- **Resultado:** esa probabilidad de superar al índice de referencia en 3 meses se traduce al AI Score de 1 a 10. La plataforma también muestra cuatro subpuntajes de 1 a 10 (técnico, fundamental, sentimiento y riesgo bajo) y qué señales suman o restan en cada caso.

Es la metodología declarada por Danelfin. No hay una auditoría independiente del modelo y la empresa no detalla cómo calcula el subpuntaje de riesgo bajo.

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
6. Danelfin, [«How it Works»](https://danelfin.com/how-it-works) e [infografía](https://danelfin.com/how-it-works/infographic), consultadas el 02/11/2026.
7. Centro de ayuda de Danelfin, [«What is the AI Score? How it rates stocks and ETFs?»](https://support.danelfin.com/hc/en-us/articles/4404382038545-What-is-the-AI-Score-How-it-rates-stocks-and-ETFs), consultado el 02/11/2026.
