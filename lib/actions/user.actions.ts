'use server';

import axios from 'axios';
import { revalidatePath } from 'next/cache';
import { tree } from 'next/dist/build/templates/app-page';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  CountryCode,
  ProcessorTokenCreateRequest,
  ProcessorTokenCreateRequestProcessorEnum,
  Products,
} from 'plaid';

import { addFundingSource, createDwollaCustomer } from './dwolla.actions';
import { plaidClient } from '../plaid';
import { encryptId, extractCustomerIdFromUrl, parseStringify } from '../utils';

const axiosInstance = axios.create({
  baseURL: process.env.API_URL,
});

export const signUp = async (userData: SignUpParams) => {
  console.log('UserData', userData);
  try {
    const dwollaCustomerUrl = await createDwollaCustomer({
      ...userData,
      type: 'personal',
    });

    if (!dwollaCustomerUrl) throw new Error('Error creating Dwolla customer');

    const dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);

    const data = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      address1: userData.address1,
      city: userData.city,
      state: userData.state,
      postalCode: userData.postalCode,
      dateOfBirth: userData.dateOfBirth,
      ssn: userData.ssn,
      dwollaCustomerId: dwollaCustomerId,
      dwollaCustomerUrl: dwollaCustomerUrl,
      email: userData.email,
      password: userData.password,
    };

    console.log('Data', data);

    const user = await axiosInstance.post('/api/users/register/', data);

    if (!user) throw new Error('Error creating user');

    if (user) {
      // Set cookies for access and refresh tokens
      cookies().set({
        name: 'access_token',
        value: user.data.access,
        httpOnly: true,
        sameSite: 'lax',
      });
      cookies().set({
        name: 'refresh_token',
        value: user.data.refresh,
        httpOnly: true,
        sameSite: 'lax',
      });

      // Fetch the logged-in user data
      return await getLoggedInUser();
    }
  } catch (error) {
    console.error('Error during sign up:', error);
    throw error; // Re-throw the error for better error handling in the calling function
  }
};

export const signIn = async ({ email, password }: signInProps) => {
  try {
    const user = await axiosInstance.post('/api/users/login/', {
      email,
      password,
    });
    console.log(user);
    if (user) {
      // Set cookies for access and refresh tokens
      cookies().set({
        name: 'access_token',
        value: user.data.access,
        httpOnly: true,
        sameSite: 'lax',
      });
      cookies().set({
        name: 'refresh_token',
        value: user.data.refresh,
        httpOnly: true,
        sameSite: 'lax',
      });

      return user.data;
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error during sign in:', error.message);
    } else {
      console.error('An unexpected error occurred:', error);
    }
    throw error;
  }
};

export const getLoggedInUser = async () => {
  try {
    const accessToken = cookies().get('access_token')?.value;
    const user = await axiosInstance.get('/api/users/me/', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log(user);
    return user.data;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error during getLoggedInUser:', error.message);
    } else if (error === 401) {
      redirect('/sign-in');
    }
    throw error;
  }
};

export const logOutUser = async () => {
  try {
    // Delete the cookies
    cookies().set('access_token', '', { maxAge: -1 });
    cookies().set('refresh_token', '', { maxAge: -1 });

    console.log('User successfully logged out');
    return true;
  } catch (error) {
    console.error('Error during logout:', error);
    return false;
  }
};

export const createLinkToken = async (user: User) => {
  console.log('firstName: ', user.firstName);
  try {
    const tokenParams = {
      user: {
        client_user_id: user.id,
      },
      client_name: `${user.firstName} ${user.lastName}`,
      products: ['auth'] as Products[],
      language: 'en',
      country_codes: ['US'] as CountryCode[],
    };

    const response = await plaidClient.linkTokenCreate(tokenParams);

    // return parseStringify({ linkToken: response.data.link_token });
    return { linkToken: response.data.link_token };
  } catch (error) {
    console.error(error);
  }
};

export const createBankAccount = async ({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  shareableId,
}: createBankAccountProps) => {
  try {
    const bankAccount = {
      userId: userId,
      bankId: bankId,
      accountId: accountId,
      accessToken: accessToken,
      fundingSourceUrl: fundingSourceUrl,
      shareableId: shareableId,
    };

    const response = await axiosInstance.post(
      '/api/banks/register/',
      bankAccount,
    );

    return response;
  } catch (error) {
    console.error(error);
  }
};

export const exchangePublicToken = async ({
  publicToken,
  user,
}: exchangePublicTokenProps) => {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Get account information from Plaid using the access token
    const accountResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accountData = accountResponse.data.accounts[0];

    // Create a processor token for Dwolla using the access token and account ID
    const request: ProcessorTokenCreateRequest = {
      access_token: accessToken,
      account_id: accountData.account_id,
      processor: 'dwolla' as ProcessorTokenCreateRequestProcessorEnum,
    };

    const processorTokenResponse =
      await plaidClient.processorTokenCreate(request);
    const processorToken = processorTokenResponse.data.processor_token;

    // Create a funding source URL for the account using the Dwolla customer ID, processor token, and bank name
    const fundingSourceUrl = await addFundingSource({
      dwollaCustomerId: user.dwollaCustomerId,
      processorToken,
      bankName: accountData.name,
    });

    // If the funding source URL is not created, throw an error
    if (!fundingSourceUrl)
      throw new Error('Funding source URL creation failed');

    // Create a bank account using the user ID, item ID, account ID, access token, funding source URL and sharable ID
    await createBankAccount({
      userId: user.id,
      bankId: itemId,
      accountId: accountData.account_id,
      accessToken,
      fundingSourceUrl,
      shareableId: encryptId(accountData.account_id),
    });

    // Revalidate the path to reflect the changes
    revalidatePath('/');

    // Return a success message
    return parseStringify({ publicTokenExchange: 'complete' });
  } catch (error) {
    console.error(error);
  }
};
