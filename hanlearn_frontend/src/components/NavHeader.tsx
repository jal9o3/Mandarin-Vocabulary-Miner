import { NavLink } from 'react-router-dom'

const navItemBase = 'rounded-full px-4 py-2 text-sm font-semibold transition'

export function NavHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#d6c7b6]/90 bg-[#f7f2ea]/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-10 lg:px-12">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#d1451b] text-lg font-extrabold text-white shadow-md">
            汉
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f7f6f]">Hanlearn</p>
            <p className="text-sm text-[#5b4f46]">Mandarin Vocabulary Miner</p>
          </div>
        </NavLink>

        <nav className="flex flex-wrap items-center gap-2">
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `${navItemBase} ${isActive ? 'bg-[#d1451b] text-white' : 'border border-[#1b1714] text-[#1b1714] hover:bg-[#1b1714] hover:text-white'}`
            }
          >
            Log in
          </NavLink>
          <NavLink
            to="/signup"
            className={({ isActive }) =>
              `${navItemBase} ${isActive ? 'bg-[#d1451b] text-white' : 'border border-[#1b1714] text-[#1b1714] hover:bg-[#1b1714] hover:text-white'}`
            }
          >
            Sign up
          </NavLink>
        </nav>
      </div>
    </header>
  )
}