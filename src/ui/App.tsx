import { Component, type ReactNode, useEffect, useState } from 'react';
import { ClientRoom } from '../net/client';
import { HostRoom } from '../net/host';
import { normalizeCode } from '../net/protocol';
import { DEFAULT_SETTINGS, type Settings, cleanName } from '../settings';
import { type GameController, useClientController, useHostController, useLocalController, useSubscribe } from './controllers';
import { JoinScreen } from './Join';
import { Lobby } from './Lobby';
import { GameScreen } from './Table';
import { Stage } from './parts';
import { UpdateBar } from './UpdateBar';

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

function codeFromHash(): string | null {
  return normalizeCode(window.location.hash);
}

function clearHash() {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

function Game({ ctl, onExit }: { ctl: GameController; onExit: () => void }) {
  if (!ctl.game) return null;
  return <GameScreen ctl={{ ...ctl, game: ctl.game }} onExit={onExit} />;
}

function LocalGame({ settings, onExit }: { settings: Settings; onExit: () => void }) {
  return <Game ctl={useLocalController(settings)} onExit={onExit} />;
}

function HostGame({ room, settings, onExit }: { room: HostRoom; settings: Settings; onExit: () => void }) {
  return <Game ctl={useHostController(room, settings)} onExit={onExit} />;
}

function ClientGame({ room, onExit }: { room: ClientRoom; onExit: () => void }) {
  return <Game ctl={useClientController(room)} onExit={onExit} />;
}

type Screen = 'lobby' | 'local' | 'host' | 'join';

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [joinCode, setJoinCode] = useState<string | null>(codeFromHash);
  const [screen, setScreen] = useState<Screen>(() => (codeFromHash() ? 'join' : 'lobby'));
  const [gameKey, setGameKey] = useState(0);
  const [host, setHost] = useState<HostRoom | null>(null);
  const [hostSettings, setHostSettings] = useState<Settings>(settings);
  // Po obnovení stránky se hráč, který už u stolu byl, připojí rovnou (stejný token = stejné místo).
  const [client, setClient] = useState<ClientRoom | null>(() => {
    const code = codeFromHash();
    if (!code || !ClientRoom.hasToken(code)) return null;
    const c = new ClientRoom(code, cleanName(settings.name));
    c.connect();
    return c;
  });
  useSubscribe(client);

  // Odkaz vložený do už otevřené stránky.
  useEffect(() => {
    const onHash = () => {
      const code = codeFromHash();
      if (code && screen !== 'host' && screen !== 'local') {
        client?.leave();
        setClient(null);
        setJoinCode(code);
        setScreen('join');
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [screen, client]);

  // Hostitel by zavřením karty ukončil hru všem.
  useEffect(() => {
    if (screen !== 'host') return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [screen]);

  const update = (s: Settings) => {
    setSettings(s);
    host?.updateSettings(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* nevadí */
    }
  };

  const toLobby = () => {
    setScreen('lobby');
    setGameKey((k) => k + 1);
  };

  const createRoom = () => {
    host?.close();
    const room = new HostRoom(settings);
    room.open();
    setHost(room);
  };

  const closeRoom = () => {
    host?.close();
    setHost(null);
  };

  const leaveJoin = () => {
    client?.leave();
    setClient(null);
    setJoinCode(null);
    clearHash();
    toLobby();
  };

  let content: ReactNode;
  if (screen === 'local') {
    content = <LocalGame key={gameKey} settings={settings} onExit={toLobby} />;
  } else if (screen === 'host' && host) {
    content = (
      <HostGame
        key={gameKey}
        room={host}
        settings={hostSettings}
        onExit={() => {
          closeRoom();
          toLobby();
        }}
      />
    );
  } else if (screen === 'join' && joinCode) {
    content =
      client && client.status === 'playing' && client.game ? (
        <ClientGame room={client} onExit={leaveJoin} />
      ) : (
        <JoinScreen
          code={joinCode}
          room={client}
          defaultName={settings.name}
          onConnect={(name) => {
            const n = cleanName(name);
            update({ ...settings, name: n });
            const c = new ClientRoom(joinCode, n);
            c.connect();
            setClient(c);
          }}
          onRetry={() => client?.connect()}
          onBack={leaveJoin}
        />
      );
  } else {
    content = (
      <Lobby
        settings={settings}
        onChange={update}
        onStartLocal={() => {
          setGameKey((k) => k + 1);
          setScreen('local');
        }}
        host={host}
        onCreateRoom={createRoom}
        onCloseRoom={closeRoom}
        onStartHost={() => {
          if (!host) return;
          host.start();
          setHostSettings(settings);
          setGameKey((k) => k + 1);
          setScreen('host');
        }}
      />
    );
  }

  return (
    <>
      <Stage>
        <ErrorBoundary onReset={toLobby}>{content}</ErrorBoundary>
      </Stage>
      <UpdateBar />
    </>
  );
}
