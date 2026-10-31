import { cn } from '@/lib/utils';

function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="alert" className={cn('relative w-full rounded-lg border px-4 py-3 text-sm', className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
