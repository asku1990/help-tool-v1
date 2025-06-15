'use client';

import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export function SignOutButton() {
  return (
    <Button
      onClick={() => signOut({ callbackUrl: '/' })}
      variant="outline"
      className="w-full p-3 text-base flex items-center justify-center gap-2"
    >
      <LogOut className="w-5 h-5" />
      Sign out
    </Button>
  );
}
