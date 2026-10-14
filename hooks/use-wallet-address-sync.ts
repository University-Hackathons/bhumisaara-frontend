"use client";

import { useEffect, useRef } from "react";
import { isAxiosError } from "axios";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import axiosInstance from "@/utils/axiosInstance";
import apiPaths from "@/utils/apiPaths";
import { useAuth } from "@/context/AuthContext";
import { walletAddressStorageKey } from "@/lib/walletStorage";

/**
 * Persists the connected wallet address against the signed-in user the first
 * time it is seen. thirdweb owns the wallet connection, and nothing in its flow
 * tells the backend who connected — this closes that gap.
 *
 * Runs on every authenticated page via the (ui) layout. It is deliberately quiet
 * on success: connecting a wallet shouldn't produce a toast for something the
 * user didn't explicitly ask for.
 */
export function useWalletAddressSync() {
  const account = useActiveAccount();
  const { user } = useAuth();

  // Guards against a second PATCH firing while the first is still in flight
  // (React strict mode double-invokes effects in development).
  const inFlightFor = useRef<string | null>(null);

  useEffect(() => {
    const address = account?.address?.toLowerCase();

    if (!address || !user || !account) {
      return;
    }

    const storageKey = walletAddressStorageKey(user.id);

    if (localStorage.getItem(storageKey) === address) {
      return;
    }

    if (inFlightFor.current === address) {
      return;
    }

    inFlightFor.current = address;
    let cancelled = false;

    axiosInstance
      .post<{ challengeId: string; message: string }>(apiPaths.users.walletChallenge(address))
      .then(async ({ data }) => {
        const signature = await account.signMessage({ message: data.message });
        return axiosInstance.patch(apiPaths.users.myWallet, {
          walletAddress: address, challengeId: data.challengeId, signature,
        });
      })
      .then(() => {
        if (!cancelled) {
          localStorage.setItem(storageKey, address);
        }
      })
      .catch((error) => {
        // A 409 means this wallet belongs to a different account — worth
        // surfacing, because the user's on-chain actions won't be attributable.
        if (isAxiosError(error) && error.response?.status === 409) {
          toast.error("This wallet is already linked to another account.", {
            description: error.response?.data?.message,
          });
        } else {
          console.warn("Could not save the connected wallet address", error);
        }
      })
      .finally(() => {
        if (inFlightFor.current === address) {
          inFlightFor.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [account, user]);
}
