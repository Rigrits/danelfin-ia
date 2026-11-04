<!--
  Textos del modo presentación (botón "Presentar" o enlace #presentar). Se incorporan al correr el script.
  Cada diapositiva empieza con "## N · Nombre". Arriba van campos "clave: valor":
    tipo:    qué contenido en vivo arma la diapositiva (portada, danelfin, metodo, numeros, dolares, semanal,
             contexto, empresas, casos, stop, tecnico, cierre)
    titulo:  título grande · idea: una oración debajo del título
    bloque / tiempo: se muestran en las notas (tiempo sugerido del bloque; va en la primera diapositiva del bloque)
    mes:     (empresas) muestra las recomendaciones de ese mes, formato AAAA-MM
    punto:   (contexto, cierre) se puede repetir; cada uno es un renglón en pantalla
    caso:    (casos) "TICKER | frase"; se puede repetir
  Lo que sigue a los campos son las NOTAS (tecla N). Son públicas: sin nombres ni comentarios internos.
  No escribir cifras que cambian (rendimientos, cantidades): esas salen en vivo de los datos.
  La sección "## Frases" tiene una línea corta por empresa para las tarjetas.
-->

## 1 · Portada
tipo: portada
bloque: Apertura
tiempo: 2:30
titulo: ¿Acertó Danelfin?
idea: Seguimos en tiempo real las recomendaciones de compra de una plataforma de inteligencia artificial, con sus propias reglas.

- Plantear la pregunta: si una IA que promete superar al mercado acertó en sus ideas de compra.
- Anticipar el recorrido: qué es Danelfin y cómo arma su puntaje, resultados, empresas, foto técnica y cierre.

## 2 · Qué promete Danelfin
tipo: danelfin
titulo: Qué promete Danelfin
idea: Un puntaje de 1 a 10 que estima la probabilidad de que una acción supere al mercado en los siguientes tres meses.

- Plataforma fundada en Barcelona en 2016. Cada semana su boletín elige una acción y sugiere entrada, stop loss y take profit.
- Cómo arma el puntaje: ~900 indicadores diarios por acción (técnicos, fundamentales, de sentimiento), convertidos en ~10.000 variables.
- Busca qué variables anticiparon superar al S&P 500 a 3 meses en el último año de ruedas y las combina en ~500 árboles de decisión en cadena (LightGBM).
- El puntaje de 1 a 10 refleja cuánto supera la probabilidad de la acción al promedio del mercado. Es relativo: un 10 puede tener menos de 50% de probabilidad.
- Su propia auditoría separa una simulación (2017 a julio de 2025, recalculada en 2025) de un período en vivo (desde el 7/7/2025). En vivo, a 3 meses, los puntajes 8 a 10 dieron −0,5% contra el S&P 500, y los 10, −6,4%. En la simulación: +2,2% y +3,2%. El período en vivo todavía es corto.
- La "idea de la semana" exige que las señales de compra pasadas de esa acción hayan acertado 70% o más; Danelfin aclara que no es una probabilidad para la próxima.
- Las cifras de la parte de arriba son las que Danelfin cita en sus propios boletines.

## 3 · Los números
tipo: numeros
bloque: Resultados
tiempo: 2:00
titulo: Los números
idea: Siguiendo sus reglas, la mayoría de las recomendaciones terminó en pérdida.

- Leer las cuatro cifras de izquierda a derecha.
- Remarcar la diferencia entre el resultado real y el hold: es lo que hizo el stop.

## 4 · En dólares
tipo: dolares
titulo: En dólares
idea: El mismo capital en cada recomendación, comparado con haberlo puesto en el S&P 500.

- Supuesto: igual monto en cada idea, al precio de entrada, sin comisiones.
- Barras azules (real) contra ámbar (hold): la distancia entre ambas es el efecto del stop.

## 5 · Semana a semana
tipo: semanal
titulo: Semana a semana
idea: El promedio de las posiciones, viernes a viernes, contra el S&P 500.

- La composición cambia: cada semana se suma la recomendación nueva.
- Señalar dónde se separa del S&P 500.

## 6 · El contexto
tipo: contexto
bloque: Empresas · IA y energía
tiempo: 2:30
titulo: Un período difícil
idea: Cuatro fuerzas que movieron al mercado entre julio y octubre, y que explican cómo se agrupan las empresas.
punto: Guerra en Medio Oriente: el petróleo subió con fuerza y encareció el combustible.
punto: Tasas: la Reserva Federal dejó de bajarlas y el mercado empezó a esperar subas.
punto: Oro: cayó desde su récord de enero, arrastrando a las mineras.
punto: Inteligencia artificial: varias olas de dudas sobre la inversión golpearon a las empresas ligadas a ella.

- Este contexto explica buena parte de lo que se ve en las empresas.
- El 22 de octubre fue un día de caída general que sacó a varias posiciones a la vez.

## 7 · IA y energía
tipo: empresas
tickers: VRT, GEV, MTZ
titulo: El boom de la IA y la energía
idea: Centros de datos, generación eléctrica e infraestructura: tres apuestas al mismo tema.

- Las tres dependen de la inversión en inteligencia artificial y en la red eléctrica que la alimenta.
- Leer la frase de cada tarjeta; abrir el detalle de MTZ para mostrar la ✕ del stop.
- Dato para remarcar en cada una: la diferencia entre el resultado real y el hold.

## 8 · Aeroespacial y defensa
tipo: empresas
tickers: RTX, ATI, CRS, PH, AER
bloque: Empresas · aeroespacial
tiempo: 2:30
titulo: Aeroespacial y defensa
idea: Cinco de las doce ideas apuntaron a la misma cadena: aviones, motores y sus materiales.

- Fabricantes de motores y sistemas (RTX, PH), de aleaciones (ATI, CRS) y de alquiler de aviones (AER).
- Abrir el detalle de una (CRS o ATI).
- AER es una de las dos que siguen abiertas.

## 9 · Fuera del eje
tipo: empresas
tickers: FTI, AU, CASY, AAPL
bloque: Empresas · otros sectores
tiempo: 2:30
titulo: Fuera del eje
idea: Petróleo, oro, consumo y tecnología: las ideas que no siguieron un tema común.

- FTI es el único caso en que el stop empeoró el resultado: vendió y la acción se recuperó.
- AU siguió al oro; AAPL es la otra posición abierta.
- Pasar a la diapositiva siguiente para los tres casos que resumen el seguimiento.

## 10 · Tres casos
tipo: casos
titulo: Tres casos que lo resumen
idea: La nota más alta, la que funcionó y la única en la que el stop jugó en contra.
caso: AU | La única nota 10/10 fue de las peores: el oro cayó con las tasas.
caso: AER | La que funcionó: récord de resultados y aviones escasos.
caso: FTI | El stop la sacó en una caída general; después quedó cerca del nivel.

- Abrir el detalle de AU y de AER si hay tiempo.

## 11 · Qué hizo el stop
tipo: stop
bloque: Foto técnica y cierre
tiempo: 3:00
titulo: Qué hizo el stop
idea: Diferencia entre el resultado con reglas y sin reglas, acción por acción.

- Verde: el stop evitó una pérdida mayor. Rojo: el stop perjudicó.

## 12 · La foto técnica
tipo: tecnico
titulo: Cómo estaba cada acción al ser recomendada
idea: Precio y medias de 20, 50 y 200 ruedas de los seis meses previos, con los valores del día anterior a la idea.

- Mostrar los datos sin imponer una lectura; señalar dos o tres que contrasten entre sí.
- El análisis técnico no se reduce a una regla: los datos están para que cada uno los mire.

## 13 · Cierre
tipo: cierre
titulo: Conclusiones
idea: Qué nos deja el seguimiento.
punto: La inteligencia artificial no acertó en este período: pocas recomendaciones terminaron en positivo y casi ninguna superó al mercado.
punto: La disciplina del stop limitó el daño: sin él, la pérdida habría sido mucho mayor.
punto: Las noticias pesan más que la predicción: la guerra, las tasas y las dudas sobre la IA cambiaron el rumbo de las acciones, más allá de lo que anticipaba el modelo.
punto: Es un trimestre con un contexto muy particular y una muestra acotada: describe lo que pasó, no predice lo que vendrá.

- Invitar a explorar la web completa y descargar el Excel.
- Abrir preguntas.

## Frases
MTZ: El stop evitó una caída de la mitad del valor.
FTI: Resistió meses dentro de sus bandas hasta la caída general del 22/10.
VRT: Cayó al facturar menos de lo esperado, en plena duda sobre la IA.
CRS: Resultados récord que no alcanzaron; sin el stop, la peor de todas.
CASY: Ganancias en alza, pero no subió su pronóstico y el mercado la castigó.
GEV: Buenos resultados, golpeada por las dudas sobre la inversión en IA.
RTX: Problemas de motores y petróleo caro para las aerolíneas.
ATI: Cayó junto a Carpenter por dudas sobre inventarios aeroespaciales.
AER: Aviones escasos y resultados récord: la que mejor funcionó.
AU: La nota máxima; el oro cayó y la minera más.
AAPL: Estable, con nuevo CEO y resultados por delante.
PH: Dudas sobre su valuación; tocó el stop en la caída del 22/10.
