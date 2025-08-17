import * as React from 'react';
import { cn } from '@/utils';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

const Card = React.forwardRef<HTMLDivElement, DivProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-xl border bg-white shadow-sm', className)} {...props} />
));
Card.displayName = 'Card';

const CardHeader = ({ className, ...props }: DivProps) => (
  <div className={cn('p-4 sm:p-6 pb-0', className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
);

const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-gray-500', className)} {...props} />
);

const CardContent = ({ className, ...props }: DivProps) => (
  <div className={cn('p-4 sm:p-6', className)} {...props} />
);

const CardFooter = ({ className, ...props }: DivProps) => (
  <div className={cn('p-4 sm:p-6 pt-0', className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
