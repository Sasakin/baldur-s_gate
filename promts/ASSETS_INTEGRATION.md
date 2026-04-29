# Ассеты и интеграция для Baldur's Gate

## Проблемы с графикой

1. **Персонажи статичны** — нет анимации, только картинка
2. **Локация без текстур** — квадратики вместо ландшафта

## Решение

### 1. Поиск бесплатных ассетов

**Тайлы (изометрические):**
- OpenGameArt.org — поиск "isometric tiles pixel art"
- Devil's Work.shop — бесплатные 100 изометрических блоков
- URL: `http://www.opengameart.org/content/isometric-tiles-pixel-art`

**Персонажи:**
- itch.io — бесплатные isometric character sprites
- Искать: "isometric character template CC0"
- Примеры: intellikat, Engvee (Animated Isometric Prototyping Hero)
- OpenGameArt — isometric hero с анимацией

### 2. Скачивание через curl

```bash
# Тайлы
curl -kL -o tiles.zip "http://www.opengameart.org/sites/default/files/isometric_tiles_pixel_art_v01_2_devilsworkshop.zip"
python -c "import zipfile; zipfile.ZipFile('tiles.zip').extractall('tiles')"

# Персонажи (Hero с-opengameart - части тела, не анимация)
curl -kL -o hero.zip "https://opengameart.org/sites/default/files/isometric_hero.zip"
python -c "import zipfile; zipfile.ZipFile('hero.zip').extractall('hero')"
```

**Важно:**
- itch.io требует авторизации для скачивания — curl не работает
- GitHub raw ссылки могут возвращать HTML редирект
- Использовать `-kL` флаги для игнорирования SSL и following redirects

### 3. Структура папок

```
public/images/
├── tiles/
│   └── Isometric_Tiles_Pixel_Art/
│       └── Blocks/
│           ├── blocks_1.png   (grass)
│           ├── blocks_2.png   (water)
│           ├── blocks_28.png  (dirt)
│           ├── blocks_30.png  (stone)
│           ├── blocks_36.png  (wood)
│           └── blocks_69.png  (wall)
└── hero/
    └── isometric_hero/
        ├── steel_armor.png
        ├── leather_armor.png
        ├── rod.png
        └── ...
```

### 4. Интеграция в IsometricCanvas.tsx

**Конфигурация ассетов (строки 51-68):**
```typescript
const ASSETS = {
  // Textures - Using local isometric tiles
  grass: "/images/tiles/Isometric_Tiles_Pixel_Art/Blocks/blocks_1.png",
  stone: "/images/tiles/Isometric_Tiles_Pixel_Art/Blocks/blocks_30.png",
  wood:  "/images/tiles/Isometric_Tiles_Pixel_Art/Blocks/blocks_36.png",
  water: "/images/tiles/Isometric_Tiles_Pixel_Art/Blocks/blocks_2.png",
  wall:  "/images/tiles/Isometric_Tiles_Pixel_Art/Blocks/blocks_69.png",
  dirt:  "/images/tiles/Isometric_Tiles_Pixel_Art/Blocks/blocks_28.png",
  
  // Heroes
  warrior: "/images/hero/isometric_hero/steel_armor.png",
  mage:    "/images/hero/isometric_hero/rod.png",
  rogue:   "/images/hero/isometric_hero/leather_armor.png",
  cleric:  "/images/hero/isometric_hero/steel_armor.png",
};
```

**Обновление паттернов (строка ~124):**
```typescript
if (Object.keys(imagesRef.current).length > 0 && Object.keys(patternsRef.current).length === 0) {
  Object.entries(imagesRef.current).forEach(([key, img]) => {
    if (["grass", "stone", "wood", "water", "wall", "dirt"].includes(key)) {
      try {
        patternsRef.current[key] = ctx.createPattern(img, 'repeat')!;
      } catch(e) {
        console.warn('Failed to create pattern for:', key);
      }
    }
  });
}
```

### 5. Улучшенная анимация персонажей

В функции `drawUnit` добавлены:
- Магические частицы вокруг героя (aura particles)
- Эффект дыхания (breathe)
- Пульсация ауры (auraPulse)
- Улучшенный glow эффект

**Основные переменные анимации:**
```typescript
const speed = isMoving ? 0.012 : 0.005;
const cycle = time * speed;
const stepCycle = isMoving ? Math.abs(Math.sin(cycle * 1.5)) : Math.sin(cycle) * 0.5 + 0.5;
const bob = isMoving ? stepCycle * 10 : stepCycle * 4;  // Подпрыгивание
const tiltCycle = Math.sin(cycle * (isMoving ? 0.75 : 0.3));
const tilt = isMoving ? tiltCycle * 0.15 : tiltCycle * 0.04;  // Наклон
const breathe = Math.sin(cycle * 0.5) * 2;  // Дыхание
const auraPulse = Math.sin(cycle * 2) * 0.1 + 0.9;  // Пульсация ауры
```

### 6. Для полной анимации персонажей

Нужны спрайт-листы с кадрами анимации (sprite sheets):
- 8 направлений: N, NE, E, SE, S, SW, W, NW
- Кадры: idle (4), walk (8), attack (4), cast (4), die (6)
- Формат: PNG, 128x128px на кадр

**Где взять:**
- https://engvee.itch.io/animated-isometric-prototyping-hero (бесплатно)
- https://opengameart.org/content/isometric-hero-and-heroine
- Сгенерировать через AI (Stable Diffusion + Aseprite)

### Команды для проверки

```bash
# Извлечение zip
python -c "import zipfile; zipfile.ZipFile('file.zip').extractall('folder')"

# PowerShell извлечение
Expand-Archive -Path 'file.zip' -DestinationPath 'folder' -Force
```