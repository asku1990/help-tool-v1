'use client';

import { Button } from '@/components/ui';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export function SignOutButton({ inMenu = false }: { inMenu?: boolean }) {
  const handleSignOut = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    signOut({ callbackUrl: '/' });
  };

  return (
    <Button
      onClick={handleSignOut}
      variant={inMenu ? 'ghost' : 'outline'}
      className={
        inMenu
          ? 'min-h-11 w-full justify-start px-3'
          : 'w-auto shrink-0 whitespace-nowrap px-3 py-2 text-sm sm:px-4 sm:py-2.5 sm:text-base flex items-center justify-center gap-2'
      }
    >
      <LogOut className="w-5 h-5" aria-hidden="true" />
      Sign out
    </Button>
  );
}
