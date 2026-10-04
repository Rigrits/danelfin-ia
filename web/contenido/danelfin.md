<!--
  Texto de la sección "Qué es Danelfin". Se edita acá y se incorpora al correr el script (python seguimiento_danelfin.py).
  Formato Markdown. Las afirmaciones llevan fuente; lo que no pudo confirmarse está marcado como tal.
  PENDIENTE DEL EQUIPO: verificar cada dato contra danelfin.com (el sitio bloqueó la lectura automática, HTTP 403).
-->

## Quién es y qué hace

Danelfin es una plataforma de análisis de acciones basada en inteligencia artificial, pensada sobre todo para inversores minoristas. Su producto central es el **AI Score**, una nota de 1 a 10 que estima qué tan probable es que una acción supere al mercado en los siguientes tres meses: cuanto más alto, mayor esa probabilidad. Detrás de la nota hay un modelo de aprendizaje automático que Danelfin presenta como *IA explicable*: el usuario puede ver qué señales empujan la nota hacia arriba o hacia abajo, en lugar de recibir una caja negra [2][3].

## Cómo lo hace

- **Qué analiza:** según la propia empresa, el modelo procesa más de 10.000 características diarias por acción, de tipo fundamental, técnico y de sentimiento [1].
- **Qué entrega:** además del AI Score, la probabilidad de superar al mercado en 3 meses. En los mails que usamos en este trabajo, por ejemplo, RTX figura con una probabilidad de 57,42% frente a 51,20% de una acción promedio de EE. UU. [mails de Danelfin].
- **Cobertura:** acciones y ETF de EE. UU. y las empresas del índice STOXX Europe 600 [1][2].
- **Idea de la semana (*Trade Idea of the Week*):** cada semana el boletín destaca una acción con score de compra (BUY) cuyas señales de compra pasadas tuvieron una tasa de acierto de 70% o más a 3 meses desde 2017. Cada mail trae además parámetros sugeridos: precio de entrada, horizonte de 3 meses, **stop loss** y **take profit** (o salida si cambia el AI Score) [mails de Danelfin]. Son esos parámetros los que seguimos en este trabajo.

## Historia

- **2016:** se funda la empresa Danel Capital, que opera como Danelfin, con sede en Barcelona (España) [3]. Los fundadores son Tomás Diago (CEO), Aarón Román (científico de datos jefe) y Guillermo Salas (CTO) [1].
- **Septiembre de 2021:** presentación de la plataforma tras más de cinco años de investigación y desarrollo, con acceso gratuito y planes pagos para funciones avanzadas [2].
- **2023:** premio a la mejor empresa de investigación financiera en los Benzinga Fintech Awards [1].
- **2024:** ronda de inversión de 2 millones de euros liderada por Nauta Capital. En ese momento la empresa decía tener 60.000 inversores registrados en 50 países [1].

## Qué dice de sí misma y cómo leerlo

Danelfin comunica que las acciones con AI Score 10 superaron al S&P 500 en promedio en los 3 meses siguientes (+14,69% en cinco años, según la nota de prensa de 2024) [1]. Reseñas externas señalan que la cifra de rendimiento acumulado que difunde la empresa para su estrategia es un *backtest* (simulación sobre datos pasados), no un historial auditado en vivo, y que la empresa publica aparte una página con el seguimiento de señales hacia adelante [4]. Esa distinción importa para este trabajo: lo que hacemos acá es un seguimiento en tiempo real de unas pocas señales.

**Una diferencia que conviene tener presente.** El AI Score estima superar *al mercado* (un resultado relativo), mientras que el stop loss y el take profit de los mails son niveles de precio *absolutos*. Por eso medimos las dos cosas: el rendimiento con esas reglas y el *alpha* contra el S&P 500.

## Fuentes

1. Nauta Capital, [«Danelfin, the AI-powered stock analytics platform, raises €2M…»](https://www.nautacapital.com/news-insights/danelfin-the-ai-powered-stock-analytics-platform-raises-eu2m-to-help-retail-investors-make-better-decisions), 12/06/2024.
2. Merca2, [«Danelfin, la nueva plataforma de inteligencia artificial para el análisis de acciones»](https://www.merca2.es/2021/09/26/danelfin-stoxx-600-ai-score-1163803/), 26/09/2021.
3. Descripciones de la plataforma en directorios y reseñas (por ejemplo, [CB Insights](https://www.cbinsights.com/company/danelfin)), usadas solo para confirmar el concepto del AI Score de 1 a 10.
4. Reseñas externas, por ejemplo [Pineify, «Danelfin Review»](https://pineify.app/danelfin/danelfin-review); no verificado contra los documentos de Danelfin.
5. Boletín *Trade Idea of the Week* de Danelfin AI (mails reenviados por la cátedra, agosto a septiembre de 2026).
