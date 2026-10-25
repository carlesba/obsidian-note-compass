# Note Compass

[English](README.md) · **Español** · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

Este manual es una traducción automática; la referencia es el README en inglés.

Note Compass añade tres comandos que funcionan desde cualquier parte de Obsidian, con o sin un editor abierto. "Ir a una nota" abre un único selector con las notas relacionadas con la nota activa, como sus notas de fecha adyacentes y las notas a las que enlaza, junto con listas que defines tú mismo con filtros sobre propiedades, carpetas, etiquetas, enlaces y fechas. "Establecer propiedades" edita las propiedades de la nota activa desde un único selector. "Crear nota" crea una nota nueva que ya pertenece a una de tus propiedades de enlace, de modo que los otros dos comandos la ofrecen a partir de ese momento.

![El selector Establecer propiedades, con Guardar y cerrar y Cancelar arriba, los valores actuales de la nota marcados con una marca de verificación y más valores para añadir debajo](docs/images/set-properties.png)

## Instalación

Cuando Note Compass aparezca en el catálogo de complementos comunitarios, abre Ajustes → Complementos comunitarios → Buscar, busca "Note Compass", instálalo y actívalo.

Para instalarlo a mano, descarga `main.js`, `manifest.json` y `styles.css` de la última versión publicada en GitHub:

https://github.com/carlesba/obsidian-note-compass/releases/latest

Coloca los tres archivos en `<vault>/.obsidian/plugins/note-compass/`, recarga Obsidian y activa Note Compass en Ajustes → Complementos comunitarios.

Note Compass necesita Obsidian 1.13.0 o posterior y funciona tanto en escritorio como en móvil.

## Primeros pasos

Los comandos están pensados para usarse con el teclado, así que lo primero es asignar un atajo a cada uno. Abre Ajustes → Atajos de teclado, busca "Note Compass" y asigna teclas a "Ir a una nota", "Establecer propiedades" y "Crear nota". También puedes ejecutarlos desde la paleta de comandos.

Un uso típico sería este. Abres la nota diaria de hoy y pulsas el atajo de "Ir a una nota" para pasar a la nota de ayer o a una nota que enlazaste desde ella. En una nota en la que estás trabajando, pulsas el atajo de "Establecer propiedades", escribes unas letras del nombre de una persona, la eliges y pulsas "Guardar y cerrar". Si esa persona todavía no existe, pulsas el atajo de "Crear nota", eliges la propiedad de personas, escribes el nombre y la nota nueva ya está lista para enlazarla.

La configuración predeterminada incluye las cuatro listas de relación en "Ir a una nota" y un conjunto de propiedades habituales de casilla de verificación y de enlace en "Establecer propiedades". Abre Ajustes → Note Compass para desactivar lo que no uses y para apuntar las propiedades de enlace a tus propias carpetas y notas.

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

El selector propio de una propiedad marca su valor actual con `✓` y termina con `🗑️ Borrar`, que quita la propiedad, o la deja vacía si "Quitar cuando esté vacía" está desactivado. Escape vuelve al selector principal sin cambiar esa propiedad, y los cambios que ya hiciste allí se conservan.

- Una casilla ofrece `true` y `false`.
- Un texto ofrece `✏️ Usar "<lo que escribiste>"` para un valor nuevo, luego sus valores predefinidos y después los demás valores que la propiedad ya tiene en la bóveda, primero los más usados, con cuántas veces se usa cada uno.
- Un número ofrece `✏️ Usar "<lo que escribiste>"` para un número, luego sus valores predefinidos y después los demás números que la propiedad ya tiene en la bóveda, primero los más usados.
- Una fecha ofrece "Usar" para una fecha escrita como `YYYYMMDD` o `YYYY-MM-DD`, luego Hoy, Mañana, El próximo lunes y En una semana, y se guarda como `YYYY-MM-DD`.
- Una fecha y hora ofrece "Usar" para `YYYYMMDD HHmm`, `YYYY-MM-DD HH:mm` o `YYYY-MM-DDTHH:mm`, luego Ahora, y se guarda como `YYYY-MM-DDTHH:mm`.

![El selector de valores de una propiedad de fecha, con Hoy, Mañana, El próximo lunes, En una semana y Borrar](docs/images/set-properties-date.png)

Las propiedades de enlace nunca ofrecen la nota activa, las notas de las carpetas excluidas de la propiedad ni las notas con `archived: true`. El selector solo enlaza notas que ya existen, así que para enlazar una nota nueva, créala primero con "Crear nota".

## Crear nota

"Crear nota" crea una nota nueva que pertenece a una de tus propiedades de enlace, de modo que esa propiedad la ofrece a partir de ese momento. Funciona con o sin una nota activa, y abre la nota nueva en cuanto se crea, en lugar de la nota activa, sin enlazarla desde esa nota.

Funciona en dos pasos. El primer selector, "Crear una nota para…", tiene una fila por cada propiedad de enlace o de enlaces activada que tenga activado "Permitir crear notas", con la carpeta en la que irá la nota al lado, o `raíz de la bóveda`.

![El primer paso de Crear nota, con las propiedades people, collections y category y la carpeta en la que cada una crea notas](docs/images/create-note-choose.png)

Al elegir una fila se abre el segundo paso, donde escribes el nombre de la nota nueva. Un nombre válido muestra una sola fila, `➕ Crear "<nombre>" en <carpeta>`, y al elegirla se crea la nota y se indica dónde, como en `Se creó "Ada Lovelace" en samples/people.` Escape vuelve al primer paso.

![El segundo paso de Crear nota, que ofrece crear "Ada Lovelace" en samples/people](docs/images/create-note-name.png)

Un nombre con caracteres que Obsidian no puede usar en un nombre de archivo se rechaza con un mensaje que lo explica. También se rechaza un nombre que ya tenga cualquier nota de la bóveda, en cualquier carpeta y sin distinguir mayúsculas, como en `"Ann" ya existe en people/Ann.md.`, porque una segunda nota con ese nombre haría ambiguos los enlaces `[[Ann]]`. Al elegir una de estas filas, el paso sigue abierto con lo que escribiste.

La nota nueva va a la carpeta del origen cuando la propiedad ofrece notas de una carpeta. Si no, va a la "Carpeta" de la propiedad dentro de "Crear notas" y, si está vacía, adonde Obsidian coloca las notas nuevas.

Cuando la propiedad tiene una "Plantilla", la nota parte de ella. Si el complemento Templater está activado, Templater crea la nota, así que se ejecutan sus comandos `<% %>`; si Templater falla, no se hace nada más. Sin Templater, se copia el contenido de la plantilla, `{{title}}` se convierte en el nombre de la nota, y `{{date}}` y `{{time}}` en la fecha y la hora actuales con los formatos configurados en el complemento principal Plantillas, `YYYY-MM-DD` y `HH:mm` de forma predeterminada. `{{date:FORMAT}}` y `{{time:FORMAT}}` usan el formato indicado.

Después, la nota se incorpora al origen de la propiedad, así que aparece en la lista de esa propiedad al instante. Con un origen "Enlaza a una nota", se añade un enlace a esa nota al final del cuerpo, salvo que el contenido ya enlace a ella. Con un filtro de una sola condición de propiedad, la nota recibe la propiedad que pide la condición, como `true` para "es verdadero", el valor para "es" o una lista con el valor para "tiene el elemento". Por último, la nota nueva se abre en la pestaña actual. Si ya existe una nota con ese nombre, no se crea nada y no se abre nada.

Solo sirven los orígenes que pueden contener una nota nueva: notas de una carpeta, notas que enlazan a una nota, notas modificadas hoy y filtros formados por una sola condición de propiedad bajo "Todos los siguientes son verdaderos" que dé un valor que escribir, como "es verdadero", "es", "tiene el elemento" o "tiene valor" en una casilla. Los orígenes de relación, los filtros con más de una condición o con grupos, y condiciones como mayor que no sirven, y el interruptor "Permitir crear notas" explica el motivo cuando está deshabilitado. Si ninguna propiedad cumple los requisitos, el comando muestra "Ninguna propiedad de enlace puede crear notas."

## Ajustes

Los ajustes caben en una ventana estrecha y funcionan igual en móvil. Se dividen en cuatro partes: "Visualización", las listas de "Ir a una nota", "Notas de fecha" y la lista de "Establecer propiedades", seguidas de "Restablecer todos los ajustes".

![La pestaña de ajustes, con las listas de Ir a una nota, el origen de las notas de fecha y la lista de Establecer propiedades, cada fila con un chip de prefijo, un interruptor, un lápiz y un botón de eliminar](docs/images/settings.png)

### Visualización

"Mostrar prefijos" está activado de forma predeterminada. Al desactivarlo se quita el prefijo de todas las filas de los tres selectores y deja de contar para la coincidencia al escribir. Las filas de enlace de "Establecer propiedades" muestran entonces la propiedad que escriben, como en `✓ Marta Vidal · people`. Los ajustes también ocultan los chips y los campos de prefijo, pero tus prefijos y colores siguen guardados, así que al volver a activar el ajuste se recuperan.

### Listas y propiedades

"Ir a una nota" y "Establecer propiedades" son listas de filas, y sus filas funcionan igual. Cada fila muestra su chip de prefijo y lo que muestra o escribe, como `status es active` o `people · enlaces`.

- Arrastra el asa de la izquierda para reordenar las filas. El orden es el del selector.
- Usa el interruptor para mostrar u ocultar una fila en el selector sin perder su configuración.
- Usa el lápiz para abrir la página de la fila y la cruz para eliminarla.
- Usa el `+` de la cabecera de la sección para añadir una fila. Su página se abre al momento para que la completes, y la fila nueva empieza activada.

Una fila que esta versión de Note Compass no puede leer, por ejemplo una guardada por una versión más reciente, se queda en la lista con un aviso: "Esta versión de Note Compass no puede leer esta lista. Elimínala y crea una nueva." Su interruptor está desactivado y deshabilitado y no tiene lápiz, así que nunca añade notas a un selector ni a "Crear nota", pero su configuración guardada se conserva tal cual hasta que la elimines.

Haz clic en un chip de prefijo, tócalo, o ponle el foco y pulsa Intro para abrir su menú, que en un teléfono aparece como una hoja desde abajo. El menú muestra cada prefijo en uso en "Ir a una nota" y "Establecer propiedades", cada uno como su chip seguido de cuántas filas lo usan, como un chip `📅 due` con `· 3 filas`, primero los más usados. El prefijo propio de la fila aparece marcado. Elige uno para dar a esta fila su texto y su color, sin cambiar ninguna otra fila. "Editar prefijo…" abre la página de la fila con el cursor en "Prefijo", y "Sin prefijo", que aparece cuando la fila tiene uno, borra su texto y su color. Un prefijo vacío se muestra como un chip `prefijo` atenuado y nunca aparece en el menú.

Dos filas comparten un prefijo cuando su texto y su color son iguales, así que `👤 peop` en rojo y `👤 peop` sin color son dos prefijos distintos.

### Páginas de lista

La página de una lista tiene "Activado", "Prefijo" y "Color del prefijo", cuya flecha circular quita el color, y después "Origen", que elige qué contiene la lista: fechas adyacentes, enlaces salientes, enlaces entrantes, mismo día, un filtro, notas que enlazan a una nota, notas de una carpeta, notas modificadas hoy o notas de fecha actuales. Notas de fecha actuales tiene un interruptor por periodo, de "Hoy" a "Este año".

Los ajustes del prefijo empiezan con una vista previa grande del chip, que sigue el texto que escribes y el color que eliges. Si otras filas compartían el prefijo de la lista al abrir la página, "Cambiar solo esta fila" las nombra, como en "Lo usan 2 filas más: people · enlaces, Enlaces salientes". Está desactivado, así que el texto que escribes y el color que eliges cambian también esas filas, y siguen juntas aunque el texto quede vacío un momento. Actívalo para cambiar solo esta lista. La página de una propiedad funciona igual.

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

La página de una propiedad tiene "Activado", "Prefijo" y "Color del prefijo", como la página de una lista, y después "Propiedad" y "Tipo". "Propiedad" sugiere las propiedades de la bóveda con sus tipos, y al elegir una el tipo se ajusta a ella: casilla de verificación, número, fecha y fecha y hora conservan el suyo, las listas y las etiquetas pasan a enlaces, y cualquier otra cosa pasa a texto. "Tipo" puede ser casilla de verificación, texto, número, fecha, fecha y hora, "enlace, una nota" o "enlaces, varias notas", y permanece deshabilitado hasta que se elige una propiedad.

![La página de la propiedad de enlaces people, que ofrece las notas que enlazan a Person, excluye la carpeta de plantillas y crea notas nuevas en samples/people a partir de una plantilla](docs/images/settings-property.png)

Todas las propiedades tienen "Quitar cuando esté vacía", que está activado de forma predeterminada y quita la propiedad de la nota en cuanto borras su valor o quitas su último enlace. Si lo desactivas, la propiedad se queda en la nota con un valor vacío.

Una propiedad de texto o de número tiene además "Valores predefinidos", una lista de valores que su propio selector ofrece primero, como `todo`, `doing` y `done` para una propiedad `status`. El `+` de su cabecera añade una fila con un campo de texto para el valor y un interruptor, las filas se pueden arrastrar al orden en que las muestra el selector, y cada fila se puede eliminar. Una propiedad de número solo guarda los valores escritos como números. Los valores predefinidos son una ayuda, no un límite: después de ellos el selector sigue ofreciendo los demás valores que la propiedad ya tiene en la bóveda, primero los más usados, y cualquier cosa que escribas. El interruptor junto a un valor predefinido también lo muestra en el menú principal de Establecer propiedades, así que puedes tener muchos valores predefinidos y dejar solo los pocos que más usas a una sola elección. Todos los valores predefinidos se ofrecen siempre en el selector propio de la propiedad.

Una propiedad de enlace o de enlaces tiene tres secciones más:

- "Ofrecer notas de" elige las notas que ofrece el selector, con los mismos orígenes que una lista de "Ir a una nota".
- "Carpetas excluidas" enumera las carpetas cuyas notas nunca se ofrecen. El `+` de su cabecera añade una carpeta, cada fila se puede eliminar y una fila vacía no excluye nada.
- "Crear notas" decide si la propiedad aparece en "Crear nota". "Permitir crear notas" lo activa, "Carpeta" indica adónde van las notas nuevas y "Plantilla" indica la nota de la que parten las notas nuevas.

Varias filas pueden escribir la misma propiedad, como las filas `related` predeterminadas con orígenes distintos. Comparten un mismo valor, y la primera fila activada decide su tipo. Una fila te avisa cuando dos filas de una misma propiedad no coinciden en el tipo.

### Comportamiento de las casillas

"Comportamiento de las casillas", debajo de la lista de Establecer propiedades, decide qué ocurre al elegir una propiedad de casilla de verificación en el menú principal de Establecer propiedades, para todas las propiedades de casilla: abrir su propio selector con true, false y Borrar, que es la opción predeterminada, alternar entre true y sin valor, o recorrer true, false y sin valor. Un modo elegido para una sola propiedad en las versiones 0.6.1 o 0.6.2 pasa a ser este ajuste.

### Restablecer todos los ajustes

"Restablecer todos los ajustes", al final de los ajustes, devuelve cada lista, propiedad y opción a los valores predeterminados. Primero pide confirmación, y Cancelar o Escape lo deja todo como estaba. El restablecimiento no se puede deshacer.

## Idiomas

Note Compass sigue el idioma que elijas para Obsidian. Está disponible en inglés, español, chino simplificado, chino tradicional, japonés y coreano, y cualquier otro idioma se muestra en inglés. Tus ajustes, los nombres de las propiedades y los valores que se escriben en tus notas se quedan tal como los escribiste, sea cual sea el idioma.

Las traducciones están en `src/i18n/`, y este manual también está disponible en cada uno de esos idiomas desde los enlaces de arriba. Ambos se redactaron por traducción automática, así que algunas expresiones pueden sonar raras, y el manual en inglés es la referencia. Las correcciones son bienvenidas como pull requests. Añadir un idioma requiere un archivo nuevo en esa carpeta y una línea en su registro, y cualquier texto que un idioma todavía no traduzca se muestra en inglés.

## Consejos

- Asigna a los tres comandos atajos que puedas pulsar sin mirar. El complemento está pensado para abrir un selector, escribir unas letras y pulsar Intro.
- Usa prefijos cortos, como un emoji y una abreviatura de tres o cuatro letras, por ejemplo `👤 peop` o `📅 due`. Todos los chips comparten el ancho del más ancho, así que un solo prefijo largo empuja todos los nombres hacia la derecha.
- Usa colores para agrupar listas relacionadas, como un color para todas tus listas de personas y empresas y otro para las de proyectos, y así distinguirlas de un vistazo.
- Escribe la abreviatura de un prefijo para reducir un selector a una lista, como `peop` para las filas de personas en "Establecer propiedades".
- Usa un origen "Enlaza a una nota" como una etiqueta ligera. Crea una nota como `Person` y apunta la propiedad de personas a "Enlaza a una nota: Person". Cada nota creada con "Crear nota" para esa propiedad recibe un enlace a `Person`, así que aparece en la lista sin que tengas que etiquetarla a mano.
- Añade tu carpeta de plantillas a "Carpetas excluidas" en todas las propiedades de enlace, para que las notas de plantilla nunca se ofrezcan como valores.
- Desactiva "Mostrar prefijos" para un aspecto minimalista cuando ya conozcas tus listas. Las filas de enlace muestran entonces el nombre de su propiedad.
- En "Establecer propiedades", Escape en un selector de valores solo vuelve al selector principal. Los cambios que ya hiciste se conservan hasta que eliges "Guardar y cerrar" o "Cancelar".

## Comportamiento conocido

- Un formato de día que contiene `/`, como `YYYY/MM/DD`, nunca coincide, porque el nombre de una nota se compara sin sus carpetas.
- Con los formatos predeterminados, las notas con el nombre de un año en la carpeta de notas de fecha, como `on/2024`, cuentan como notas anuales. Desactiva el periodo de año en los formatos personalizados si guardas otras notas con ese tipo de nombre en esa carpeta.
- Si una propiedad cambia de tipo, una condición de filtro sobre ella conserva su condición anterior y no coincide con nada hasta que elijas una nueva. La condición, la fila de su lista y su página indican que la condición ya no se aplica.
- "Crear nota" nunca modifica una nota existente. Si ya hay una nota en la ruta que crearía, la deja como está y el comando lo indica.

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
