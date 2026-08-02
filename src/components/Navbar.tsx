import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, LogOut, User, Sun, Moon } from 'lucide-react';
import LoginModal from "@/components/auth/LoginModal";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ComingSoonModal from "@/components/modals/ComingSoonModal";
import { useTheme } from "@/context/ThemeContext";
import FutureInnovationModal from "@/components/modals/FutureInnovationModal";

interface NavbarProps {
  forceOpaque?: boolean;
}

const Navbar = ({ forceOpaque = false }: NavbarProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const [isFutureModalOpen, setIsFutureModalOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, isLoginModalOpen, openLoginModal, closeLoginModal } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/practice', label: 'Typing Test' },
    { href: '/voice-practice', label: 'Voice Practice' },
    { href: '/verbal-practice', label: 'Verbal Practice' },
    { href: '#future', label: 'Future Innovation', isFuture: true },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: { href: string; isComingSoon?: boolean; isFuture?: boolean }) => {
    if (link.isComingSoon) {
      e.preventDefault();
      setIsComingSoonOpen(true);
      setIsMobileMenuOpen(false);
    } else if (link.isFuture) {
      e.preventDefault();
      setIsFutureModalOpen(true);
      setIsMobileMenuOpen(false);
    } else if (link.href === '/practice' && !isAuthenticated) {
      e.preventDefault();
      openLoginModal();
      setIsMobileMenuOpen(false);
    } else {
      setIsMobileMenuOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };
  const currentPath = window.location.pathname;
  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled || forceOpaque
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/60 shadow-lg shadow-black/5'
          : 'bg-background/60 backdrop-blur-lg border-b border-border/30'
      }`}
    >
      <nav className="container mx-auto px-4 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 group shrink-0">
          <img
            src="/logo.jpg"
            alt="TypeSpeakPro"
            className="h-20 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
          />
        </a>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-0.5">
          {(navLinks ?? []).map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                after:absolute after:bottom-0.5 after:left-2 after:right-2 after:h-[2px] after:rounded-full
                after:bg-cyan-400 after:scale-x-0 after:transition-transform after:duration-300
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background
                ${
                  currentPath === link.href
                    ? "text-cyan-400 bg-cyan-400/10 after:scale-x-100"
                    : "text-foreground/70 hover:text-foreground hover:bg-white/5 hover:after:scale-x-50"
                }`}
              onClick={(e) => handleNavClick(e, link)}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full transition-all duration-200 text-foreground/70 hover:text-foreground hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-yellow-400" />
            ) : (
              <Moon className="w-5 h-5 text-purple-400" />
            )}
          </button>
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative h-9 w-9 rounded-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all duration-200 hover:opacity-80 ring-2 ring-white/10">
                  {user?.picture ? (
                    <img src={user.picture} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-teal-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                      {user?.name?[0].toUpperCase() || <User className="h-4 w-4" />}
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard")} className="cursor-pointer hover:bg-muted focus:bg-muted hover:text-foreground focus:text-foreground transition-colors">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile Dashboard</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive hover:text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 transition-colors">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="default" size="sm" onClick={openLoginModal}>
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="lg:hidden text-foreground p-2 rounded-lg hover:bg-white/5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-background/95 backdrop-blur-xl border-b border-border/60 animate-fade-in">
          <div className="px-4 pb-4 pt-2 flex flex-col gap-0.5">
            {isAuthenticated && (
              <>
                <div className="flex flex-col space-y-1 px-3 py-2">
                  <p className="text-sm font-medium leading-none text-foreground">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
                <hr className="border-border/50 mx-3 my-1" />
              </>
            )}
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentPath === link.href
                    ? "text-cyan-400 bg-cyan-400/10"
                    : "text-foreground/70 hover:text-foreground hover:bg-white/5"
                } ${link.isFuture ? 'text-purple-400 font-bold' : ''}`}
                onClick={(e) => handleNavClick(e, link)}
              >
                {link.label}
              </a>
            ))}
            <hr className="border-border/50 mx-3 my-1" />
            <div className="pt-1 px-0 flex flex-col gap-2">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center gap-2 w-full rounded-lg border border-border/50 bg-background/50 px-4 py-2.5 text-sm font-medium text-foreground/80 transition-all duration-200 hover:bg-white/5 hover:text-foreground"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="h-4 w-4 text-yellow-400" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4 text-purple-400" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
              {isAuthenticated ? (
                <>
                  <Button className="w-full" variant="outline" onClick={() => {
                    navigate("/dashboard");
                    setIsMobileMenuOpen(false);
                  }}>
                    My Dashboard
                  </Button>
                  <Button className="w-full" variant="destructive" onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}>
                    Log out
                  </Button>
                </>
              ) : (
                <Button className="w-full" onClick={() => {
                  setIsMobileMenuOpen(false);
                  openLoginModal();
                }}>
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
      <ComingSoonModal isOpen={isComingSoonOpen} onClose={() => setIsComingSoonOpen(false)} />
      <FutureInnovationModal isOpen={isFutureModalOpen} onClose={() => setIsFutureModalOpen(false)} />
    </header>
  );
};

export default Navbar;
