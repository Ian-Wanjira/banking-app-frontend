import { useCallback, useState, useEffect } from 'react';

import { useRouter } from 'next/navigation';
import {
  PlaidLinkOnSuccess,
  PlaidLinkOptions,
  usePlaidLink,
} from 'react-plaid-link';

import {
  createLinkToken,
  exchangePublicToken,
} from '@/lib/actions/user.actions';

import { Button } from './ui/button';

const PlaidLink = ({ user, variant }: PlaidLinkProps) => {
  const [token, setToken] = useState('');
  const router = useRouter();

  useEffect(() => {
    console.log('User from PlaidLink: ', user);
    const getLinkToken = async () => {
      try {
        const data = await createLinkToken(user);
        if (data?.linkToken) {
          setToken(data.linkToken);
          console.log('Link Token generated:', data.linkToken);
        } else {
          console.error('Failed to generate link token');
        }
      } catch (error) {
        console.error('Error generating link token:', error);
      }
    };

    if (user) {
      getLinkToken();
    }
  }, [user]);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (public_token: string) => {
      await exchangePublicToken({
        publicToken: public_token,
        user,
      });
      router.push('/');
    },
    [user],
  );

  const config: PlaidLinkOptions = {
    token,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <>
      {variant === 'primary' ? (
        <Button
          className="plaidlink-primary"
          onClick={() => open()}
          disabled={!ready || !token} // Ensure button is disabled if token is missing
        >
          Connect Bank
        </Button>
      ) : variant === 'ghost' ? (
        <Button>Connect Bank</Button>
      ) : (
        <Button>Connect Bank</Button>
      )}
    </>
  );
};

export default PlaidLink;
