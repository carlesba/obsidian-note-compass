# Note Compass

[English](README.md) · **Español** · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

Este manual es una traducción automática; la referencia es el README en inglés.

Note Compass ofrece selectores para navegar, editar propiedades, rellenar formularios y ejecutar tus propios comandos de tareas.

![El selector Establecer propiedades, con Guardar y cerrar y Cancelar arriba, los valores actuales de la nota marcados con una marca de verificación y más valores para añadir debajo](docs/images/set-properties.png)

## Instalación

Cuando Note Compass aparezca en el catálogo de complementos comunitarios, abre Ajustes → Complementos comunitarios → Buscar, busca "Note Compass", instálalo y actívalo.

Para instalarlo a mano, descarga `main.js`, `manifest.json` y `styles.css` de la última versión publicada en GitHub:

https://github.com/carlesba/obsidian-note-compass/releases/latest

Coloca los tres archivos en `<vault>/.obsidian/plugins/note-compass/`, recarga Obsidian y activa Note Compass en Ajustes → Complementos comunitarios.

Note Compass necesita Obsidian 1.13.0 o posterior y funciona tanto en escritorio como en móvil.

## Primeros pasos

Los comandos están pensados para usarse con el teclado, así que lo primero es asignar un atajo a cada uno. Abre Ajustes → Atajos de teclado, busca "Note Compass" y asigna teclas a "Ir a una nota", "Establecer propiedades" y "Rellenar formulario". También puedes ejecutarlos desde la paleta de comandos.

Un uso típico sería este. Abres la nota diaria de hoy y pulsas el atajo de "Ir a una nota" para pasar a la nota de ayer o a una nota que enlazaste desde ella. En una nota en la que estás trabajando, pulsas el atajo de "Establecer propiedades", escribes unas letras del nombre de una persona, la eliges y pulsas "Guardar y cerrar". Para las notas que creas a menudo, como las personas, añade un formulario en Ajustes → Note Compass → Formularios.

La configuración predeterminada incluye las cuatro listas de relación en "Ir a una nota" y un conjunto de propiedades habituales de casilla de verificación y de enlace en "Establecer propiedades". Abre Ajustes → Note Compass para desactivar lo que no uses y para apuntar las propiedades de enlace a tus propias carpetas y notas.

Añade un comando en Ajustes → Note Compass → Comandos de tareas, abre una nota con tareas pendientes y ejecuta "Procesar tareas abiertas". Intro prepara la finalización y "Terminar" guarda.

## Ir a una nota

"Ir a una nota" abre un selector con notas a las que moverte. Al elegir una fila, la nota se abre en la pestaña activa, o en una pestaña nueva si no hay ninguna abierta.

![El selector Ir a una nota sobre una nota diaria, con filas para el día anterior, un enlace entrante y notas del mismo día](docs/images/jump-to-note.png)

El selector muestra las listas que configures en "Ir a una nota" dentro de los ajustes, en el orden que elijas. Cuatro de las listas disponibles dependen de la nota Markdown activa, y se omiten cuando el foco está en otra cosa o no hay ninguna pestaña abierta:

- Fechas adyacentes muestra la nota anterior y la siguiente del mismo periodo cuando la nota activa es una nota de fecha, como en `📅 day 2024-03-06 (día siguiente - miércoles)` o `📅 day 2024-W09 (semana anterior - semana 9)`.
- Enlaces salientes muestra las notas a las que enlaza la nota activa, incluidos los enlaces en propiedades.
- Enlaces entrantes muestra las notas que enlazan a la nota activa.
- Mismo día muestra las notas creadas el mismo día que la nota activa. Para una nota diaria usa la fecha de su nombre en lugar de la fecha en que se creó el archivo.

Las demás listas no dependen de la nota activa:

- Filtro muestra las notas que cumplen un conjunto de condiciones, como `status es active`, las notas con la etiqueta `#project` o las notas de `work` modificadas en la última semana. Las condiciones se pueden agrupar, como se explica en "Páginas de lista".
- Enlaza a una nota muestra las notas que enlazan a una nota elegida, en su texto o en una propiedad.
- En una carpeta muestra las notas de una carpeta y sus subcarpetas.
- Modificadas hoy muestra las notas cambiadas desde medianoche.
- Notas de fecha actuales muestra las notas de fecha de hoy, esta semana, este mes, este trimestre y este año, cada una de las que actives. Mantienen ese orden en lugar de ordenarse por nombre, y cada fila indica de qué periodo se trata, como `esta semana - semana 10`. Una nota que todavía no existe aparece como `crear la nota de esta semana`, y al elegirla se crea y se abre como lo haría tu complemento de notas de fecha, con la misma plantilla: Periodic Notes, o el complemento principal Notas diarias para los días. Los periodos que vienen de los formatos personalizados empiezan como una nota vacía. Una propiedad de enlace con este origen solo ofrece las notas que existen.

Una nota aparece en cada lista que la contiene, en el orden de tus listas, y la nota activa se omite. Dentro de cada lista, las notas se ordenan por nombre. Si ninguna lista tiene notas, el comando muestra "No hay notas a las que ir." en lugar de abrir un selector vacío.

Cada fila empieza con el prefijo de su lista, que se muestra como un pequeño chip para que se distinga del nombre. Todos los chips de un selector comparten el ancho del más ancho, hasta unos doce caracteres, para que los nombres queden alineados, y una lista con color de prefijo tiñe sus chips. Una nota de fecha añade su periodo después del nombre: el día de la semana para una nota diaria, `semana N` para una nota semanal, `mes - <mes>` para una nota mensual y `año` para una nota anual.

Para editar las propiedades de una nota sin abrirla, pulsa ⌥↵ (Alt+Intro) sobre su fila, o toca el icono de controles deslizantes al final de la fila, que aparece en la fila resaltada en escritorio y en todas las filas en el teléfono. Cualquiera de las dos opciones abre "Establecer propiedades" para esa nota en lugar de para la nota activa. Las filas que crearían una nota de fecha que falta no tienen icono. Escape o `🛑 Cancelar` en ese "Establecer propiedades" te devuelve a la lista de notas con lo que habías escrito, mientras que `🏁 Guardar y cerrar` cierra ambos.

Al escribir, las filas se filtran por coincidencia en orden. Una fila se mantiene cuando los caracteres que escribiste aparecen en ella en el mismo orden, sin distinguir mayúsculas y con cualquier cosa entre medias. El prefijo forma parte de la fila, así que escribir parte de un prefijo reduce el selector a esa lista.

### Notas de fecha

Una nota es una nota de fecha cuando está directamente en la carpeta configurada para su periodo y su nombre coincide exactamente con el formato de ese periodo. Hay cinco periodos, día, semana, mes, trimestre y año, y cada uno tiene su propia carpeta, su formato y su interruptor.

El ajuste "Leer de", dentro de "Notas de fecha", elige de dónde salen esos formatos. "Automático" usa el complemento Periodic Notes cuando está activado, después el complemento principal Notas diarias y, por último, los formatos personalizados del propio complemento. Notas diarias solo cubre los días, así que los demás periodos vienen de Personalizado. Siempre que un periodo viene de Personalizado, un lápiz junto a "Leer de" abre sus formatos, donde configuras la carpeta de cada periodo y su formato como formato de Moment:

https://momentjs.com/docs/#/displaying/format/

De forma predeterminada todos los periodos están en `on/`, como `2024-03-05`, `2024-W10`, `2024-03` y `2024`, y los trimestres, como `2024-Q1`, están desactivados.

## Establecer propiedades

"Establecer propiedades" edita las propiedades de la nota Markdown activa desde un único selector. Solo aparece en la paleta de comandos cuando hay una nota Markdown activa.

No se escribe nada mientras trabajas en el selector. Las dos primeras filas son siempre `🏁 Guardar y cerrar`, que escribe solo las propiedades que cambiaste, y `🛑 Cancelar`, que descarta todos los cambios. Escape hace lo mismo que Cancelar. ⌘↵, o Ctrl+Intro en Windows y Linux, guarda lo que lleves hasta ese momento y cierra el selector desde cualquier punto, incluido el selector propio de una propiedad.

A continuación aparecen los valores con los que se guardará la nota, cada uno marcado con `✓`: una fila por cada nota enlazada y una fila por cada casilla, texto, número o fecha, con su valor al lado. Un valor que cambiaste en esta sesión se marca además con `•`. Elegir un enlace ya establecido lo quita, de modo que una propiedad de enlaces pierde esa nota. Elegir un texto, número o fecha ya establecido abre su propio selector, y una casilla ya establecida hace lo que indique el ajuste "Comportamiento de las casillas".

Debajo de los valores establecidos, cada propiedad activada ofrece lo que puede añadir, en el orden de tus ajustes:

- Una propiedad de enlace o de enlaces muestra las notas de su origen que todavía no están establecidas, primero las modificadas más recientemente. Elegir una la añade a una propiedad de enlaces, o sustituye la nota que tiene una propiedad de enlace. Los enlaces se guardan como una lista, como `["[[Alice]]", "[[Bob]]"]`, y se conservan los enlaces que la propiedad ya tiene aunque su origen no los ofrezca.
- Una propiedad de texto, número, fecha o fecha y hora que no está establecida muestra una fila con su nombre, que abre su propio selector. Los valores que ya existen en la bóveda se ofrecen allí, no aquí.
- Una propiedad de texto o de número muestra también aquí los valores predefinidos que tienen activado el interruptor del menú principal, para fijar el valor con una sola elección.
- Una propiedad de texto ofrece además `✏️ <propiedad>: usar "<lo que escribiste>"` cuando escribes algo que no es uno de esos valores predefinidos.
- Una casilla que no está establecida muestra una fila con su nombre. De forma predeterminada abre su propio selector. Con "Alternar entre true y sin valor", elegirla la pone en `true`, y elegirla de nuevo mientras vale `true` la borra. Con "Recorrer true, false y sin valor", cada elección la avanza un paso: de sin valor a `true`, luego a `false` y de nuevo a sin valor.

Sin nada escrito, cada propiedad muestra como máximo cinco valores, seguidos de `… N más, escribe para filtrar`, que escribe por ti el prefijo de la propiedad. En cuanto escribes, se muestran todas las filas que coinciden. Después de elegir un valor, el selector se vuelve a abrir con el filtro vacío, de modo que `🏁 Guardar y cerrar` vuelve a estar arriba y el valor que acabas de elegir aparece debajo como establecido.

![Establecer propiedades después de escribir "joan": Joan Puig ya está establecido y marcado como cambiado, y la propiedad status ofrece usar "joan" como valor nuevo](docs/images/set-properties-search.png)

Una fila en modo "Varias propiedades" escribe varias propiedades con una sola elección, como `status: done`, `archived: true` y sin `active`. Sus valores se fijan en su página de propiedad, así que el selector nunca los pregunta. La fila es una sola opción del selector, con su "Nombre" o, si está vacío, un resumen de sus valores como `status done, archived ✓, active borrada`, con cada propiedad en el color normal y su valor atenuado. Mientras la nota no tiene todos esos valores, la fila aparece entre los valores para añadir, y elegirla los aplica todos a la vez y vuelve a abrir el selector con el filtro vacío. Cuando la nota ya los tiene todos, la fila aparece entre los valores establecidos marcada con `✓`, y con `•` si no los tenía al abrir el selector, y elegirla no cambia nada. Un valor de enlaces añade su nota y conserva los demás enlaces, un valor de enlace sustituye la nota y un valor borrado quita la propiedad. Hoy y Ahora se calculan al abrir el selector. La fila es todo o nada: solo cuenta como establecida cuando se cumplen todos sus valores, y no se escribe nada hasta que guardas.

El selector propio de una propiedad marca su valor actual con `✓` y termina con `🗑️ Borrar`, que quita la propiedad, o la deja vacía si "Quitar cuando esté vacía" está desactivado. Escape vuelve al selector principal sin cambiar esa propiedad, y los cambios que ya hiciste allí se conservan.

- Una casilla ofrece `true` y `false`.
- Un texto ofrece `✏️ Usar "<lo que escribiste>"` para un valor nuevo, luego sus valores predefinidos y después los demás valores que la propiedad ya tiene en la bóveda, primero los más usados, con cuántas veces se usa cada uno.
- Un número ofrece `✏️ Usar "<lo que escribiste>"` para un número, luego sus valores predefinidos y después los demás números que la propiedad ya tiene en la bóveda, primero los más usados.
- Una fecha ofrece "Usar" para una fecha escrita como `YYYYMMDD` o `YYYY-MM-DD`, luego Hoy, Mañana, El próximo lunes y En una semana, y se guarda como `YYYY-MM-DD`.
- Una fecha y hora ofrece "Usar" para `YYYYMMDDHHmm`, `YYYYMMDD HHmm`, `YYYY-MM-DD HH:mm` o `YYYY-MM-DDTHH:mm`, luego Ahora, y se guarda como `YYYY-MM-DDTHH:mm`.

![El selector de valores de una propiedad de fecha, con Hoy, Mañana, El próximo lunes, En una semana y Borrar](docs/images/set-properties-date.png)

Las propiedades de enlace nunca ofrecen la nota activa ni las notas de las carpetas excluidas de la propiedad. Para ocultar notas como las archivadas, usa un origen de filtro con un grupo "Ninguno de los siguientes son verdaderos" que contenga `archived es verdadero`. El selector solo enlaza notas que ya existen, así que para enlazar una nota nueva, créala primero con un formulario.

## Formularios

Un formulario crea una nota nueva a partir de unas pocas preguntas, como una entrada de un registro de lectura que pregunta por el libro y su autor, o una nota de reunión que pregunta por el tema y las personas. Los formularios se definen en Ajustes → Note Compass → Formularios. "Rellenar formulario" lista tus formularios activados y ejecuta el que elijas, y cada formulario activado es además un comando propio, con el nombre del formulario, para que puedas asignarle un atajo. Como los demás comandos, funciona con o sin una nota activa. Si no hay formularios, "Rellenar formulario" muestra "Aún no hay formularios. Añade uno en Ajustes → Note Compass → Formularios."

Un formulario hace una pregunta por cada campo preguntado, en el orden de su lista "Campos". Escape vuelve a la pregunta anterior, y Escape en la primera pregunta cierra el formulario sin crear ninguna nota. Las respuestas que ya diste se conservan al volver atrás y se muestran con una marca de verificación.

Tras la última pregunta se abre un resumen. Su primera fila es `✅ Crear "<nombre>"`, con el nombre de la nota calculado a partir de tus respuestas; después hay una fila por campo con el valor que recibirá, u `omitido`, y al final `🛑 Cancelar`. Al elegir un campo preguntado se vuelve a abrir su pregunta y, cuando la respondes, se vuelve al resumen. Escape en el resumen vuelve a la última pregunta, o cierra el formulario si no hace ninguna pregunta. ⌘↵, o Ctrl+Intro en Windows y Linux, crea la nota desde cualquier pregunta en cuanto todas las preguntas obligatorias tienen respuesta.

La nota va a la "Carpeta" del formulario o, si está vacía, adonde Obsidian coloca las notas nuevas. Si ya existe allí una nota con ese nombre, sin distinguir mayúsculas, la nueva recibe un número, como en `Dune 2`. Primero se escribe el texto de la nota y después sus propiedades, en el orden de los campos. Luego Note Compass indica dónde se creó la nota, como en `Se creó "Dune" en reading.`, y la abre salvo que "Abrir la nota después de crearla" esté desactivado.

### Páginas de formulario

La página de un formulario tiene:

- "Activado", que ofrece el formulario en "Rellenar formulario" y como comando.
- "Nombre", que se muestra en "Rellenar formulario" y como nombre del comando.
- "Nombre de la nota", el patrón del nombre de la nota nueva, como `{{date:YYMMDDHHmm}} {{book}}`. Los espacios repetidos por un marcador vacío se reducen a uno, y un nombre que queda vacío o con caracteres que Obsidian no puede usar en un nombre de archivo se rechaza con un mensaje, y te quedas en el resumen.
- "Contenido de la nota", el texto de la nota nueva, con los mismos marcadores.
- "Carpeta", adonde van las notas nuevas.
- "Abrir la nota después de crearla", activado de forma predeterminada.
- "Campos", los valores que el formulario rellena o pregunta. Su orden es el orden de las preguntas.

La lista de campos funciona como las demás listas de los ajustes: arrastra el asa para reordenar, el icono de copiar duplica un campo justo debajo, la cruz elimina un campo y el `+` de la cabecera añade uno. El `+` abre un menú: "Campo vacío" añade un campo de texto preguntado vacío, mientras que "Fecha", "Hora", "Marca de tiempo" y "Marca de tiempo ISO" añaden un campo fijo que toma su valor al crear la nota, con la clave `date`, `time`, `timestamp` o `iso-timestamp` y el formato `YYYY-MM-DD`, `HH:mm`, `YYYY-MM-DDTHH:mm` o ISO 8601. Cada elemento muestra lo que escribiría en este momento, y una clave que ya está en uso recibe un número, como en `timestamp-2`. "Hora de la entrada (confirmar o cambiar)" añade una variable preguntada de fecha y hora llamada `entry-time` con "Usar como hora de la entrada" activado.

Un campo preguntado de fecha, hora o fecha y hora con "Usar como hora de la entrada" funciona como una confirmación. Su pregunta muestra la hora en que empezó el formulario como marcador de posición, como `¿Cuándo? · 202810300900`, y su primera fila es "Mantener", así que Intro acepta esa hora. Escribe otra, como `202810300900` o `0930` para hoy a las 09:30, para cambiarla. La respuesta sustituye entonces la hora del formulario en todos los sitios donde se usa: `{{date}}` y `{{time}}` en el nombre y el contenido, y todos los campos fijos con "Al crear". Solo un campo de un formulario puede ser la hora de la entrada, y un segundo muestra un aviso. Cada fila muestra la clave del campo, seguida de pequeñas insignias que indican dónde se guarda, su modo y su tipo, como en `book` `variable` `preguntar` `texto`. Las insignias de propiedad son azules y las de variable son moradas. Haz clic en la fila o en su flecha para editar el campo justo debajo, y vuelve a hacer clic para cerrarlo. Solo hay un campo abierto a la vez, y un campo nuevo se abre directamente.

El nombre y el contenido entienden estos marcadores:

- `{{date}}` y `{{time}}` son el momento en que empezó el formulario, con los formatos configurados en el complemento principal Plantillas. `{{date:FORMAT}}` y `{{time:FORMAT}}` usan el formato indicado.
- `{{key}}` es el valor del campo llamado `key`. Las listas se unen con comas, y un campo omitido queda vacío.
- `{{key:FORMAT}}` da formato a un campo de fecha u hora con el formato indicado, como `{{started:dddd}}`.
- `{{title}}`, solo en el contenido, es el nombre de la nota nueva.

Cualquier otro marcador se deja tal cual.

### Campos

Cada campo tiene "Guardar como" y después "Clave", "Modo" y "Tipo". "Guardar como" es "Propiedad", el valor predeterminado, para escribir el valor en las propiedades de la nota nueva con su clave, o "Variable" para un valor que solo rellena marcadores en el nombre y el contenido y nunca se escribe. "Clave" es el nombre de la propiedad o de la variable, que se usa como `{{key}}` en ambos casos. "Modo" es "Fijo" para un valor que se rellena solo o "Preguntar" para una pregunta.

Un campo fijo puede ser texto, número, casilla de verificación, lista, fecha, hora o fecha y hora. Un número solo admite números, y una casilla tiene un interruptor. Una lista tiene un cuadro donde cada elemento aparece como un chip: escribe un elemento y pulsa Intro para añadirlo, y usa su × para quitarlo. Los elementos pueden ser enlaces, así que `[[Books]]` y `[[Reading]]` escriben `categories: ["[[Books]]", "[[Reading]]"]`, que es como un formulario enlaza sus notas con otras notas. En un valor de texto fijo o en el cuadro de la lista, escribir `[[` sugiere las notas de la bóveda, y elegir una escribe su enlace, como `[[Books]]`, con la carpeta solo cuando dos notas comparten el nombre. En el cuadro de la lista, el enlace elegido se convierte en un chip al momento.

Un campo preguntado puede ser texto, número, casilla de verificación, selección, selección múltiple, fecha, hora o fecha y hora. "Pregunta" es el texto que se muestra, y la clave del campo si está vacía. "Opcional" pone `⏭️ Omitir` en primer lugar en la pregunta; una propiedad omitida no se escribe en absoluto, y una variable omitida queda vacía. Una pregunta de texto o número acepta cualquier cosa que escribas, y una propiedad de texto o número ofrece además los valores que la propiedad ya tiene en la bóveda.

Selección y selección múltiple tienen "Opciones", cada una con un valor y una etiqueta opcional. El `+` de la cabecera de "Opciones" añade una, la cruz quita una, y arrastrar el asa de una opción la reordena. La pregunta muestra la etiqueta, o el valor si no la tiene, y la nota recibe el valor. Una pregunta de selección múltiple te deja elegir varias opciones, que se marcan con una marca de verificación, y terminar con `🏁 Listo`. "Guardar valores como" escribe los valores como texto o como números, así que una opción con el valor `4` y la etiqueta `4 · Genial` puede escribir el número 4.

Los campos de fecha, hora y fecha y hora tienen "Formato": `YYYY-MM-DD`, `HH:mm`, `YYYY-MM-DDTHH:mm`, ISO 8601 o un formato personalizado de Moment.js. Uno fijo toma su "Valor" de "Al crear", el momento en que empezó el formulario, de "En una fecha fija", una fecha que escribes debajo, o de "Del campo …", el valor de otro campo de fecha u hora del formulario. Una fecha fija se escribe con dígitos, `YYYYMMDD` para una fecha, `HHmm` para una hora y `YYYYMMDDHHmm` para una fecha y hora, o con guiones y dos puntos, y la línea de debajo muestra cómo se ha leído, como `✓ Mon 30 Oct 2028, 09:00`. Así, una sola hora preguntada puede alimentar varias propiedades, como un `day` con `YYYY-MM-DD` y un `timestamp` con ISO 8601. Si se omite el campo del que viene, también se omite. Uno preguntado ofrece "Ahora", y una fecha ofrece además "Hoy", "Mañana", "El próximo lunes" y "En una semana". También puedes escribir `20240311`, `2024-03-11`, `0930`, `09:30`, `202403110930` o `20240311 0930`, como en los selectores de fecha de "Establecer propiedades". Una hora es esa hora de hoy.

Un campo sin clave, dos campos con la misma clave, una selección sin opciones o una fecha tomada de un campo que no es una fecha muestran un aviso en la fila del campo y en el formulario. Un formulario que esta versión de Note Compass no puede leer se queda en la lista desactivado, con un aviso y sin lápiz, como una lista ilegible, y su configuración guardada se conserva hasta que lo eliminas.

## Comandos de tareas

Procesa las tareas de la nota Markdown activa con comandos de la paleta que defines tú.

### Primeros pasos

Añade un comando con `+` en Ajustes → Note Compass → Comandos de tareas y dale un nombre. Abre una nota Markdown y ejecuta ese nombre desde la paleta de comandos; también puedes asignarle un atajo. Solo se ofrecen comandos activados con al menos una acción. Si ninguna tarea coincide, aparece un aviso en vez de un selector vacío.

### Página del comando

| Ajuste | Qué hace |
| --- | --- |
| Activado | Ofrecer este comando de tareas como su propio comando. |
| Nombre | Se muestra como nombre del comando en la paleta de comandos. |
| Tareas que listar | Déjalo vacío para listar todas las tareas. |
| Tareas que omitir | Se omiten aunque estén listadas. Déjalo vacío para no omitir ninguna. |
| Seleccionar todas | Añade una primera fila que aplica una acción a todas las tareas listadas. |
| Modo por lotes | Prepara las acciones sin guardar hasta que termines o no queden tareas. Cancelar o Escape descarta todos los cambios pendientes. |
| Intro ejecuta | Elige qué hace Intro en una tarea. Abre el menú de acciones con el botón de ajustes o Alt+Intro. Una acción o "Mostrar el menú de acciones". |

"Añadir estado" ofrece Pendiente `[ ]`, Completada `[x]`, Cancelada `[-]`, Migrada `[>]`, Programada `[<]`, En curso `[/]` y "Personalizado…". Para uno personalizado, escribe un carácter y pulsa Intro. La × de una píldora lo elimina. Se distinguen mayúsculas y minúsculas; las exclusiones tienen prioridad.

Las filas de Formularios y Comandos de tareas muestran solo el nombre; la segunda línea aparece únicamente para avisos, no para un resumen de la configuración.
Un comando ilegible se conserva desactivado con un aviso hasta que lo eliminas.

### Acciones

Cada acción tiene "Etiqueta", un tipo de "Acción" y un "Estado" de un carácter. Usa `+` para añadirla, arrastra para reordenar, copia para duplicar y × para eliminar; haz clic en una fila para editarla debajo.

#### Cambiar estado

Cambia el carácter de la casilla original. "Fecha de finalización" puede añadir un sufijo:

| Fecha de finalización | Texto añadido |
| --- | --- |
| Desactivada | Nada. |
| Fecha | ` ✅ 2028-10-30` |
| Fecha como enlace | ` ✅ [[2028-10-30]]` |
| Fecha y hora | ` ✅ 2028-10-30 09:00` |

Los ejemplos usan el formato diario de "Notas de fecha"; la fecha es hoy, no la de la nota original. La fecha y hora añade el formato de hora del complemento principal Plantillas. Un enlace de fecha no crea su nota.

#### Copiar a una nota

Añade una tarea abierta `[ ]` al final de otra nota y cambia "Estado" en la original. Solo copia la línea de la tarea, no las subtareas ni las líneas de continuación; no copia la sangría ni los prefijos de cita.

- "Destinos" es una lista ordenada: añade con `+`, arrastra para reordenar y elimina con ×. Opciones: Hoy, Mañana, Esta semana, La semana que viene, Este mes, El mes que viene, Este trimestre, El trimestre que viene, Este año, El año que viene, Nota concreta.
- "Enlazar el destino" añade ` → [[destino]]` a la original; "Enlazar el origen" añade ` ← [[origen]]` a la copia.
- Los periodos se cuentan desde hoy, no desde la fecha de la nota, y usan los periodos activados, carpetas y formatos de "Notas de fecha". Un destino disponible se ejecuta directamente; varios abren "¿A qué nota copiar?" en el orden configurado. Nunca se ofrece la nota original ni destinos duplicados.
- Las notas concretas inexistentes se omiten con un aviso. Si no queda ningún destino, no cambia nada.
- Las notas periódicas que faltan se crean al guardar. Si "Notas de fecha" usa Periodic Notes, primero se pide a ese complemento que cree la nota con su plantilla. Si su API no está disponible, falla o no crea la ruta esperada, se crea una nota vacía. Los demás orígenes, incluidas Notas diarias y Personalizado, empiezan vacíos antes de añadir la tarea.

### Selector y modo por lotes

- Escribe para filtrar el texto de las tareas, sin distinguir mayúsculas y con coincidencia en orden. Intro ejecuta "Intro ejecuta", o abre el menú; ⚙ o Alt+Intro abre todas las acciones, incluida la de Intro.
- "Seleccionar todas" añade "Aplicar a las N tareas" cuando coinciden más de una con la búsqueda. Solo aplica a esas tareas, no a toda la nota.
- Con "Modo por lotes" activado, cada elección queda pendiente y el selector vuelve a abrirse con las tareas restantes y la búsqueda vacía. "Terminar · N cambios" guarda todo. "Cancelar" o Escape en el selector de tareas descarta todo. Escape en el selector de acciones o destinos solo vuelve atrás y conserva los cambios pendientes.
- Procesar la última tarea termina automáticamente. Elegir "Aplicar a las N tareas" también termina de inmediato, aunque la búsqueda oculte otras tareas.
- Sin "Modo por lotes", una elección se guarda de inmediato y cierra el selector; Escape no la deshace. En ambos modos, las líneas originales modificadas desde que se abrió el selector se omiten con un aviso.

### Valores de un comando nuevo

Cada comando nuevo empieza con una configuración Bullet Journal llamada "Procesar tareas abiertas": activado, solo tareas Pendiente `[ ]`, sin exclusiones, "Seleccionar todas" desactivado y "Modo por lotes" activado. Intro ejecuta "Completar".

| Acción | Estado original | Otros ajustes |
| --- | --- |
| Completar | `[x]` | Fecha de finalización Desactivada. |
| Cancelar | `[-]` | Fecha de finalización Desactivada. |
| Migrar | `[>]` | Mañana, Esta semana, La semana que viene; Solo enlaza el destino. |
| Programar | `[<]` | El mes que viene, El trimestre que viene, El año que viene; Enlaza destino y origen. |

### Comportamiento conocido
- Las escrituras en varias notas no son atómicas: un fallo puede dejar algunas actualizadas y otras sin cambiar.
- La copia conserva el texto de la línea, incluidos sufijos existentes e identificadores de bloque; estos se duplican, no se regeneran.

## Ajustes

Los ajustes caben en una ventana estrecha y funcionan igual en móvil. Se dividen en seis partes: "Visualización", las listas de "Ir a una nota", "Notas de fecha", la lista de "Establecer propiedades", "Formularios" y "Comandos de tareas", seguidas de "Restablecer todos los ajustes".

![La pestaña de ajustes, con las listas de Ir a una nota, el origen de las notas de fecha y la lista de Establecer propiedades, cada fila con un chip de prefijo, un interruptor, un lápiz y un botón de eliminar](docs/images/settings.png)

### Comandos de tareas

Usa los mismos controles para añadir, reordenar, activar, editar, duplicar y eliminar. La página de un comando contiene Comando, Tareas que listar, Tareas que omitir, Opciones y Acciones. No hay comandos de tareas hasta que añades uno; los nuevos empiezan con acciones Bullet Journal.

Las filas de Formularios y Comandos de tareas muestran solo el nombre; la segunda línea aparece únicamente para avisos, no para un resumen de la configuración.

### Visualización

"Mostrar prefijos" está activado de forma predeterminada. Al desactivarlo se quita el prefijo de todas las filas de los tres selectores y deja de contar para la coincidencia al escribir. Las filas de enlace de "Establecer propiedades" muestran entonces la propiedad que escriben, como en `✓ Marta Vidal · people`. Los ajustes también ocultan los chips y los campos de prefijo, pero tus prefijos y colores siguen guardados, así que al volver a activar el ajuste se recuperan.

### Listas y propiedades

"Ir a una nota" y "Establecer propiedades" son listas de filas, y sus filas funcionan igual. Cada fila muestra su chip de prefijo y lo que muestra o escribe, como `status es active` o `people · enlaces`.

- Arrastra el asa de la izquierda para reordenar las filas. El orden es el del selector.
- Usa el interruptor para mostrar u ocultar una fila en el selector sin perder su configuración.
- Usa el lápiz para abrir la página de la fila y la cruz para eliminarla.
- Usa el icono de copiar para duplicar una fila. La copia aparece justo debajo con la misma configuración, y la copia de un formulario se llama `<nombre> copia`.
- Usa el `+` de la cabecera de la sección para añadir una fila. Su página se abre al momento para que la completes, y la fila nueva empieza activada.

Una fila que esta versión de Note Compass no puede leer, por ejemplo una guardada por una versión más reciente, se queda en la lista con un aviso: "Esta versión de Note Compass no puede leer esta lista. Elimínala y crea una nueva." Su interruptor está desactivado y deshabilitado y no tiene lápiz, así que nunca añade notas a un selector, pero su configuración guardada se conserva tal cual hasta que la elimines.

Haz clic en un chip de prefijo, tócalo, o ponle el foco y pulsa Intro para abrir su menú, que en un teléfono aparece como una hoja desde abajo. El menú muestra cada prefijo en uso en "Ir a una nota" y "Establecer propiedades", cada uno como su chip seguido de cuántas filas lo usan, como un chip `📅 due` con `· 3 filas`, primero los más usados. El prefijo propio de la fila aparece marcado. Elige uno para dar a esta fila su texto y su color, sin cambiar ninguna otra fila. "Editar prefijo…" abre la página de la fila con el cursor en "Prefijo", y "Sin prefijo", que aparece cuando la fila tiene uno, borra su texto y su color. Un prefijo vacío se muestra como un chip `prefijo` atenuado y nunca aparece en el menú.

Dos filas comparten un prefijo cuando su texto y su color son iguales, así que `👤 peop` en rojo y `👤 peop` sin color son dos prefijos distintos.

### Páginas de lista

La página de una lista tiene "Activado" y "Prefijo", y después "Origen", que elige qué contiene la lista: fechas adyacentes, enlaces salientes, enlaces entrantes, mismo día, un filtro, notas que enlazan a una nota, notas de una carpeta, notas modificadas hoy o notas de fecha actuales. Notas de fecha actuales tiene un interruptor por periodo, de "Hoy" a "Este año".

En la página de una lista o de una propiedad, "Prefijo" muestra el botón de ajustes, la vista previa del chip, su texto y su color. Lo que escribes y eliges cambia esta fila y todas las que compartían el prefijo al abrir la página, y la descripción nombra esas filas, como en "Lo usan 2 filas más: people · enlaces, Enlaces salientes". Siguen juntas aunque el texto quede vacío un momento. La flecha circular quita el color.

El botón de ajustes, "Elegir un prefijo", abre el menú de prefijos. Elegir un prefijo da a esta fila su texto y su color sin cambiar ninguna otra fila. "Nuevo prefijo…", que aparece cuando la fila tiene un prefijo, lo vacía, así que lo que escribes y eliges después solo cambia esta fila. "Sin prefijo", que aparece cuando la fila tiene uno, borra su texto y su color.

Un filtro funciona como los filtros de Obsidian Bases y tiene el mismo aspecto. Es un grupo que empieza con "Todos los siguientes son verdaderos", "Cualquiera de los siguientes son verdaderos" o "Ninguno de los siguientes son verdaderos", de modo que una nota aparece cuando cumple todos los filtros del grupo, al menos uno o ninguno. Cada fila de filtro empieza por lo que comprueba: escribe el nombre de una propiedad, o elige `carpeta`, `etiquetas`, `enlaces`, `creado` o `modificado` entre las sugerencias. Después elige el operador y el valor, como `carpeta está en projects`, `etiquetas tiene la etiqueta client` o `modificado después de hace 7 días`. "Añadir filtro" añade una fila al grupo, y "Añadir grupo de filtros" añade dentro un grupo con su propia elección. Los grupos pueden anidarse hasta tres niveles de profundidad, contando el propio filtro. El botón de la papelera de una fila o de un grupo interior lo elimina, y al eliminar la última fila de un grupo interior se elimina también el grupo. Un filtro nuevo no tiene filas y no muestra nada hasta que añadas una, y un grupo vacío dentro de un filtro no cuenta para la coincidencia.

Cada condición empieza eligiendo qué examina:

- Propiedad compara una propiedad con una condición disponible para su tipo, como se describe más abajo.
- Carpeta coincide con las notas de una carpeta y sus subcarpetas con "está en", o con todas las demás notas con "no está en".
- Etiqueta coincide con las notas que tienen una etiqueta en sus propiedades o en su texto. Una etiqueta coincide también con sus subetiquetas, así que `project` coincide con `#project/website`, y no importan ni las mayúsculas ni un `#` inicial. "No tiene la etiqueta" coincide con las notas que no la tienen.
- Enlaza a una nota coincide con las notas que enlazan a una nota elegida, en su texto o en una propiedad, y "no contiene" coincide con las que no la enlazan.
- Creado y Modificado comparan el día en que se creó o se cambió por última vez la nota con una fecha fija o relativa a hoy, usando en, no en, antes de o después de.

La fila de una lista muestra la única condición del filtro, como `status es active` o `Con la etiqueta project`, o cuenta sus condiciones, como en `Cumple las 3 condiciones`.

Las listas guardadas por versiones anteriores como "Notas con una propiedad" se abren como un filtro con esa única condición de propiedad, y muestran las mismas notas que antes.

Una condición de propiedad pide la propiedad, sugiriendo las propiedades de la bóveda con sus tipos, y después una condición disponible para ese tipo:

- Las propiedades de casilla de verificación pueden ser verdaderas, falsas, tener valor o no tenerlo. "Es falso" necesita un `false` explícito.
- Las propiedades de texto pueden ser iguales o distintas de un valor, contenerlo o no contenerlo, tener valor o no tenerlo.
- Las propiedades de lista, etiquetas y alias pueden tener o no tener un elemento igual al valor, tener valor o no tenerlo. Los wikienlaces se comparan por el texto del enlace, así que `[[Project]]` coincide con el valor `Project`.
- Las propiedades de número pueden ser iguales, distintas, menores o mayores que un número, tener valor o no tenerlo.
- Las propiedades de fecha pueden ser en, no en, antes de o después de una fecha fija, hoy, o un número de días atrás o desde hoy, tener valor o no tenerlo. Una fecha relativa se calcula cada vez que se abre el selector.

"No tiene valor" también coincide con una propiedad que se dejó en blanco. Las condiciones negadas, como "no es" o "no contiene", coinciden con todas las notas con las que no coincide la condición positiva, incluidas las notas que no tienen la propiedad.

### Páginas de propiedad

La página de una propiedad tiene "Activado" y el grupo "Etiqueta", con "Prefijo" como en la página de una lista y, en el modo "Varias propiedades", el "Nombre" de la fila. Después viene "Modo", que es "Una propiedad", el predeterminado, o "Varias propiedades". En el modo "Una propiedad" siguen "Propiedad" y "Tipo". "Propiedad" sugiere las propiedades de la bóveda con sus tipos, y al elegir una el tipo se ajusta a ella: casilla de verificación, número, fecha y fecha y hora conservan el suyo, las listas y las etiquetas pasan a enlaces, y cualquier otra cosa pasa a texto. "Tipo" puede ser casilla de verificación, texto, número, fecha, fecha y hora, "enlace, una nota" o "enlaces, varias notas", y permanece deshabilitado hasta que se elige una propiedad.

![La página de la propiedad de enlaces people, que ofrece las notas que enlazan a Person, y excluye la carpeta de plantillas](docs/images/settings-property.png)

Todas las propiedades tienen "Quitar cuando esté vacía", que está activado de forma predeterminada y quita la propiedad de la nota en cuanto borras su valor o quitas su último enlace. Si lo desactivas, la propiedad se queda en la nota con un valor vacío.

Una propiedad de texto o de número tiene además "Valores predefinidos", una lista de valores que su propio selector ofrece primero, como `todo`, `doing` y `done` para una propiedad `status`. El `+` de su cabecera añade una fila con un campo de texto para el valor y un interruptor, las filas se pueden arrastrar al orden en que las muestra el selector, y cada fila se puede eliminar. Una propiedad de número solo guarda los valores escritos como números. Los valores predefinidos son una ayuda, no un límite: después de ellos el selector sigue ofreciendo los demás valores que la propiedad ya tiene en la bóveda, primero los más usados, y cualquier cosa que escribas. El interruptor junto a un valor predefinido también lo muestra en el menú principal de Establecer propiedades, así que puedes tener muchos valores predefinidos y dejar solo los pocos que más usas a una sola elección. Todos los valores predefinidos se ofrecen siempre en el selector propio de la propiedad.

Una propiedad de enlace o de enlaces tiene dos secciones más:

- "Ofrecer notas de" elige las notas que ofrece el selector, con los mismos orígenes que una lista de "Ir a una nota".
- "Carpetas excluidas" enumera las carpetas cuyas notas nunca se ofrecen. El `+` de su cabecera añade una carpeta, cada fila se puede eliminar y una fila vacía no excluye nada.

Una fila en modo "Varias propiedades" escribe varias propiedades a la vez, con valores fijados en su página, y el selector de Establecer propiedades la ofrece como una sola elección. Al volver a "Una propiedad" se recupera la configuración de una sola propiedad, y los valores fijos se quedan guardados para la próxima vez. "Nombre" es lo que el selector muestra para la fila; si está vacío, muestra un resumen de sus valores, que también sirve de marcador de posición del campo. "Valores que se escriben" tiene un bloque por propiedad: el `+` de su cabecera añade uno, y los bloques se pueden arrastrar, duplicar y eliminar. Cada bloque muestra su propiedad y su valor, como `status done`, `archived ✓` o `active borrada`, y al hacer clic en él se abre su editor:

- "Propiedad" es la propiedad que se escribe. Al ponerle el foco lista las propiedades de la bóveda, y al elegir una el tipo se ajusta a ella. También vale un nombre nuevo.
- "Tipo" puede ser casilla de verificación, texto, número, fecha, fecha y hora, "enlace, una nota", "enlaces, varias notas" o "Borrar (quitar la propiedad)".
- "Valor" es un interruptor para una casilla, un texto, un número, Hoy o una fecha fija, Ahora o una fecha y hora fijas, o una nota para enlace y enlaces. Borrar no tiene valor.

Un valor de enlace sustituye la nota que tiene la propiedad, y un valor de enlaces añade su nota a la lista. Un bloque sin propiedad o sin valor se omite.

Varias filas pueden escribir la misma propiedad, como las filas `related` predeterminadas con orígenes distintos. Comparten un mismo valor, y la primera fila activada en modo "Una propiedad" decide su tipo. Una fila te avisa cuando dos filas de una misma propiedad no coinciden en el tipo.

### Comportamiento de las casillas

"Comportamiento de las casillas", debajo de la lista de Establecer propiedades, decide qué ocurre al elegir una propiedad de casilla de verificación en el menú principal de Establecer propiedades, para todas las propiedades de casilla: abrir su propio selector con true, false y Borrar, que es la opción predeterminada, alternar entre true y sin valor, o recorrer true, false y sin valor. Un modo elegido para una sola propiedad en las versiones 0.6.1 o 0.6.2 pasa a ser este ajuste.

### Restablecer todos los ajustes

"Restablecer todos los ajustes", al final de los ajustes, devuelve cada lista, propiedad, formulario y opción a los valores predeterminados, que no incluyen ningún formulario. Primero pide confirmación, y Cancelar o Escape lo deja todo como estaba. El restablecimiento no se puede deshacer.

El restablecimiento también elimina los comandos de tareas; los valores predeterminados no incluyen ninguno.

## Idiomas

Note Compass sigue el idioma que elijas para Obsidian. Está disponible en inglés, español, chino simplificado, chino tradicional, japonés y coreano, y cualquier otro idioma se muestra en inglés. Tus ajustes, los nombres de las propiedades y los valores que se escriben en tus notas se quedan tal como los escribiste, sea cual sea el idioma.

Las traducciones están en `src/i18n/`, y este manual también está disponible en cada uno de esos idiomas desde los enlaces de arriba. Ambos se redactaron por traducción automática, así que algunas expresiones pueden sonar raras, y el manual en inglés es la referencia. Las correcciones son bienvenidas como pull requests. Añadir un idioma requiere un archivo nuevo en esa carpeta y una línea en su registro, y cualquier texto que un idioma todavía no traduzca se muestra en inglés.

## Consejos

- Asigna a los comandos atajos que puedas pulsar sin mirar. El complemento está pensado para abrir un selector, escribir unas letras y pulsar Intro.
- Usa prefijos cortos, como un emoji y una abreviatura de tres o cuatro letras, por ejemplo `👤 peop` o `📅 due`. Todos los chips comparten el ancho del más ancho, así que un solo prefijo largo empuja todos los nombres hacia la derecha.
- Usa colores para agrupar listas relacionadas, como un color para todas tus listas de personas y empresas y otro para las de proyectos, y así distinguirlas de un vistazo.
- Escribe la abreviatura de un prefijo para reducir un selector a una lista, como `peop` para las filas de personas en "Establecer propiedades".
- Usa un origen "Enlaza a una nota" como una etiqueta ligera. Crea una nota como `Person` y apunta la propiedad de personas a "Enlaza a una nota: Person". Pon `[[Person]]` en el contenido del formulario que crea las notas de personas, así cada persona nueva aparece en la lista sin que tengas que etiquetarla a mano.
- Añade tu carpeta de plantillas a "Carpetas excluidas" en todas las propiedades de enlace, para que las notas de plantilla nunca se ofrezcan como valores.
- Desactiva "Mostrar prefijos" para un aspecto minimalista cuando ya conozcas tus listas. Las filas de enlace muestran entonces el nombre de su propiedad.
- En "Establecer propiedades", Escape en un selector de valores solo vuelve al selector principal. Los cambios que ya hiciste se conservan hasta que eliges "Guardar y cerrar" o "Cancelar".
- En un comando de tareas, usa Alt+Intro o ⚙ para ver todas las acciones sin cambiar lo que hace Intro.

## Comportamiento conocido

- Un formato de día que contiene `/`, como `YYYY/MM/DD`, nunca coincide, porque el nombre de una nota se compara sin sus carpetas.
- Con los formatos predeterminados, las notas con el nombre de un año en la carpeta de notas de fecha, como `on/2024`, cuentan como notas anuales. Desactiva el periodo de año en los formatos personalizados si guardas otras notas con ese tipo de nombre en esa carpeta.
- Si una propiedad cambia de tipo, una condición de filtro sobre ella conserva su condición anterior y no coincide con nada hasta que elijas una nueva. La condición, la fila de su lista y su página indican que la condición ya no se aplica.
- Las escrituras en varias notas no son atómicas: un fallo puede dejar algunas actualizadas y otras sin cambiar.
- La copia conserva el texto de la línea, incluidos sufijos existentes e identificadores de bloque; estos se duplican, no se regeneran.

## Desarrollo

```bash
npm ci
npm run dev
npm run build
npm test
npm run lint
```

`npm run dev` recompila con cada cambio, `npm run build` comprueba los tipos y genera el paquete de producción, `npm test` ejecuta las pruebas unitarias y `npm run lint` aplica las mismas reglas de lint de Obsidian que usa la revisión de la comunidad.

Para probar el complemento en una bóveda de prueba, crea un enlace simbólico del repositorio en su carpeta de complementos, de modo que la bóveda cargue siempre la compilación que `npm run dev` acaba de generar:

```bash
ln -s "$PWD" "<vault>/.obsidian/plugins/note-compass"
```

## Licencia

MIT, consulta [LICENSE](LICENSE).
