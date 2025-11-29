/* eslint-disable @next/next/no-head-element */
/* Client-side TRPC + React Query provider */
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./client";
import React from "react";

function getBaseUrl() {
	if (typeof window !== "undefined") return "";
	return `http://localhost:3000`;
}

export function TRPCProvider(props: { children: React.ReactNode }) {
	const [queryClient] = React.useState(() => new QueryClient());
	const [trpcClient] = React.useState(() =>
		trpc.createClient({
			links: [
				httpBatchLink({
					url: `${getBaseUrl()}/api/trpc`
				})
			]
		})
	);

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
		</trpc.Provider>
	);
}

