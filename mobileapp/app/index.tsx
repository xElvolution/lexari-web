import { Redirect } from "expo-router";
import { useSession } from "@/state/session";
import { Loading } from "@/components/ui";

export default function Index() {
  const { ready, token } = useSession();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(tabs)/hub" />;
}
