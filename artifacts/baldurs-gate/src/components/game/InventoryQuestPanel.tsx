import { LocalGameState } from "../../lib/types";

interface Props {
  state: LocalGameState;
  onClose: () => void;
}

export function InventoryQuestPanel({ state, onClose }: Props) {
  const isInv = state.appState === 'INVENTORY';

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-2 md:p-8 z-50">
      <div className="parchment-bg gothic-border w-full max-w-5xl h-[90vh] md:h-[80vh] flex flex-col shadow-2xl shadow-black">
        <div className="flex border-b-2 border-[var(--color-rpg-gold-dim)]">
          <h2 className="flex-1 p-2 md:p-4 text-lg md:text-2xl font-display font-bold text-center">{isInv ? 'Party Inventory' : 'Quest Journal'}</h2>
          <button onClick={onClose} className="p-2 md:p-4 hover:bg-black/10 font-bold text-xl w-12 h-12 flex items-center justify-center">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-8">
          {isInv ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-4">
              {state.inventory.map((item, i) => (
                <div key={i} className="aspect-square border border-[var(--color-rpg-dark)] bg-black/10 p-2 flex flex-col items-center justify-center relative hover:bg-black/20 cursor-pointer transition-colors">
                  <div className="text-sm font-bold text-center leading-tight">{item.name}</div>
                  <div className="absolute bottom-1 right-2 text-xs font-bold text-[var(--color-rpg-blood)]">x{item.quantity}</div>
                </div>
              ))}
              {/* Empty slots padding */}
              {Array(24 - state.inventory.length).fill(0).map((_, i) => (
                <div key={`e_${i}`} className="aspect-square border border-[var(--color-rpg-dark)] bg-black/5 opacity-50" />
              ))}
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              {state.quests.map(q => (
                <div key={q.id} className="border-l-4 border-[var(--color-rpg-blood)] pl-4 bg-white/30 p-4">
                  <h3 className={`text-xl font-bold ${q.completed ? 'line-through text-gray-500' : 'text-[var(--color-rpg-dark)]'}`}>
                    {q.title}
                  </h3>
                  <p className="mt-2 text-lg italic opacity-80">{q.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
