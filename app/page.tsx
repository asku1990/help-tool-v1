'use client';

import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';
import { LogIn } from 'lucide-react';
import { SignInButton } from '@/components/buttons/SignInButton';
import { SignOutButton } from '@/components/buttons/SignOutButton';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const features = [
  'Manage your vehicles',
  'Log fuel fill-ups',
  'Track maintenance and expenses',
  'See fuel consumption and cost per kilometer',
];

export default function Page() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      router.push('/car');
    }
  }, [status, session, router]);

  return (
    <div className="min-h-screen bg-canvas">
      <section className="px-4 py-12 sm:py-20 text-center">
        <div className="inline-block mb-4 sm:mb-6 bg-secondary text-secondary-foreground px-4 py-2 rounded-full text-sm font-medium">
          Vehicle tracker
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground">
          Car Management
        </h1>
        <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-muted-foreground max-w-2xl mx-auto px-2">
          Keep track of fuel, maintenance, and running costs for all your vehicles in one place.
        </p>
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" className="text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto">
                <LogIn className="h-5 w-5 mr-2" />
                {session ? 'Account' : 'Login'}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95%] sm:w-full max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle>{session ? 'Account' : 'Login'}</DialogTitle>
                <DialogDescription>
                  {session
                    ? 'Manage your account settings'
                    : 'Sign in with your Google account to access your vehicles.'}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">{session ? <SignOutButton /> : <SignInButton />}</div>
            </DialogContent>
          </Dialog>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto border-2"
          >
            <a
              href="https://github.com/asku1990/help-tool-v1"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Source
            </a>
          </Button>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4">
        <Card variant="subtle" className="mx-auto max-w-4xl p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4">What you can track</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {features.map(feature => (
              <li key={feature} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                <span className="w-2 h-2 shrink-0 bg-primary rounded-full" aria-hidden="true" />
                <span className="text-sm sm:text-base">{feature}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
