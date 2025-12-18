import { Redirect } from 'expo-router';

import { useAuth } from '@/src/store/auth';

export default function Index() {
  const { session } = useAuth();

  if (session) {
    return <Redirect href="/home" />;
  }

  return <Redirect href="/login" />;
}
