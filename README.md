# IsiVoltPro · Super Web App
**Mantenimiento técnico · base lista para GitHub Pages**

Aplicación web técnica orientada a:
- Informes PDF
- OT y calendario
- Instalaciones / activos
- Ajustes, branding y copia local
- Sincronización opcional con GitHub JSON

## Estructura del proyecto

```text
isivoltpro-super-webapp/
├── index.html
├── manifest.webmanifest
├── sw.js
├── .nojekyll
├── css/
│   └── main.css
├── js/
│   ├── app.js
│   └── data.js
├── data/
│   ├── informes.json
│   ├── ots.json
│   ├── instalaciones.json
│   └── inventario.json
└── assets/
    └── logo.svg
```

## Módulos visibles

- Inicio
- Informes
- OT
- Instalaciones
- Ajustes

## Módulos internos ya disponibles / previstos

- Historial
- Estadísticas
- Preventivos
- Avisos
- Inventario
- QR
- Métricas avanzadas

## Cómo subirlo a GitHub

1. Crea un repositorio nuevo.
2. Sube todo el contenido de esta carpeta.
3. Activa **GitHub Pages** en `Settings → Pages`.
4. Usa rama `main` y carpeta raíz.

## Sincronización GitHub

En **Ajustes → GitHub**:
- Usuario
- Repositorio
- Token `contents:write`
- Rama `main`

## Nota
Esta versión parte de tu wireframe avanzado y se ha reorganizado como paquete listo para publicar.
