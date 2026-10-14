import { createRoot } from 'react-dom/client';
// Jen latinka (čeština je v latin-ext) – menší offline mezipaměť.
import '@fontsource/cascadia-code/latin-400.css';
import '@fontsource/cascadia-code/latin-ext-400.css';
import '@fontsource/cascadia-code/latin-700.css';
import '@fontsource/cascadia-code/latin-ext-700.css';
import './styles/app.css';
import { App } from './ui/App';

createRoot(document.getElementById('root')!).render(<App />);
