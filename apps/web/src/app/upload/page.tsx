import { TRPCProvider } from "../../trpc/provider";
import UploadInner from "./pageInner";

export default function UploadPage() {
	return (
		<TRPCProvider>
			<UploadInner />
		</TRPCProvider>
	);
}

