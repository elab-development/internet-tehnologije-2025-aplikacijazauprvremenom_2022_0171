"use client";

import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type Props = React.ComponentProps<typeof Button>;

export function LogoutButton(props: Props) {
  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Logged out.");
        },
        onError: (error) => {
          toast.error(`Logout failed: ${error.error.message}`);
        },
      },
    });
  }

  return (
    <Button {...props} onClick={() => void handleLogout()}>
      Logout
    </Button>
  );
}
