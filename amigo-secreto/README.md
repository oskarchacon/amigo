# Entre amigos · Amigo secreto con SQLite

Aplicación con servidor Node.js y SQLite, sin paquetes externos. Requiere Node.js 24 o superior y utiliza su módulo integrado `node:sqlite` (https://nodejs.org/api/sqlite.html).

## Ejecutar

Desde esta carpeta ejecuta:

```powershell
node server.cjs
```

Abre http://localhost:3000. Ya no se debe abrir index.html directamente.

La base se crea automáticamente en `data/amigo-secreto.sqlite`. Sus tablas son `participants`, `assignments` y `metadata`. Los cambios se realizan en transacciones y una versión evita sobrescribir modificaciones de otro dispositivo.

Agrega al menos tres participantes, realiza el sorteo y selecciona cada nombre para consultar su resultado. Modificar participantes elimina el sorteo, previa confirmación. Los datos sobreviven al reinicio del servidor. Los participantes anteriores de localStorage no se importan automáticamente: debes agregarlos de nuevo.

## Otros dispositivos

Para escuchar en tu red local, ejecuta en PowerShell:

```powershell
$env:HOST = '0.0.0.0'
node server.cjs
```

Abre `http://IP-DE-TU-PC:3000` desde otro dispositivo conectado a la misma red. El firewall debe permitir el puerto. Todos acceden a la misma base. Recarga para ver cambios; también se actualiza al regresar a la ventana.

## Publicación

Necesitas un servidor con Node.js 24 o superior y almacenamiento persistente. Netlify Drop, que sirve archivos estáticos, ya no ejecuta esta versión.

- Inicio: `node server.cjs`.
- Configura `HOST=0.0.0.0` y el `PORT` requerido por el alojamiento.
- Configura `DB_PATH` en un disco persistente; por ejemplo `/data/amigo-secreto.sqlite`.
- Ejecuta una sola instancia del servidor con ese archivo y configura HTTPS en el alojamiento.
- Para respaldar, detén el servidor, copia el archivo SQLite y reinicia. No lo pongas en una carpeta pública.

## Acceso y privacidad

Conserva el modo de grupo de confianza: no tiene cuentas ni contraseñas. Cualquier persona con acceso puede modificar participantes, volver a sortear y consultar resultados seleccionando nombres. SQLite aporta persistencia compartida; para resultados privados por persona hace falta agregar autenticación. La API de la lista no entrega las asignaciones y el servidor no publica el archivo de la base de datos.

## Pruebas

Ejecuta `node --test draw.test.cjs server.test.cjs` (o `npm test` si tienes npm). Verifican el sorteo, la API, persistencia al reabrir SQLite, conflictos entre dispositivos y que la base no sea accesible como archivo público.

