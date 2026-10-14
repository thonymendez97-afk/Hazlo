# ¡Hazlo! — guía para publicarla e instalarla

Este repositorio es la app completa. Cada persona guarda sus tareas en su propio celular. Un pequeño servidor en Netlify (gratis) se encarga de mandar los avisos a la hora de cada tarea, aunque la app esté cerrada.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `public/` | La app que se instala en el celular (todo lo de abajo está aquí) |
| `netlify/functions/` | El servidor de avisos: recibe la hora de las tareas y manda las notificaciones cada minuto |
| `netlify/lib/` | Las reglas de cuándo avisar, compartidas por el servidor |
| `netlify.toml`, `package.json` | Configuración de Netlify |
| `index.html` | La pantalla de la app |
| `styles.css` | Colores, letras y diseño |
| `app.js` | Todo lo que hace la app: tareas, gestos, alertas |
| `manifest.webmanifest` | Nombre, ícono y colores para instalarla |
| `sw.js` | Hace que abra sin internet y que las notificaciones abran la app |
| `icons/` | Íconos para iPhone, Android y notificaciones |
| `fonts/` | Las letras Fredoka y Nunito, incluidas para que no dependa de internet |

## 1. Publicarla gratis (una sola vez)

**Con avisos con la app cerrada (recomendado):** en Netlify, «Add new project → Import an existing project → GitHub», elige este repositorio y toca «Deploy». No hay que configurar nada más: las claves de notificación se crean solas. Cada cambio que se sube a GitHub se publica solo.

**Sin servidor (solo avisos con la app abierta):** las opciones de abajo, subiendo únicamente la carpeta `public`.


Para instalarla en un celular, la app tiene que estar en una dirección web segura (https). Dos opciones gratuitas:

**Opción A — Netlify (la más fácil)**
1. Crea una cuenta gratis en netlify.com.
2. Entra a app.netlify.com/drop.
3. Arrastra la carpeta `public` a la página.
4. En un momento te da una dirección del tipo `https://algo.netlify.app`. En la configuración del sitio puedes cambiarle el nombre, por ejemplo `https://hazlo-tareas.netlify.app`.

**Opción B — GitHub Pages**
1. Crea una cuenta gratis en github.com y un repositorio nuevo (por ejemplo `hazlo`).
2. Usa «Add file → Upload files» y sube todo el contenido de la carpeta, sin la carpeta en sí.
3. Ve a «Settings → Pages», elige la rama `main` y la carpeta raíz, y guarda.
4. Tu dirección será `https://tu-usuario.github.io/hazlo/`.

## 2. Instalarla en el celular

**iPhone**
1. Abre la dirección en **Safari**. Tiene que ser Safari, no otro navegador.
2. Toca **Compartir** y luego **Agregar a inicio**.
3. Abre ¡Hazlo! desde el ícono nuevo: se abre a pantalla completa, como cualquier app.

**Android**
1. Abre la dirección en **Chrome**.
2. Toca **Instalar app**, o el menú ⋮ y luego **Agregar a pantalla principal**.

## 3. Alertas

- **Con la app abierta:** cuando una tarea llega a su hora, aparece un aviso con sonido y vibración. Puedes tacharla o pedir que te vuelva a avisar en 10 minutos. Al abrir la app, también te dice qué tareas se te pasaron.
- **Notificaciones del teléfono, también con la app cerrada:** toca la campana y luego «Permitir notificaciones». En iPhone solo funciona con la app instalada en la pantalla de inicio (iOS 16.4 o más nuevo). El panel dirá «activadas, también con la app cerrada». El aviso puede llegar hasta un minuto después de la hora, porque el servidor revisa una vez por minuto.
- **Qué recibe el servidor:** solo el nombre, el emoji y la hora de las tareas que tienen hora, y la dirección de notificaciones del teléfono. Nada más.
- **Alarma en el calendario:** sigue disponible en cada tarea con hora, por si la publicaste sin servidor.

## 4. Actualizar la app

1. Sube los cambios a GitHub: Netlify publica solo en un minuto.
2. En `public/sw.js`, sube la versión: por ejemplo `hazlo-v3` pasa a `hazlo-v4`. Así todos los celulares reciben la versión nueva la próxima vez que abran la app.

## 5. Compartirla

Manda la dirección por WhatsApp o donde quieras. Cada persona la instala desde su celular con los pasos del punto 2. Las tareas de cada uno quedan en su propio teléfono y nadie ve las de otros.

Ten en cuenta que, si alguien borra la app de su pantalla de inicio, también se borran sus tareas. Tampoco cambies el nombre del sitio en Netlify una vez que la compartas: la dirección vieja deja de funcionar y cada persona tendría que reinstalarla.

## 6. Si algún día quieres venderla

El código está separado (pantalla, estilos y lógica) para poder crecer sin rehacerlo:

1. **Cuentas y sincronización:** un servicio gratuito o barato (por ejemplo Supabase o Firebase) para que cada persona inicie sesión y vea sus tareas en el celular y en la computadora.
2. **Notificaciones con la app cerrada:** ✅ ya están hechas.
3. **Cobrar:** suscripción por la web con una pasarela de pagos, o publicarla en App Store y Google Play empaquetando esta misma app (por ejemplo con Capacitor). Para App Store se necesita la cuenta de desarrollador de Apple (US$99 al año) y una Mac.
