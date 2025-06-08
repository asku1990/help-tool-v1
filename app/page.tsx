'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';
import { SignInButton } from '@/components/buttons/SignInButton';
import { SignOutButton } from '@/components/buttons/SignOutButton';
import { useSession } from 'next-auth/react';

const currentProject = {
  title: 'Gym Progress Notes',
  description:
    'A streamlined workout tracking system focused on simplicity and ease of use. Record your sets, weights, and progress notes efficiently.',
  status: 'In Development',
  features: [
    'Quick set and weight logging',
    'Progress tracking over time',
    'Personal notes for each workout',
    'Simple and intuitive interface',
  ],
  techStack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'shadcn/ui'],
};

const futurePlans = [
  {
    title: 'Recipe Collection',
    description:
      'Future plan: Personal cookbook for storing and organizing favorite recipes and meal ideas.',
    icon: '🍳',
  },
  {
    title: 'Vehicle Expenses',
    description: 'Future plan: Track fuel consumption and maintenance costs.',
    icon: '🚗',
  },
];

export default function Page() {
  const { data: session } = useSession();
  const handleTestMode = () => {
    toast('Not Implemented', {
      description: 'This feature is coming soon!',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <section className="px-4 py-12 sm:py-20 text-center">
        <div className="inline-block mb-4 sm:mb-6 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
          Personal Project
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gray-900">
          Personal Helper Tools
        </h1>
        <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-gray-600 max-w-2xl mx-auto px-2">
          Building practical applications to streamline daily tasks, starting with a simple but
          effective gym progress tracking tool.
        </p>
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="lg"
                className="text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
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
                    : 'Sign in with your GitHub account to access your tools.'}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">{session ? <SignOutButton /> : <SignInButton />}</div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="lg"
            className="text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto border-2"
            onClick={handleTestMode}
          >
            Test Mode
          </Button>
          <a
            href="https://github.com/asku1990/help-tool-v1"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto"
          >
            <Button
              variant="outline"
              size="lg"
              className="text-base sm:text-lg px-6 sm:px-8 w-full border-2"
            >
              View Source
            </Button>
          </a>
        </div>
      </section>

      {/* Current Project Section */}
      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-block mb-3 sm:mb-4 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
              Currently Building
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">{currentProject.title}</h2>
            <p className="text-gray-600 px-2">{currentProject.description}</p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm">
            <h3 className="text-lg sm:text-xl font-semibold mb-4">Planned Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              {currentProject.features.map(feature => (
                <div key={feature} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-600 rounded-full" />
                  <span className="text-sm sm:text-base">{feature}</span>
                </div>
              ))}
            </div>

            <h3 className="text-lg sm:text-xl font-semibold mb-4">Tech Stack</h3>
            <div className="flex flex-wrap gap-2">
              {currentProject.techStack.map(tech => (
                <span
                  key={tech}
                  className="bg-gray-100 text-gray-800 text-sm px-4 py-2 rounded-full"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Future Plans Section */}
      <section className="py-12 sm:py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Future Plans</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8 sm:mb-12 px-2">
            After completing the gym notes application, here&apos;s what I&apos;m planning to build
            next.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {futurePlans.map(plan => (
              <div
                key={plan.title}
                className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">{plan.icon}</div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">{plan.title}</h3>
                <p className="text-gray-600 text-sm sm:text-base">{plan.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Toaster />
    </div>
  );
}
