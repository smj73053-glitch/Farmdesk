import * as React from 'react';
import { Link } from 'react-router-dom';
import { Tractor } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states';
import type { Farm } from '@/types/models';

/** Waits for the workspace and guarantees a farm before rendering farm-scoped pages. */
export function FarmGate({ children }: { children: (farm: Farm) => React.ReactNode }) {
  const { farm, isLoading, error } = useWorkspace();

  if (isLoading) return <LoadingBlock rows={4} />;
  if (error) return <ErrorState message={error.message} />;
  if (!farm) {
    return (
      <EmptyState
        icon={Tractor}
        title="No farm registered yet"
        description="Add your farm details to unlock weather, crop recommendations, finance tracking and field records. Everything you enter stays in your account."
        action={
          <Button asChild>
            <Link to="/farms">Add your first farm</Link>
          </Button>
        }
      />
    );
  }
  return <>{children(farm)}</>;
}
