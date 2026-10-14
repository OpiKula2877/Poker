import { Component, type ReactNode, useState } from 'react';

/** Při chybě nezůstane prázdná obrazovka. */
class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="dialog" role="alert" style={{ top: 450 }}>
        <h1>Něco se pokazilo</h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{this.state.error.message}</p>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            this.setState({ error: null });
            this.props.onReset();
          }}
        >
          Zpět do lobby
        </button>
      </div>
    );
  }
}
import { GameScreen } from './Table';
import { Lobby } from './Lobby';
import { DEFAULT_SETTINGS, type Settings } from './useGame';
import { Stage } from './parts';

const KEY = 'poker.settings.v1';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* prohlížeč bez úložiště */
  }
  return DEFAULT_SETTINGS;
}

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<'lobby' | 'game'>('lobby');
  const [gameKey, setGameKey] = useState(0);

  const update = (s: Settings) => {
    setSettings(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* nevadí */
    }
  };

  return (
    <Stage>
      <ErrorBoundary onReset={() => setScreen('lobby')}>
      {screen === 'lobby' ? (
        <Lobby
          settings={settings}
          onChange={update}
          onStart={() => {
            setGameKey((k) => k + 1);
            setScreen('game');
          }}
        />
      ) : (
        <GameScreen key={gameKey} settings={settings} onExit={() => setScreen('lobby')} />
      )}
      </ErrorBoundary>
    </Stage>
  );
}
