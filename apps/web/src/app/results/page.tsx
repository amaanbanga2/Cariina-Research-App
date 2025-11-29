import { TRPCProvider } from "../../trpc/provider";
import ResultsInner from "./pageInner";

export default function ResultsPage() {
	return (
		<TRPCProvider>
			<ResultsInner />
		</TRPCProvider>
	);
}

