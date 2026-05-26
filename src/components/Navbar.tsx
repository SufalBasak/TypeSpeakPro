import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, LogOut, User, Sun, Moon } from 'lucide-react';
import LoginModal from "@/components/auth/LoginModal";
import { useNavigate, useLocation, NavLink } from "react-router-dom";
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
  const location = useLocation();
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

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled || forceOpaque
          ? 'glass-strong py-3 shadow-[0_4px_30px_rgba(0,0,0,0.3)]'
          : 'bg-transparent py-5'
      }`}
    >
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 group">
          <img
            src="/logo.jpg"
            alt="TypeSpeakPro"
            className="h-20 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
          />
        </a>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            if (link.isFuture) {
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className="relative px-4 py-2 rounded-lg text-sm font-medium text-purple-400 hover:text-purple-300 transition-all duration-200 glow-text"
                  onClick={(e) => handleNavClick(e, link)}
                >
                  {link.label}
                </a>
              );
            }
            return (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) =>
                  `relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`
                }
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNavClick(e, link)}
              >
                {link.label}
              </NavLink>
            );
          })}
        </div>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-200"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-yellow-400 transition-transform duration-200 hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-purple-400 transition-transform duration-200 hover:-rotate-12" />
            )}
          </button>
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative h-9 w-9 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all duration-200 hover:opacity-80 ring-2 ring-border">
                  {user?.picture ? (
                    <img src={user.picture} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-medium text-sm">
                      {user?.name?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
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
          className="lg:hidden text-foreground p-2 hover:bg-muted/50 rounded-lg transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative lg:hidden glass-strong bg-card/95 mt-2 mx-4 rounded-xl p-4 animate-fade-in z-50 shadow-2xl border border-border/80">
            <div className="flex flex-col gap-2">
              {isAuthenticated && (
                <>
                  <div className="flex items-center gap-3 px-2 py-2">
                    <div className="relative h-10 w-10 rounded-full overflow-hidden ring-2 ring-border flex-shrink-0">
                      {user?.picture ? (
                        <img src={user.picture} alt={user.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-medium">
                          {user?.name?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-foreground">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <hr className="border-border/60 my-1" />
                </>
              )}
              {navLinks.map((link) => {
                if (link.isFuture) {
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-purple-400 hover:bg-purple-500/10 transition-colors"
                      onClick={(e) => handleNavClick(e, link)}
                    >
                      {link.label}
                    </a>
                  );
                }
                const isActive = location.pathname === link.href;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-primary bg-primary/10'
                        : 'text-foreground hover:bg-muted/50'
                    }`}
                    onClick={(e) => handleNavClick(e, link)}
                  >
                    {link.label}
                  </a>
                );
              })}
              <hr className="border-border/60 my-1" />
              <div className="pt-1 flex flex-col gap-2">
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
              <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
                <span className="text-xs text-muted-foreground">Theme</span>
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-purple-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
      <ComingSoonModal isOpen={isComingSoonOpen} onClose={() => setIsComingSoonOpen(false)} />
      <FutureInnovationModal isOpen={isFutureModalOpen} onClose={() => setIsFutureModalOpen(false)} />
    </header>
  );
};

export default Navbar;
