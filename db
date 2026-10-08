import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import NotesPage from './pages/NotesPage';
import AskPage from './pages/AskPage';

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('muse-theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('muse-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex-1 min-h-[44px] flex items-center justify-center ${isActive ? 'text-accent font-medium' : 'text-muted'}`;

  return (
    <div className="min-h-screen" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex items-center justify-between px-4 h-12 max-w-[720px] mx-auto">
        <h1 className="text-xl font-serif text-accent">Muse</h1>
        <button className="min-h-[44px] min-w-[44px] text-muted" onClick={() => setDark(!dark)} aria-label="Toggle dark mode">
          {dark ? 'Light' : 'Dark'}
        </button>
      </header>
      <main className="max-w-[720px] mx-auto px-4 pb-28">
        <Routes>
          <Route path="/" element={<Navigate to="/notes" replace />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/ask" element={<AskPage />} />
        </Routes>
      </main>
      <nav className="fixed bottom-0 inset-x-0 flex bg-surface border-t border-line" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <NavLink to="/notes" className={tab}>Notes</NavLink>
        <NavLink to="/ask" className={tab}>Ask Muse</NavLink>
      </nav>
    </div>
  );
}
