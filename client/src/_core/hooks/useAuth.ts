import { trpc } from "@/lib/trpc";

export function useAuth() {
  const me = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation();

  return {
    loading: me.isLoading,
    user: me.data ?? null,
    logout: async () => {
      await logoutMutation.mutateAsync();
      await me.refetch();
    },
  };
}
