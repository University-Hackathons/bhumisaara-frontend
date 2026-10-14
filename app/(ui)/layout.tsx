"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Loader } from "@/components/Loader";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { darkTheme, lightTheme } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { client } from "@/lib/thirdwebClient";
import { contract } from "@/lib/contract";
import { polygonAmoy as amoy } from "thirdweb/chains";
import { PendingChainRecords } from "@/components/PendingChainRecords";
import { useWalletAddressSync } from "@/hooks/use-wallet-address-sync";

const ConnectButton = dynamic(
    () => import("thirdweb/react").then((mod) => mod.ConnectButton),
    { ssr: false }
);

// Built once at module scope: rebuilding this on every render handed the
// ConnectButton a brand-new wallet object each time, which churns the
// connection instead of reusing it.
const wallet = inAppWallet({
    smartAccount: {
        chain: amoy,
        sponsorGas: true,
    },
});

// The wallet modal's NFT tab queries thirdweb Insight for the *active* chain.
// Naming our ERC-1155 narrows that query to the fertilizer batches instead of
// every collection the indexer knows about for this address.
const supportedNFTs = { [amoy.id]: [contract.address] };

// thirdweb's stock primary button is deliberately the inverse of the page —
// near-black on light, white on dark — so the disconnected "Connect" button
// read as a foreign control next to our own buttons. Pointing it at the same
// design tokens the rest of the app uses keeps it in step with both themes,
// and with any future palette change, without restyling per theme here.
// Built once at module scope: a fresh theme object each render would churn
// thirdweb's emotion styles, same reason `wallet` lives out here.
const connectButtonColors = {
    primaryButtonBg: "var(--primary)",
    primaryButtonText: "var(--primary-foreground)",
};

const connectLightTheme = lightTheme({ colors: connectButtonColors });
const connectDarkTheme = darkTheme({ colors: connectButtonColors });

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Links the connected wallet to the signed-in user on first connect.
    useWalletAddressSync();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isLoading && !user) {
            router.replace("/auth");
        }
    }, [user, isLoading, router]);

    if (!isLoading && !user) {
        return null;
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                {isLoading ? (
                    <div className="flex h-full w-full items-center justify-center min-h-screen">
                        <Loader />
                    </div>
                ) : (
                    <>
                        <PendingChainRecords />
                        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b border-sidebar-border">
                            <div className="flex items-center gap-2 px-4 w-full">
                                <SidebarTrigger className="-ml-1" />
                                <div className="ml-auto flex items-center gap-3">
                                    {mounted ? (
                                        <ConnectButton
                                            client={client}
                                            wallets={[wallet]}
                                            // Without these the modal reads assets for
                                            // whatever chain it defaults to, not Amoy.
                                            chain={amoy}
                                            chains={[amoy]}
                                            supportedNFTs={supportedNFTs}
                                            theme={
                                                resolvedTheme === "light"
                                                    ? connectLightTheme
                                                    : connectDarkTheme
                                            }
                                        />
                                    ) : (
                                        <div className="w-[140px] h-[40px] bg-muted animate-pulse rounded-xl" />
                                    )}
                                    <ThemeToggle />
                                </div>
                            </div>
                        </header>
                        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background text-foreground">
                            {children}
                        </main>
                    </>
                )}
            </SidebarInset>
        </SidebarProvider>
    );
}