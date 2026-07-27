# Mi Arcade con Phaser

Proyecto personal para aprender desarrollo de videojuegos con Phaser y TypeScript.
La aplicación funciona como un pequeño arcade: comienza en un launcher común y
cada juego se instala como un módulo independiente con sus propias escenas,
objetos, reglas y documentación.

Actualmente incluye Tetris, Truco y Jukebox, una herramienta interna para probar la
biblioteca de música y efectos.

## Puesta en marcha

Requisitos:

- Node.js 22 o compatible.
- npm 12 o compatible.

Comandos disponibles:

```bash
npm install
npm run dev
npm run build
npm run audio:catalog
npm run audio:upload:r2
npm run deploy:pages
npm run preview
```

- `npm run dev` inicia el entorno de desarrollo con recarga automática.
- `npm run build` valida TypeScript y genera la versión de producción.
- `npm run audio:catalog` reconstruye el catálogo después de agregar audio.
- `npm run audio:upload:r2` sincroniza los OGG locales con Cloudflare R2.
- `npm run deploy:pages` compila y publica el arcade en Cloudflare Pages.
- `npm run preview` permite revisar localmente el build de producción.

## Arquitectura general

Phaser crea un solo `Phaser.Game` y un solo canvas. Las distintas pantallas son
escenas que se registran al iniciar la aplicación y se activan según la
navegación del jugador.

```mermaid
flowchart TD
    Main["main.ts<br/>Crea Phaser.Game"]
    Catalog["Catálogo<br/>GameDefinition[]"]
    Launcher["LauncherScene<br/>Núcleo compartido"]
    TetrisManifest["Manifiesto de Tetris"]
    TetrisTitle["TetrisTitleScene"]
    TetrisGame["TetrisGameScene"]
    TetrisOver["TetrisGameOverScene"]

    Main --> Launcher
    Main --> Catalog
    Catalog --> TetrisManifest
    TetrisManifest --> TetrisTitle
    TetrisManifest --> TetrisGame
    TetrisManifest --> TetrisOver
    Launcher -->|"entrySceneKey"| TetrisTitle
    TetrisTitle --> TetrisGame
    TetrisGame --> TetrisOver
    TetrisOver --> TetrisGame
    TetrisOver --> TetrisTitle
    TetrisTitle --> Launcher
    TetrisOver --> Launcher
```

El launcher no conoce la implementación interna de Tetris. Sólo lee su ficha y
la clave de su escena de entrada. Eso permite que un juego tenga una escena o
veinte sin volver más complejo al launcher.

## Estructura del proyecto

```text
src/
├── main.ts
├── style.css
│
├── core/
│   ├── gameCatalog.ts
│   ├── sceneKeys.ts
│   ├── audio/
│   │   └── AudioManager.ts
│   ├── i18n/
│   │   ├── i18n.ts
│   │   └── translations.ts
│   └── scenes/
│       └── LauncherScene.ts
│
└── games/
    ├── tetris/
    │   ├── index.ts
    │   ├── sceneKeys.ts
    │   ├── tetris.md
    │   ├── constants/
    │   │   └── tetrominoes.ts
    │   ├── objects/
    │   │   └── Piece.ts
    │   └── scenes/
    │       ├── TetrisTitleScene.ts
    │       ├── TetrisGameScene.ts
    │       └── TetrisGameOverScene.ts
    └── jukebox/
        ├── index.ts
        ├── sceneKeys.ts
        ├── audioCatalog.ts
        ├── jukebox.md
        └── scenes/
            └── JukeboxScene.ts

public/assets/audio/
├── catalog.json
└── licenses/

local-assets/audio/       # Fuentes OGG locales; ignoradas por Git y Vite

cloudflare/
├── audio-assets.json
├── r2-cors.json
└── README.md

scripts/
└── generate-audio-catalog.mjs
```

### `core`

Contiene únicamente infraestructura compartida por el arcade:

- El launcher.
- El contrato `GameDefinition`.
- El catálogo de juegos instalados.
- Las claves de escenas que pertenecen al núcleo.

No se deben colocar reglas específicas de un juego dentro de `core`.

### `games`

Cada subcarpeta representa un juego autocontenido. Un módulo puede tener las
escenas, objetos, sistemas, constantes y assets que necesite.

El archivo `index.ts` es la interfaz pública del módulo. Exporta un manifiesto
que cumple este contrato:

```ts
export type GameDefinition = {
  id: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  controlsKey: TranslationKey;
  accentColor: number;
  coverType: 'tetris' | 'jukebox';
  entrySceneKey: string;
  scenes: Phaser.Types.Scenes.SceneType[];
};
```

## Flujo de navegación

```mermaid
sequenceDiagram
    participant Player as Jugador
    participant Launcher as LauncherScene
    participant Manifest as GameDefinition
    participant TitleScene as Escena inicial
    participant Game as Escena de juego
    participant EndScene as Escena final

    Player->>Launcher: Selecciona un juego
    Launcher->>Manifest: Lee entrySceneKey
    Launcher->>TitleScene: scene.start(entrySceneKey)
    Player->>TitleScene: Comienza la partida
    TitleScene->>Game: scene.start(gameKey)
    Game->>EndScene: scene.start(endKey, resultado)
    alt Reintentar
        EndScene->>Game: Inicia una partida nueva
    else Menú del juego
        EndScene->>TitleScene: Vuelve al título
    else Arcade
        EndScene->>Launcher: Vuelve al catálogo
    end
```

Phaser ofrece varias operaciones útiles para juegos con más pantallas:

- `scene.start`: detiene la escena actual y abre otra.
- `scene.launch`: ejecuta otra escena en paralelo; por ejemplo, un HUD.
- `scene.pause` y `scene.resume`: pausa y reanuda una escena.
- `scene.sleep` y `scene.wake`: conserva una escena sin actualizarla.
- `scene.stop`: detiene explícitamente una escena.

## Cómo agregar otro juego

1. Crear `src/games/<nombre-del-juego>`.
2. Definir claves con un prefijo propio, como `snake:title` o `snake:game`.
3. Implementar las escenas necesarias.
4. Crear un `index.ts` que exporte su `GameDefinition`.
5. Agregar las traducciones de su ficha y pantallas para todos los idiomas.
6. Importar el manifiesto en `core/gameCatalog.ts`.
7. Agregarlo a `GAME_CATALOG`.
8. Documentar sus controles, mecánicas y decisiones dentro de su módulo.
9. Ejecutar `npm run build` y probar el recorrido completo en el navegador.

```mermaid
flowchart LR
    Folder["Crear módulo"] --> Keys["Definir sceneKeys"]
    Keys --> Scenes["Implementar escenas"]
    Scenes --> Manifest["Exportar GameDefinition"]
    Manifest --> Catalog["Agregar al catálogo"]
    Catalog --> Test["Compilar y probar"]
```

## Internacionalización

La interfaz está disponible en español e inglés. Los textos visibles no se
guardan directamente en las escenas ni en los manifiestos: se referencian con
claves tipadas definidas en `core/i18n/translations.ts`.

```mermaid
flowchart TD
    Storage["localStorage<br/>arcade.locale"]
    Browser["navigator.languages<br/>navigator.language"]
    Fallback["Fallback: español"]
    Resolver["I18n.resolveInitialLocale"]
    Locale["Idioma activo<br/>es o en"]
    Dictionary["Diccionario tipado"]
    Launcher["Launcher"]
    Games["Escenas de juegos"]

    Storage -->|"1. Preferencia guardada"| Resolver
    Browser -->|"2. Idioma compatible"| Resolver
    Fallback -->|"3. Sin coincidencia"| Resolver
    Resolver --> Locale
    Locale --> Dictionary
    Dictionary --> Launcher
    Dictionary --> Games
```

Orden de resolución:

1. Preferencia elegida previamente y guardada en `localStorage`.
2. Primer idioma compatible configurado en el navegador.
3. Español como fallback.

El selector ES/EN vive en el launcher. Al cambiarlo, se persiste
`arcade.locale` y se reinicia la escena del launcher para redibujar sus textos.
Las escenas que se abran después leen automáticamente el mismo idioma activo.

El diccionario español define el tipo `TranslationKey`. El diccionario inglés
debe satisfacer exactamente ese conjunto, por lo que TypeScript detecta claves
faltantes durante `npm run build`.

Para agregar un idioma:

1. Sumar su código a `SUPPORTED_LOCALES`.
2. Crear el diccionario completo en `translations.ts`.
3. Agregarlo a `TRANSLATIONS`.
4. Incorporar su opción en el selector del launcher.
5. Probar detección, selección, persistencia y todas las escenas.

### Evolución de la persistencia

`localStorage` es la opción adecuada mientras se guarden preferencias pequeñas
del dispositivo, como idioma, volumen o configuración de controles. No requiere
cuentas, servidor ni conexión.

Si más adelante aparecen partidas locales grandes, replays o muchos datos
estructurados, la alternativa del navegador es IndexedDB. Una base de datos en
un backend recién se justifica cuando necesitemos usuarios, sincronización entre
dispositivos, rankings compartidos o copias en la nube. En ese caso el juego se
comunicaría con una API autenticada; nunca accedería directamente a la base de
datos desde el cliente.

## Audio y Jukebox

Los OGG compartidos viven en Cloudflare R2. `public/assets/audio` conserva sólo
el catálogo y las licencias, mientras que las fuentes locales se guardan en
`local-assets/audio`, fuera de Git y del build. Los juegos consumen las URLs de
R2 declaradas en el catálogo y usan `AudioManager` para la política común.

```mermaid
flowchart LR
    Packs["local-assets/audio<br/>OGG locales"]
    R2["Cloudflare R2<br/>220 audios"]
    Upload["scripts/upload-audio-r2.mjs"]
    Script["scripts/generate-audio-catalog.mjs"]
    Json["public/assets/audio/catalog.json"]
    Jukebox["JukeboxScene<br/>Explora y copia rutas"]
    Loader["Loader de Phaser<br/>Carga bajo demanda"]
    Audio["AudioManager<br/>Música, SFX y volumen"]

    Packs -->|"npm run audio:upload:r2"| Upload
    Upload --> R2
    Packs -->|"npm run audio:catalog"| Script
    Script --> Json
    R2 -. "URLs públicas" .-> Json
    Json --> Jukebox
    Jukebox --> Loader
    Loader --> Audio
```

El Jukebox está instalado como un juego más. Su módulo es autocontenido bajo
`src/games/jukebox`, pero delega en `core/audio/AudioManager.ts` aquello que sí
comparten todos los juegos: una única música activa, volúmenes separados y su
persistencia.

El launcher reproduce la pista `Week 1 - Retro Lounge BASE` desde
`src/core/audio/coreAudio.ts`. Se carga al entrar al arcade y se detiene al
salir hacia otro juego, manteniendo la música de cada pantalla aislada.

La escena sólo precarga el JSON del catálogo. Cada OGG se descarga al elegirlo,
evitando cargar toda la biblioteca al abrir el arcade. La ruta visible se puede
copiar con el botón **Copiar** o con `Ctrl+C` / `Cmd+C`; esa es la URL que debe
usarse al precargar el asset desde otra escena.

Los volúmenes se guardan en `localStorage`:

- `arcade.audio.musicVolume`
- `arcade.audio.sfxVolume`

Para sumar un pack, se lo descomprime en `local-assets/audio`, se conservan sus
archivos de licencia, se registra su colección en el generador y se ejecutan
`npm run audio:upload:r2` y `npm run audio:catalog`. El catálogo generado no
debe editarse a mano.

Componentes relevantes:

- `src/core/audio/AudioManager.ts`: política compartida de reproducción.
- `src/core/audio/coreAudio.ts`: música de las pantallas compartidas, incluida
  la del launcher.
- `src/games/jukebox`: manifiesto, escena, tipos y documentación del Jukebox.
- `local-assets/audio`: fuentes pesadas locales, ignoradas por Git y Vite.
- `public/assets/audio`: licencias y catálogo generado.
- `cloudflare`: bucket, URL pública, CORS y operación de R2.
- `scripts/generate-audio-catalog.mjs`: reconstrucción reproducible del catálogo.
- `scripts/upload-audio-r2.mjs`: sincronización de OGG mediante Wrangler.
- `tools/audio/abstraction-song-browser`: navegador original del bundle,
  conservado como herramienta externa y fuera del runtime del juego.

## Despliegue y caché

El arcade está publicado en [phaser-arcade.pages.dev](https://phaser-arcade.pages.dev/).
Cloudflare Pages y R2 se despliegan por separado:

1. `npm run audio:upload:r2` actualiza los objetos pesados.
2. `npm run audio:catalog` calcula versiones desde el contenido.
3. `npm run deploy:pages` publica código y catálogo.

`index.html` y `catalog.json` usan `must-revalidate`. Los archivos JS/CSS de
Vite tienen hash en el nombre y los OGG llevan `?v=<hash>`, por lo que pueden
usar caché inmutable durante un año. En un despliegue normal no se purga caché:
todo contenido modificado obtiene una URL diferente.

## Estado y representación visual

La lógica del juego no debe depender de sus objetos visuales. Por ejemplo, en
Tetris la matriz `board` es el estado real y los `Rectangle` de Phaser son sólo
su representación en pantalla.

Esta separación permite:

- Probar reglas sin depender del renderizado.
- Redibujar la pantalla sin alterar la partida.
- Cambiar gráficos sin reescribir colisiones o puntaje.
- Compartir resultados entre escenas mediante objetos simples.

Las escenas de Phaser se reutilizan. Todo estado de una partida nueva debe
reiniciarse explícitamente desde `create` o desde un método llamado por éste.

## Convenciones

- Las claves de escenas usan prefijos: `core:*`, `tetris:*`, etcétera.
- Los assets futuros también deben usar claves con prefijo.
- Ningún texto visible debe quedar escrito directamente en una escena.
- Todo idioma debe implementar el conjunto completo de `TranslationKey`.
- Los comentarios explican conceptos, decisiones y mecánicas; no repiten código
  evidente.
- Las abstracciones compartidas se crean cuando existe más de un consumidor
  real, no anticipadamente.
- Todo juego mantiene su documentación junto a su código.
- Después de cada cambio se ejecuta `npm run build`.

## Documentación adicional

- [Reglas para asistentes y mantenimiento](AGENTS.md)
- [Diseño técnico y funcionalidades de Tetris](src/games/tetris/tetris.md)
- [Diseño técnico y funcionalidades del Jukebox](src/games/jukebox/jukebox.md)
- [Biblioteca, licencias y procedimiento de audio](public/assets/audio/README.md)
- [Infraestructura y operación de Cloudflare R2](cloudflare/README.md)
