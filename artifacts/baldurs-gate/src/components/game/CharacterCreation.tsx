import { useState } from "react";
import { motion } from "framer-motion";
import { CharacterStatsClass, CharacterStatsRace } from "@workspace/api-client-react";

interface Props {
  onComplete: (name: string, cls: CharacterStatsClass, race: CharacterStatsRace) => void;
}

export function CharacterCreation({ onComplete }: Props) {
  const [name, setName] = useState("Hero");
  const [cls,  setCls]  = useState<CharacterStatsClass>("warrior");
  const [race, setRace] = useState<CharacterStatsRace>("human");

  const classes: { id: CharacterStatsClass; label: string; desc: string }[] = [
    { id: "warrior", label: "Воин",   desc: "Мастер ближнего боя. Высокий HP и Сила." },
    { id: "mage",    label: "Маг",    desc: "Повелитель тайных сил. Высокий МА и Интеллект." },
    { id: "rogue",   label: "Плут",   desc: "Ловкий хитрец. Высокая Ловкость и уклонение." },
    { id: "cleric",  label: "Жрец",   desc: "Целитель и защитник. Мудрость и стойкость." },
  ];

  const races: { id: CharacterStatsRace; label: string; desc: string }[] = [
    { id: "human",    label: "Человек", desc: "Гибкий и адаптивный." },
    { id: "elf",      label: "Эльф",    desc: "Утончённый и внимательный." },
    { id: "dwarf",    label: "Дварф",   desc: "Крепкий и выносливый." },
    { id: "halfling", label: "Халфлинг", desc: "Юркий и удачливый." },
  ];

  return (
    <div className="absolute inset-0 flex items-start md:items-center justify-center bg-black/90 overflow-y-auto p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-4xl parchment-bg gothic-border p-5 md:p-8 flex flex-col md:flex-row gap-5 md:gap-8 my-4 md:my-0"
      >
        {/* ── Left: form ─────────────────────────────────────────────── */}
        <div className="flex-1 space-y-4 md:space-y-6">
          <h2 className="text-xl md:text-3xl text-[var(--color-rpg-blood)] border-b border-[var(--color-rpg-gold-dim)] pb-2 flex items-center justify-between">
            <span>Создай героя</span>
            <span className="md:hidden text-[10px] text-gray-500 uppercase tracking-tighter">Настройка</span>
          </h2>

          {/* Name */}
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider mb-2">Имя</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-black/10 border border-[var(--color-rpg-dark)] p-3 font-display text-base md:text-lg focus:outline-none focus:border-[var(--color-rpg-blood)]"
            />
          </div>

          {/* Class */}
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider mb-2">Класс</label>
            <div className="grid grid-cols-2 gap-2">
              {classes.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCls(c.id)}
                  className={`p-2 md:p-3 border text-left transition-colors touch-manipulation ${
                    cls === c.id
                      ? "bg-[var(--color-rpg-dark)] text-[var(--color-rpg-gold)] border-[var(--color-rpg-gold)]"
                      : "border-[var(--color-rpg-dark)] hover:bg-black/5"
                  }`}
                >
                  <div className="font-bold text-sm md:text-base">{c.label}</div>
                  <div className="text-[10px] md:text-xs opacity-80 leading-tight mt-0.5">{c.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Race */}
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider mb-2">Раса</label>
            <div className="grid grid-cols-2 gap-2">
              {races.map(r => (
                <button
                  key={r.id}
                  onClick={() => setRace(r.id)}
                  className={`p-2 border text-left transition-colors touch-manipulation ${
                    race === r.id
                      ? "bg-[var(--color-rpg-dark)] text-[var(--color-rpg-gold)] border-[var(--color-rpg-gold)]"
                      : "border-[var(--color-rpg-dark)] hover:bg-black/5"
                  }`}
                >
                  <div className="font-bold text-sm">{r.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Mobile: inline confirm */}
          <button
            onClick={() => onComplete(name, cls, race)}
            disabled={!name.trim()}
            className="rpg-button w-full md:hidden touch-manipulation"
          >
            Начать приключение
          </button>
        </div>

        {/* ── Right: summary (desktop only) ──────────────────────────── */}
        <div className="hidden md:flex w-[280px] border-l border-[var(--color-rpg-gold-dim)] pl-8 flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold mb-4 text-[var(--color-rpg-dark)]">Сводка</h3>
            <div className="space-y-2 text-lg">
              <p><strong>Имя:</strong> {name || "Неизвестный"}</p>
              <p className="capitalize"><strong>Раса:</strong> {races.find(r => r.id === race)?.label}</p>
              <p className="capitalize"><strong>Класс:</strong> {classes.find(c => c.id === cls)?.label}</p>
            </div>
          </div>

          <button
            onClick={() => onComplete(name, cls, race)}
            disabled={!name.trim()}
            className="rpg-button w-full mt-8 touch-manipulation"
          >
            Начать приключение
          </button>
        </div>
      </motion.div>
    </div>
  );
}
