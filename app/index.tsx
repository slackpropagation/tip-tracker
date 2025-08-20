import { Redirect } from "expo-router";

export default function Index() {
  // Send the root URL to your first tab
  return <Redirect href="/(tabs)/add-shift" />;
}