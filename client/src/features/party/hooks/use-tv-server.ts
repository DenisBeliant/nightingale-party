import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { loadTvServerStatus, onTvServerChanged, tvServerAvailable } from '@/bridge/tv-server';
import { TV_SERVER } from '@/shared/query-keys';

/** Live status of the desktop's TV server (always idle outside the desktop app). */
export const useTvServer = () => {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: TV_SERVER,
    queryFn: loadTvServerStatus,
    enabled: tvServerAvailable,
  });

  useEffect(() => {
    if (!tvServerAvailable) {
      return undefined;
    }
    const pending = onTvServerChanged((status) => queryClient.setQueryData(TV_SERVER, status));
    return () => {
      void pending.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [queryClient]);

  return data;
};
